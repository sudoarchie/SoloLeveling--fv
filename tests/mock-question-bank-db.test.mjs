import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { openSync, closeSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { validateManifest, databasePayload } from "../scripts/mock-paper-manifest.mjs"

// Uses a disposable local PostgreSQL cluster in single-user mode (no sockets).
// Auth/Storage tables below mirror just the Supabase contracts used by this migration.
// Single-user PostgreSQL bypasses RLS even after SET ROLE. Check its configuration
// and evaluate the installed policy predicates; live RLS requires a Supabase test project.
test("migration, transactional imports, constraints, and installed access-policy predicates", async t => {
  const available = command => {
    const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 5000 })
    return result.status === 0 && result.stdout?.includes("PostgreSQL")
  }
  if (!available("initdb") || !available("postgres")) {
    t.skip("Install PostgreSQL locally to run SQL integration tests")
    return
  }
  const folder = await mkdtemp(path.join(os.tmpdir(), "mock-bank-db-"))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const init = spawnSync("initdb", ["-D", folder, "-A", "trust", "--no-locale", "-E", "UTF8"], { encoding: "utf8", timeout: 10000 })
  assert.equal(init.status, 0, init.stderr)
  const a = "11111111-1111-1111-1111-111111111111"
  const b = "22222222-2222-2222-2222-222222222222"
  const manifest = validateManifest(JSON.parse(await readFile(new URL("../public/mock-paper.example.json", import.meta.url), "utf8")))
  const payload = databasePayload(manifest, new Map(), a)
  const sqlJson = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
  const paper = sqlJson(payload.p_paper)
  const questions = sqlJson(payload.p_questions)
  const invalid = structuredClone(payload.p_questions)
  invalid[1].correct_option_ids = ["Z"]
  const bootstrap = `
    create role authenticated; create role anon;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${a}'), ('${b}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id, name));
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
    $$;
    grant usage on schema public, auth, storage to authenticated, anon;
    grant select, insert, update, delete on storage.objects to authenticated;
  `
  const migration = await readFile(new URL("../supabase/migrations/202610070001_mock_question_bank.sql", import.meta.url), "utf8")
  const checks = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${a}', false);
    do $$ declare result jsonb; rejected boolean := false; begin
      result := public.import_mock_paper(${paper}, ${questions});
      perform set_config('test.paper_id', result->>'paper_id', false);
      assert result->>'imported_questions' = '3', 'Import count is incorrect';
      assert (select count(*) from public.mock_questions) = 3, 'Questions missing';
      assert (select year from public.mock_papers) = 2025, 'Year lost';
      begin
        perform public.import_mock_paper(${paper} || '{"title":"Must roll back"}'::jsonb, ${sqlJson(invalid)});
      exception when check_violation then rejected := true; end;
      assert rejected, 'Invalid answer key accepted';
      assert (select title from public.mock_papers) = 'Example practice paper (synthetic)', 'Paper did not roll back';
      perform public.import_mock_paper(${paper}, ${sqlJson([{ ...payload.p_questions[0], question_text: "Updated question" }])});
      assert (select count(*) from public.mock_questions) = 3, 'Re-import deleted or duplicated rows';
      assert (select question_text from public.mock_questions where question_number = 1) = 'Updated question', 'Re-import did not update';
      rejected := false;
      begin
        perform public.import_mock_paper(${paper}, ${sqlJson([payload.p_questions[0], payload.p_questions[0]])});
      exception when raise_exception then rejected := true; end;
      assert rejected, 'Duplicate question numbers accepted';
      insert into storage.objects(bucket_id, name) values ('mock-question-images', '${a}/diagram.png');
    end $$;

    select set_config('request.jwt.claim.sub', '${b}', false);
    do $$ declare rejected boolean := false; policy_sql text; permitted boolean; begin
      select qual into policy_sql from pg_policies where schemaname = 'public' and tablename = 'mock_papers';
      execute 'select (' || policy_sql || ') from (select $1::uuid as user_id) as row' into permitted using '${a}';
      assert not permitted, 'Paper read predicate permits another owner';
      execute 'select (' || policy_sql || ') from (select $1::uuid as user_id) as row' into permitted using '${b}';
      assert permitted, 'Paper read predicate denies its owner';
      select with_check into policy_sql from pg_policies where schemaname = 'public' and tablename = 'mock_questions';
      execute 'select (' || policy_sql || ') from (select $1::uuid as user_id) as row' into permitted using '${a}';
      assert not permitted, 'Question write predicate permits owner forgery';
      select qual into policy_sql from pg_policies where schemaname = 'storage' and policyname = 'Read own mock images';
      execute 'select (' || policy_sql || ') from (select $1::text as bucket_id, $2::text as name) as objects'
        into permitted using 'mock-question-images', '${a}/diagram.png';
      assert not permitted, 'Image read predicate permits another owner';
      execute 'select (' || policy_sql || ') from (select $1::text as bucket_id, $2::text as name) as objects'
        into permitted using 'mock-question-images', '${b}/diagram.png';
      assert permitted, 'Image read predicate denies its owner';
      select with_check into policy_sql from pg_policies where schemaname = 'storage' and policyname = 'Upload own mock images';
      execute 'select (' || policy_sql || ') from (select $1::text as bucket_id, $2::text as name) as objects'
        into permitted using 'mock-question-images', '${a}/forged.png';
      assert not permitted, 'Image upload predicate permits another owner';
      perform public.import_mock_paper(${paper}, ${questions});
      assert (select count(*) from public.mock_papers where user_id = '${b}') = 1, 'Owner-scoped source key failed';
      begin
        insert into public.mock_questions(user_id, paper_id, question_number, question_type, question_text, answer_min, answer_max)
        values ('${b}', current_setting('test.paper_id')::uuid, 4, 'nat', 'Cross-owner', 1, 1);
      exception when foreign_key_violation then rejected := true; end;
      assert rejected, 'Cross-owner paper relationship accepted';
      rejected := false;
      begin
        update public.mock_questions set images = jsonb_build_array(jsonb_build_object('path', '${a}/' || repeat('a', 64) || '.png', 'alt', 'wrong owner')) where question_number = 1 and user_id = '${b}';
      exception when check_violation then rejected := true; end;
      assert rejected, 'Foreign image reference accepted';
      rejected := false;
      begin
        update public.mock_questions set answer_min = 8, answer_max = 7 where question_type = 'nat';
      exception when check_violation then rejected := true; end;
      assert rejected, 'Invalid numerical range accepted';
      insert into storage.objects(bucket_id, name) values ('mock-question-images', '${b}/own.png');
      assert (select count(*) from storage.objects) = 2, 'Image insert failed';
    end $$;
    reset role;
    do $$ begin
      assert (select count(*) from public.mock_papers) = 2, 'Owner isolation did not preserve both papers';
      assert not exists (select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = 'public.import_mock_paper(jsonb,jsonb)'::regprocedure and a.grantee in (0, (select oid from pg_roles where rolname = 'anon'))), 'Anonymous import grant exists';
      assert not exists (select 1 from pg_class c, lateral aclexplode(c.relacl) a where c.oid = 'public.mock_questions'::regclass and a.grantee in (0, (select oid from pg_roles where rolname = 'anon'))), 'Anonymous question grant exists';
      assert (select bool_and(relrowsecurity) from pg_class where oid in ('public.mock_papers'::regclass, 'public.mock_questions'::regclass)), 'Row security is not enabled';
      assert not (select public from storage.buckets where id = 'mock-question-images'), 'Image bucket is public';
    end $$;
    select 'MOCK_BANK_SQL_CHECKS_PASSED';
  `
  const sharedMigration = await readFile(new URL("../supabase/migrations/202610070002_shared_mock_question_bank.sql", import.meta.url), "utf8")
  const sharedChecks = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${b}', false);
    do $$ declare p record; table_name text; predicate text; permitted boolean; begin
      foreach table_name in array array['mock_papers', 'mock_questions'] loop
        assert (select count(*) from pg_policies where schemaname = 'public' and tablename = table_name) = 4, 'Expected separate SELECT/INSERT/UPDATE/DELETE policies';
        for p in select * from pg_policies where schemaname = 'public' and tablename = table_name loop
          assert p.roles = array['authenticated']::name[], 'Shared rows must still require sign-in';
          if p.cmd = 'SELECT' then
            execute 'select (' || p.qual || ') from (select $1::uuid as user_id) as row' into permitted using '${a}';
            assert permitted, 'Shared SELECT denies another uploader';
          else
            foreach predicate in array array[p.qual, p.with_check] loop
              if predicate is not null then
                execute 'select (' || predicate || ') from (select $1::uuid as user_id) as row' into permitted using '${a}';
                assert not permitted, 'Reader can modify another uploader''s rows';
                execute 'select (' || predicate || ') from (select $1::uuid as user_id) as row' into permitted using '${b}';
                assert permitted, 'Uploader cannot manage their own rows';
              end if;
            end loop;
          end if;
        end loop;
      end loop;
      assert not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'Read own mock images'), 'Old image policy remains';
      select * into p from pg_policies where schemaname = 'storage' and policyname = 'Read shared mock images';
      assert p.roles = array['authenticated']::name[] and p.cmd = 'SELECT', 'Shared images require authenticated read policy';
      execute 'select (' || p.qual || ') from (select $1::text as bucket_id, $2::text as name) as objects'
        into permitted using 'mock-question-images', '${a}/diagram.png';
      assert permitted, 'Reader cannot access another uploader''s image';
      execute 'select (' || p.qual || ') from (select $1::text as bucket_id, $2::text as name) as objects'
        into permitted using 'unrelated-private-bucket', '${a}/diagram.png';
      assert not permitted, 'Shared policy exposes unrelated images';
      select with_check into predicate from pg_policies where schemaname = 'storage' and policyname = 'Upload own mock images';
      execute 'select (' || predicate || ') from (select $1::text as bucket_id, $2::text as name) as objects'
        into permitted using 'mock-question-images', '${a}/forged.png';
      assert not permitted, 'Reader can upload into another owner''s folder';
      assert (select array_agg(exam order by exam) from public.list_mock_exams()) = array['GATE'], 'Exam list is not deduplicated';
      perform public.import_mock_paper(${paper} || '{"source_key":"normalization-test","exam":"  jee  "}'::jsonb, ${sqlJson([payload.p_questions[0]])});
      assert (select exam from public.mock_papers where source_key = 'normalization-test') = 'JEE', 'Direct imports do not normalize exam codes';
      assert (select array_agg(exam order by exam) from public.list_mock_exams()) = array['GATE','JEE'], 'Exam discovery missed a different exam';
      assert (select count(*) from public.mock_papers where exam = 'GATE') = 2, 'Exam filtering mixed papers from different exams';
      update public.mock_papers set exam = ' gate ' where source_key = 'normalization-test';
      assert (select exam from public.mock_papers where source_key = 'normalization-test') = 'GATE', 'Edited exams are not normalized';
    end $$;
    reset role;
    do $$ begin
      assert not exists (select 1 from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = 'public.list_mock_exams()'::regprocedure and a.grantee in (0, (select oid from pg_roles where rolname = 'anon'))), 'Anonymous exam list grant exists';
      assert not (select public from storage.buckets where id = 'mock-question-images'), 'Shared bucket should still require sign-in';
    end $$;
    select 'SHARED_MOCK_BANK_SQL_CHECKS_PASSED';
  `
  const adminMigration = await readFile(new URL("../supabase/migrations/202610070003_mock_admin_api.sql", import.meta.url), "utf8")
  const adminChecks = `
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${b}', false);
    do $$ declare predicate text; permitted boolean; begin
      assert not public.is_mock_bank_admin(), 'Unregistered user has admin role';
      select with_check into predicate from pg_policies
        where schemaname = 'public' and tablename = 'mock_exams' and cmd = 'INSERT';
      execute 'select (' || predicate || ')' into permitted;
      assert not permitted, 'Exam insert policy permits non-admin';
      assert (select array_agg(exam order by exam) from public.list_mock_exams()) = array['GATE'], 'GATE catalog seed missing';
    end $$;
    reset role;
    insert into public.mock_bank_admins(user_id) values ('${a}');
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${a}', false);
    do $$ declare predicate text; permitted boolean; begin
      assert public.is_mock_bank_admin(), 'Registered uploader does not have admin role';
      select with_check into predicate from pg_policies
        where schemaname = 'public' and tablename = 'mock_exams' and cmd = 'INSERT';
      execute 'select (' || predicate || ')' into permitted;
      assert permitted, 'Exam insert policy denies admin';
      insert into public.mock_exams(code, name, created_by)
        values ('JEE', 'Joint Entrance Examination', '${a}');
      assert (select array_agg(exam order by exam) from public.list_mock_exams()) = array['GATE','JEE'], 'Empty exam absent from selector';
    end $$;
    reset role;
    do $$ begin
      assert not has_table_privilege('authenticated', 'public.mock_bank_admins', 'SELECT'), 'Admin roster exposed';
      assert not has_table_privilege('anon', 'public.mock_exams', 'SELECT'), 'Anonymous exam catalog read granted';
      assert (select relrowsecurity from pg_class where oid = 'public.mock_exams'::regclass), 'Exam RLS missing';
    end $$;
    select 'MOCK_ADMIN_SQL_CHECKS_PASSED';
  `
  const timedMigration = await readFile(new URL("../supabase/migrations/202610070004_timed_mock_exams.sql", import.meta.url), "utf8")
  const timedChecks = `
    select set_config('request.jwt.claim.sub', '${b}', false);
    do $$ declare a jsonb; saved jsonb; resumed jsonb; q1 uuid; q2 uuid; q3 uuid;
      rejected boolean; predicate text; permitted boolean; begin
      assert (select question_count from public.mock_paper_catalog where id = current_setting('test.paper_id')::uuid) = 3, 'Shared catalog lost questions';
      select qual into predicate from pg_policies where schemaname = 'public' and tablename = 'mock_questions' and cmd = 'SELECT';
      execute 'select (' || predicate || ') from (select $1::uuid as user_id) as row' into permitted using '${a}';
      assert not permitted, 'Other users can read answer keys directly';
      a := public.start_mock_exam(current_setting('test.paper_id')::uuid);
      perform set_config('test.attempt_id', a->>'id', false);
      assert a->>'status' = 'in_progress' and a->'result' = 'null'::jsonb, 'New attempt has a result';
      assert not (a->'questions'->0 ?| array['correct_option_ids','answer_min','answer_max','explanation','metadata']), 'Active payload leaks keys or hints';
      assert (a->>'deadline_at')::timestamptz - (a->>'started_at')::timestamptz = interval '30 minutes', 'Wrong fixed duration';
      resumed := public.start_mock_exam(current_setting('test.paper_id')::uuid);
      assert resumed->>'id' = a->>'id' and resumed->>'deadline_at' = a->>'deadline_at', 'Resume resets the timer or creates duplicate attempt';
      q1 := (a->'questions'->0->>'id')::uuid; q2 := (a->'questions'->1->>'id')::uuid; q3 := (a->'questions'->2->>'id')::uuid;
      rejected := false;
      begin perform public.save_mock_exam_answer((a->>'id')::uuid, q1, array['Z']); exception when raise_exception then rejected := true; end;
      assert rejected, 'Unknown option accepted';
      rejected := false;
      begin perform public.save_mock_exam_answer((a->>'id')::uuid, q1, array['A','B']); exception when raise_exception then rejected := true; end;
      assert rejected, 'MCQ accepted two choices';
      rejected := false;
      begin perform public.save_mock_exam_answer((a->>'id')::uuid, gen_random_uuid(), array['A']); exception when raise_exception then rejected := true; end;
      assert rejected, 'Foreign question accepted';
      rejected := false;
      begin perform public.save_mock_exam_answer((a->>'id')::uuid, q2, array['A','A']); exception when raise_exception then rejected := true; end;
      assert rejected, 'Duplicate MSQ accepted';
      saved := public.save_mock_exam_answer((a->>'id')::uuid, q1, array['A'], null, true);
      assert not (saved ? 'questions') and not (saved ? 'result'), 'Save response leaks questions/results';
      perform public.save_mock_exam_answer((a->>'id')::uuid, q2, array['C','A']);
      perform public.save_mock_exam_answer((a->>'id')::uuid, q3, '{}', '7.0');
      resumed := public.get_mock_exam((a->>'id')::uuid);
      assert resumed->'answers'->(q1::text)->>'marked_for_review' = 'true', 'Review flag lost';
      assert resumed->'answers'->(q3::text)->>'numeric_answer' = '7.0', 'Saved answer lost on reload';
      assert resumed->>'deadline_at' = a->>'deadline_at', 'Reload changed deadline';
      perform set_config('request.jwt.claim.sub', '${a}', false);
      rejected := false;
      begin perform public.get_mock_exam((a->>'id')::uuid); exception when raise_exception then rejected := true; end;
      assert rejected, 'Another user can read attempt';
      rejected := false;
      begin perform public.submit_mock_exam((a->>'id')::uuid); exception when raise_exception then rejected := true; end;
      assert rejected, 'Another user can submit attempt';
      rejected := false;
      begin perform public.save_mock_exam_answer((a->>'id')::uuid, q1, array['B']); exception when raise_exception then rejected := true; end;
      assert rejected, 'Another user can change answers';
      update public.mock_questions set marks = 10 where id = q1;
      perform set_config('request.jwt.claim.sub', '${b}', false);
      resumed := public.submit_mock_exam((a->>'id')::uuid);
      assert resumed->>'status' = 'completed' and resumed->>'completion_reason' = 'submitted', 'Submission failed';
      assert (resumed->'result'->>'score')::numeric = 3.667, 'MCQ penalty, MSQ set comparison, or NAT score incorrect';
      assert (resumed->'result'->>'total_marks')::numeric = 5, 'Paper edit changed existing exam';
      assert resumed->'result'->>'correct' = '2' and resumed->'result'->>'incorrect' = '1', 'Counts incorrect';
      assert resumed->'questions'->0 ? 'correct_option_ids', 'Completed result missing answer review';
      saved := public.submit_mock_exam((a->>'id')::uuid);
      assert saved->'result' = resumed->'result' and saved->>'completed_at' = resumed->>'completed_at', 'Repeated submission changes result';
      saved := public.save_mock_exam_answer((a->>'id')::uuid, q1, array['B']);
      assert saved->'answers' = resumed->'answers', 'Completed answers were changed';
      a := public.start_mock_exam(current_setting('test.paper_id')::uuid);
      assert a->>'id' <> resumed->>'id', 'Retake reuses completed attempt';
      perform set_config('test.expired_id', a->>'id', false);
      update mock_exam_private.attempts set started_at = now() - interval '31 minutes',
        deadline_at = now() - interval '1 minute' where id = (a->>'id')::uuid;
    end $$;
    do $$ declare a jsonb; saved jsonb; q uuid; begin
      select questions->0->>'id' into q from mock_exam_private.attempts where id = current_setting('test.expired_id')::uuid;
      a := public.save_mock_exam_answer(current_setting('test.expired_id')::uuid, q, array['B']);
      assert a->>'status' = 'completed' and a->>'completion_reason' = 'timeout', 'Late save does not finalize expired exam';
      assert a->'answers' = '{}'::jsonb and a->'result'->>'unanswered' = '3', 'Late answers counted';
      assert a->>'completed_at' = a->>'deadline_at', 'Timeout completion exceeds deadline';
      assert jsonb_array_length(public.list_mock_exam_attempts()) = 2, 'Attempt history missing';
      a := public.start_mock_exam(current_setting('test.paper_id')::uuid);
      update mock_exam_private.attempts set started_at = now() - interval '31 minutes', deadline_at = now() - interval '1 minute' where id = (a->>'id')::uuid;
      saved := public.get_mock_exam((a->>'id')::uuid);
      assert saved->>'completion_reason' = 'timeout', 'Reload did not finalize expired attempt';
      a := public.start_mock_exam(current_setting('test.paper_id')::uuid);
      update mock_exam_private.attempts set started_at = now() - interval '31 minutes', deadline_at = now() - interval '1 minute' where id = (a->>'id')::uuid;
      perform public.list_mock_exam_attempts();
      assert (select status from mock_exam_private.attempts where id = (a->>'id')::uuid) = 'completed', 'History did not finalize expired attempt';
      perform set_config('request.jwt.claim.sub', '${a}', false);
      assert public.list_mock_exam_attempts() = '[]'::jsonb, 'History leaks other users';
    end $$;
    do $$ declare q jsonb; grade jsonb; begin
      q := '{"question_type":"nat","answer_min":6.9,"answer_max":7.1,"marks":2,"negative_marks":0}';
      assert mock_exam_private.grade_question(q, '{"numeric_answer":"7.1"}')->>'status' = 'correct', 'Inclusive NAT boundary failed';
      assert mock_exam_private.grade_question(q, '{"numeric_answer":"7.11"}')->>'status' = 'incorrect', 'NAT range failed';
      assert mock_exam_private.grade_question(q, '{"numeric_answer":"-"}')->>'status' = 'unanswered', 'Partial NAT incorrectly graded';
      assert mock_exam_private.numeric_answer('NaN') is null and mock_exam_private.numeric_answer('Infinity') is null, 'Nonfinite NAT accepted';
      q := '{"question_type":"msq","correct_option_ids":["A","C"],"marks":2,"negative_marks":0}';
      assert mock_exam_private.grade_question(q, '{"option_ids":["A"]}')->>'status' = 'incorrect', 'Partial MSQ marked correct';
      assert mock_exam_private.grade_question(q, null)->>'status' = 'unanswered', 'Blank answer incorrectly graded';
      assert not has_schema_privilege('authenticated', 'mock_exam_private', 'USAGE'), 'Private schema accessible';
      assert not has_table_privilege('authenticated', 'mock_exam_private.attempts', 'SELECT'), 'Raw snapshots accessible';
      assert not has_function_privilege('authenticated', 'mock_exam_private.payload(uuid)', 'EXECUTE'), 'Payload helper directly callable';
      assert not has_function_privilege('anon', 'public.start_mock_exam(uuid)', 'EXECUTE'), 'Anonymous exam start granted';
      assert has_table_privilege('authenticated', 'public.mock_paper_catalog', 'SELECT'), 'Shared catalog unavailable';
      assert not has_table_privilege('anon', 'public.mock_paper_catalog', 'SELECT'), 'Anonymous catalog available';
    end $$;
    select 'TIMED_MOCK_EXAM_SQL_CHECKS_PASSED';
  `
  const singleLine = sql => sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join(" ")
  const sqlPath = path.join(folder, "checks.sql")
  const logPath = path.join(folder, "checks.log")
  await writeFile(sqlPath, [bootstrap, migration, migration, checks, sharedMigration, sharedMigration, sharedChecks, adminMigration, adminMigration, adminChecks, timedMigration, timedMigration, timedChecks].map(singleLine).join("\n") + "\n")
  const input = openSync(sqlPath, "r")
  const log = openSync(logPath, "w")
  let result
  try {
    result = spawnSync("postgres", ["--single", "-D", folder, "postgres"], {
      stdio: [input, log, log], timeout: 30000,
    })
  } finally { closeSync(input); closeSync(log) }
  const output = await readFile(logPath, "utf8")
  const errors = output.split("\n").filter(line => /ERROR:|FATAL:/.test(line)).join("\n")
  assert.equal(result.status, 0, errors || result.error?.message)
  assert.equal(errors, "", errors)
  assert.match(output, /MOCK_BANK_SQL_CHECKS_PASSED/)
  assert.match(output, /SHARED_MOCK_BANK_SQL_CHECKS_PASSED/)
  assert.match(output, /MOCK_ADMIN_SQL_CHECKS_PASSED/)
  assert.match(output, /TIMED_MOCK_EXAM_SQL_CHECKS_PASSED/)
})
