-- Run after migrations 001, 002, and 003. Re-runnable.
-- Deadlines, answer keys, grading, and attempt ownership are enforced in the DB.
begin;

create schema if not exists mock_exam_private;
revoke all on schema mock_exam_private from public, anon, authenticated;

create table if not exists mock_exam_private.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id uuid references public.mock_papers(id) on delete set null,
  title text not null,
  exam text not null,
  year integer not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completion_reason text check (completion_reason in ('submitted', 'timeout')),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  result jsonb,
  check (deadline_at = started_at + make_interval(mins => duration_minutes)),
  check ((status = 'in_progress' and completed_at is null and result is null)
    or (status = 'completed' and completed_at is not null and result is not null))
);
alter table mock_exam_private.attempts enable row level security;
revoke all on mock_exam_private.attempts from public, anon, authenticated;
create unique index if not exists mock_exam_one_active_paper
  on mock_exam_private.attempts(user_id, paper_id) where status = 'in_progress';
create index if not exists mock_exam_attempts_user on mock_exam_private.attempts(user_id, started_at desc);

-- Publishers can still manage their source data. Readers receive safe prompts
-- only through the exam RPCs, and answer keys only for their completed attempts.
drop policy if exists "Read shared mock papers" on public.mock_papers;
drop policy if exists "Read own mock paper sources" on public.mock_papers;
create policy "Read own mock paper sources" on public.mock_papers for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Read shared mock questions" on public.mock_questions;
drop policy if exists "Read own mock question sources" on public.mock_questions;
create policy "Read own mock question sources" on public.mock_questions for select to authenticated
  using ((select auth.uid()) = user_id);

-- Deliberate owner-executed view: all users see this limited shared catalog,
-- without source metadata, URLs, question text, explanations, or answer keys.
create or replace view public.mock_paper_catalog with (security_barrier = true) as
select p.id, p.title, p.exam, p.year, p.subject, p.duration_minutes,
  (select count(*)::integer from public.mock_questions q where q.paper_id = p.id) as question_count
from public.mock_papers p;
revoke all on public.mock_paper_catalog from public, anon, authenticated;
grant select on public.mock_paper_catalog to authenticated;
create or replace function public.list_mock_exams()
returns table (exam text) language sql stable security invoker set search_path = '' as $$
  select e.code from public.mock_exams e union select p.exam from public.mock_paper_catalog p;
$$;

create or replace function mock_exam_private.numeric_answer(value text)
returns numeric language plpgsql immutable set search_path = '' as $$
declare parsed numeric;
begin
  if value is null or length(value) > 64 or value !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]{1,3})?$' then return null; end if;
  parsed := value::numeric;
  if parsed < -1e12 or parsed > 1e12 then return null; end if;
  return parsed;
exception when numeric_value_out_of_range or invalid_text_representation then return null;
end;
$$;

create or replace function mock_exam_private.grade_question(q jsonb, answer jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare selected jsonb := coalesce(answer->'option_ids', '[]'::jsonb);
  parsed numeric; answered boolean; correct boolean := false; awarded numeric := 0;
begin
  if q->>'question_type' = 'nat' then
    parsed := mock_exam_private.numeric_answer(answer->>'numeric_answer');
    answered := parsed is not null;
    correct := answered and parsed between (q->>'answer_min')::numeric and (q->>'answer_max')::numeric;
  else
    answered := jsonb_array_length(selected) > 0;
    correct := answered and selected @> (q->'correct_option_ids') and selected <@ (q->'correct_option_ids');
  end if;
  if correct then awarded := (q->>'marks')::numeric;
  elsif answered then awarded := -(q->>'negative_marks')::numeric; end if;
  return jsonb_build_object('status', case when not answered then 'unanswered' when correct then 'correct' else 'incorrect' end,
    'awarded_marks', awarded);
end;
$$;

create or replace function mock_exam_private.finish(attempt_id uuid)
returns void language plpgsql set search_path = '' as $$
declare a mock_exam_private.attempts%rowtype; q jsonb; grade jsonb;
  score numeric := 0; total numeric := 0; correct integer := 0; incorrect integer := 0; unanswered integer := 0;
  grades jsonb := '{}'::jsonb; finished timestamptz;
begin
  select * into strict a from mock_exam_private.attempts where id = attempt_id for update;
  if a.status = 'completed' then return; end if;
  finished := clock_timestamp();
  for q in select value from jsonb_array_elements(a.questions) loop
    grade := mock_exam_private.grade_question(q, a.answers->(q->>'id'));
    total := total + (q->>'marks')::numeric;
    score := score + (grade->>'awarded_marks')::numeric;
    if grade->>'status' = 'correct' then correct := correct + 1;
    elsif grade->>'status' = 'incorrect' then incorrect := incorrect + 1;
    else unanswered := unanswered + 1; end if;
    grades := grades || jsonb_build_object(q->>'id', grade);
  end loop;
  update mock_exam_private.attempts set status = 'completed', completed_at = least(finished, a.deadline_at),
    completion_reason = case when finished >= a.deadline_at then 'timeout' else 'submitted' end,
    result = jsonb_build_object('score', score, 'total_marks', total, 'correct', correct,
      'incorrect', incorrect, 'unanswered', unanswered, 'question_results', grades,
      'percentage', case when total > 0 then round(score * 100 / total, 2) else 0 end)
  where id = attempt_id;
end;
$$;

create or replace function mock_exam_private.payload(attempt_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare a mock_exam_private.attempts%rowtype; prompts jsonb;
begin
  select * into strict a from mock_exam_private.attempts where id = attempt_id for update;
  if a.status = 'in_progress' and clock_timestamp() >= a.deadline_at then
    perform mock_exam_private.finish(a.id);
    select * into strict a from mock_exam_private.attempts where id = attempt_id;
  end if;
  if a.status = 'completed' then prompts := a.questions;
  else
    select jsonb_agg(q - array['correct_option_ids', 'answer_min', 'answer_max', 'explanation'])
      into prompts from jsonb_array_elements(a.questions) as q;
  end if;
  return jsonb_build_object('id', a.id, 'paper_id', a.paper_id, 'title', a.title, 'exam', a.exam, 'year', a.year,
    'duration_minutes', a.duration_minutes, 'started_at', a.started_at, 'deadline_at', a.deadline_at,
    'server_now', clock_timestamp(), 'completed_at', a.completed_at, 'status', a.status,
    'completion_reason', a.completion_reason, 'answers', a.answers, 'questions', prompts, 'result', a.result);
end;
$$;

create or replace function public.start_mock_exam(p_paper_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); existing_id uuid; p public.mock_papers%rowtype;
  snapshot jsonb; started timestamptz; new_id uuid;
begin
  if owner_id is null then raise exception 'Sign in to start an exam'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || p_paper_id::text, 0));
  select id into existing_id from mock_exam_private.attempts
    where user_id = owner_id and paper_id = p_paper_id and status = 'in_progress' for update;
  if found then return mock_exam_private.payload(existing_id); end if;
  select * into p from public.mock_papers where id = p_paper_id for share;
  if not found then raise exception 'This paper is no longer available'; end if;
  select jsonb_agg(to_jsonb(q) - array['user_id', 'paper_id', 'created_at', 'updated_at', 'metadata'] order by q.question_number)
    into snapshot from public.mock_questions q where q.paper_id = p.id;
  if snapshot is null then raise exception 'This paper has no questions yet'; end if;
  if jsonb_array_length(snapshot) > 1000 then raise exception 'A mock exam supports up to 1000 questions'; end if;
  started := clock_timestamp();
  insert into mock_exam_private.attempts(user_id, paper_id, title, exam, year, duration_minutes, started_at, deadline_at, questions)
    values(owner_id, p.id, p.title, p.exam, p.year, p.duration_minutes, started,
      started + make_interval(mins => p.duration_minutes), snapshot) returning id into new_id;
  return mock_exam_private.payload(new_id);
end;
$$;

create or replace function public.get_mock_exam(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from mock_exam_private.attempts where id = p_attempt_id and user_id = auth.uid()) then
    raise exception 'Exam attempt not found';
  end if;
  return mock_exam_private.payload(p_attempt_id);
end;
$$;

create or replace function public.save_mock_exam_answer(
  p_attempt_id uuid, p_question_id uuid, p_option_ids text[] default '{}',
  p_numeric_answer text default null, p_marked_for_review boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a mock_exam_private.attempts%rowtype; q jsonb; valid_ids text[];
  options text[] := coalesce(p_option_ids, '{}'); numeric_text text := nullif(btrim(p_numeric_answer), '');
begin
  select * into a from mock_exam_private.attempts where id = p_attempt_id and user_id = auth.uid() for update;
  if not found then raise exception 'Exam attempt not found'; end if;
  if a.status = 'completed' or clock_timestamp() >= a.deadline_at then return mock_exam_private.payload(a.id); end if;
  select value into q from jsonb_array_elements(a.questions) where value->>'id' = p_question_id::text;
  if not found then raise exception 'Question does not belong to this attempt'; end if;
  select array_agg(value->>'id') into valid_ids from jsonb_array_elements(q->'options');
  if array_position(options, null) is not null or cardinality(options) <> (select count(distinct id) from unnest(options) id)
    or not (options <@ coalesce(valid_ids, '{}')) then raise exception 'Invalid option selection'; end if;
  if q->>'question_type' = 'mcq' and cardinality(options) > 1 then raise exception 'Choose only one option'; end if;
  if q->>'question_type' = 'nat' and cardinality(options) > 0 then raise exception 'Enter a numerical answer'; end if;
  if q->>'question_type' <> 'nat' and numeric_text is not null then raise exception 'Select an option for this question'; end if;
  if length(numeric_text) > 64 then raise exception 'Numerical answer is too long'; end if;
  update mock_exam_private.attempts set answers = jsonb_set(answers, array[p_question_id::text],
    jsonb_build_object('option_ids', options, 'numeric_answer', numeric_text, 'marked_for_review', coalesce(p_marked_for_review, false)), true)
    where id = a.id;
  -- Save acknowledgements stay small; only a completed attempt returns the full result.
  return jsonb_build_object('id', a.id, 'status', 'in_progress', 'server_now', clock_timestamp());
end;
$$;

create or replace function public.submit_mock_exam(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from mock_exam_private.attempts where id = p_attempt_id and user_id = auth.uid()) then
    raise exception 'Exam attempt not found';
  end if;
  perform mock_exam_private.finish(p_attempt_id);
  return mock_exam_private.payload(p_attempt_id);
end;
$$;

create or replace function public.list_mock_exam_attempts()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare expired_id uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view results'; end if;
  for expired_id in select id from mock_exam_private.attempts where user_id = auth.uid()
    and status = 'in_progress' and deadline_at <= clock_timestamp() loop
    perform mock_exam_private.finish(expired_id);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.started_at desc), '[]'::jsonb) into result from (
    select id, paper_id, title, exam, status, started_at, deadline_at, completed_at,
      result->'score' as score, result->'total_marks' as total_marks
    from mock_exam_private.attempts where user_id = auth.uid() order by started_at desc limit 50
  ) a;
  return result;
end;
$$;

revoke all on all functions in schema mock_exam_private from public, anon, authenticated;
revoke all on function public.start_mock_exam(uuid), public.get_mock_exam(uuid),
  public.save_mock_exam_answer(uuid, uuid, text[], text, boolean), public.submit_mock_exam(uuid),
  public.list_mock_exam_attempts() from public, anon;
grant execute on function public.start_mock_exam(uuid), public.get_mock_exam(uuid),
  public.save_mock_exam_answer(uuid, uuid, text[], text, boolean), public.submit_mock_exam(uuid),
  public.list_mock_exam_attempts() to authenticated;

notify pgrst, 'reload schema';
commit;
