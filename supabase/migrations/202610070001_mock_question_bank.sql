-- Run once in the Supabase SQL Editor. Safe to run again.
-- Papers, questions, and image blobs belong to the importing user.
begin;

create or replace function public.mock_images_valid(images jsonb, owner_id uuid)
returns boolean language plpgsql immutable set search_path = '' as $$
declare image jsonb;
begin
  if images is null or jsonb_typeof(images) <> 'array' then return false; end if;
  if jsonb_array_length(images) > 20 then return false; end if;
  for image in select value from jsonb_array_elements(images) loop
    if jsonb_typeof(image) <> 'object'
      or jsonb_typeof(image->'path') is distinct from 'string'
      or not (image->>'path' ~ ('^' || owner_id::text || '/[a-f0-9]{64}\.(png|jpg|webp|gif)$'))
      or jsonb_typeof(image->'alt') is distinct from 'string'
    then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.mock_options_valid(
  options jsonb, answers text[], kind text, owner_id uuid
) returns boolean language plpgsql immutable set search_path = '' as $$
declare option jsonb; ids text[] := '{}';
begin
  if options is null or jsonb_typeof(options) <> 'array' or answers is null then return false; end if;
  if kind = 'nat' then return options = '[]'::jsonb and cardinality(answers) = 0; end if;
  if kind not in ('mcq', 'msq') or jsonb_array_length(options) not between 2 and 10 then return false; end if;
  for option in select value from jsonb_array_elements(options) loop
    if jsonb_typeof(option) <> 'object'
      or jsonb_typeof(option->'id') is distinct from 'string'
      or not (option->>'id' ~ '^[A-Za-z0-9_-]{1,16}$')
      or (option->>'id') = any(ids)
      or jsonb_typeof(option->'text') is distinct from 'string'
      or not public.mock_images_valid(option->'images', owner_id)
    then return false; end if;
    if btrim(option->>'text') = '' and jsonb_array_length(option->'images') = 0 then return false; end if;
    ids := array_append(ids, option->>'id');
  end loop;
  return answers <@ ids and array_position(answers, null) is null
    and cardinality(answers) = (select count(distinct answer) from unnest(answers) as answer)
    and ((kind = 'mcq' and cardinality(answers) = 1) or (kind = 'msq' and cardinality(answers) >= 1));
end;
$$;

create table if not exists public.mock_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_key text not null check (source_key ~ '^[a-zA-Z0-9_-]{1,160}$'),
  title text not null check (length(btrim(title)) between 1 and 300),
  exam text not null check (length(btrim(exam)) between 1 and 100),
  year integer not null check (year between 1900 and 2100),
  subject text not null default '',
  duration_minutes integer not null default 180 check (duration_minutes between 1 and 1440),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key),
  unique (id, user_id)
);

create table if not exists public.mock_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paper_id uuid not null,
  question_number integer not null check (question_number between 1 and 10000),
  question_type text not null default 'mcq' check (question_type in ('mcq', 'msq', 'nat')),
  question_text text not null default '',
  images jsonb not null default '[]'::jsonb,
  options jsonb not null default '[]'::jsonb,
  correct_option_ids text[] not null default '{}',
  answer_min numeric,
  answer_max numeric,
  marks numeric(8,3) not null default 1 check (marks > 0 and marks <= 1000),
  negative_marks numeric(8,3) not null default 0 check (negative_marks >= 0 and negative_marks <= marks),
  explanation text not null default '',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (paper_id, user_id) references public.mock_papers(id, user_id) on delete cascade,
  unique (paper_id, question_number),
  check (public.mock_images_valid(images, user_id)),
  check (btrim(question_text) <> '' or jsonb_array_length(images) > 0),
  check (public.mock_options_valid(options, correct_option_ids, question_type, user_id)),
  check (
    (question_type = 'nat' and answer_min is not null and answer_max is not null
      and answer_min <= answer_max and answer_min > '-Infinity'::numeric and answer_max < 'Infinity'::numeric)
    or (question_type <> 'nat' and answer_min is null and answer_max is null)
  )
);

create index if not exists mock_papers_user_year on public.mock_papers(user_id, year desc);
create index if not exists mock_questions_user_paper on public.mock_questions(user_id, paper_id, question_number);

alter table public.mock_papers enable row level security;
alter table public.mock_questions enable row level security;
drop policy if exists "Own mock papers" on public.mock_papers;
create policy "Own mock papers" on public.mock_papers for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Own mock questions" on public.mock_questions;
create policy "Own mock questions" on public.mock_questions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.mock_papers, public.mock_questions to authenticated;
revoke all on public.mock_papers, public.mock_questions from anon;

create or replace function public.mock_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists mock_paper_updated on public.mock_papers;
create trigger mock_paper_updated before update on public.mock_papers
  for each row execute function public.mock_touch_updated_at();
drop trigger if exists mock_question_updated on public.mock_questions;
create trigger mock_question_updated before update on public.mock_questions
  for each row execute function public.mock_touch_updated_at();

-- One transaction: a bad question rolls back the entire paper import.
-- Re-imports merge by source_key + question_number. Omitted questions are kept.
create or replace function public.import_mock_paper(p_paper jsonb, p_questions jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); saved_paper_id uuid; q jsonb;
begin
  if owner_id is null then raise exception 'Sign in to import a paper'; end if;
  if jsonb_typeof(p_paper) is distinct from 'object'
    or jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'Expected a paper object and a questions array';
  end if;
  if jsonb_array_length(p_questions) not between 1 and 500 then
    raise exception 'Import between 1 and 500 questions at a time';
  end if;
  if (select count(distinct (value->>'question_number')::integer) from jsonb_array_elements(p_questions))
    <> jsonb_array_length(p_questions) then raise exception 'Duplicate or missing question numbers'; end if;

  insert into public.mock_papers (user_id, source_key, title, exam, year, subject, duration_minutes, source_url, metadata)
  values (owner_id, p_paper->>'source_key', p_paper->>'title', p_paper->>'exam',
    (p_paper->>'year')::integer, coalesce(p_paper->>'subject', ''),
    coalesce((p_paper->>'duration_minutes')::integer, 180), nullif(p_paper->>'source_url', ''),
    coalesce(p_paper->'metadata', '{}'::jsonb))
  on conflict (user_id, source_key) do update set title = excluded.title, exam = excluded.exam,
    year = excluded.year, subject = excluded.subject, duration_minutes = excluded.duration_minutes,
    source_url = excluded.source_url, metadata = excluded.metadata
  returning id into saved_paper_id;

  for q in select value from jsonb_array_elements(p_questions) loop
    insert into public.mock_questions (user_id, paper_id, question_number, question_type,
      question_text, images, options, correct_option_ids, answer_min, answer_max,
      marks, negative_marks, explanation, metadata)
    values (owner_id, saved_paper_id, (q->>'question_number')::integer, q->>'question_type',
      coalesce(q->>'question_text', ''), coalesce(q->'images', '[]'::jsonb),
      coalesce(q->'options', '[]'::jsonb),
      array(select jsonb_array_elements_text(coalesce(q->'correct_option_ids', '[]'::jsonb))),
      (q->>'answer_min')::numeric, (q->>'answer_max')::numeric,
      coalesce((q->>'marks')::numeric, 1), coalesce((q->>'negative_marks')::numeric, 0),
      coalesce(q->>'explanation', ''), coalesce(q->'metadata', '{}'::jsonb))
    on conflict (paper_id, question_number) do update set question_type = excluded.question_type,
      question_text = excluded.question_text, images = excluded.images, options = excluded.options,
      correct_option_ids = excluded.correct_option_ids, answer_min = excluded.answer_min,
      answer_max = excluded.answer_max, marks = excluded.marks, negative_marks = excluded.negative_marks,
      explanation = excluded.explanation, metadata = excluded.metadata;
  end loop;
  return jsonb_build_object('paper_id', saved_paper_id, 'imported_questions', jsonb_array_length(p_questions));
end;
$$;
revoke all on function public.import_mock_paper(jsonb, jsonb) from public, anon;
grant execute on function public.import_mock_paper(jsonb, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mock-question-images', 'mock-question-images', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Content-addressed images are immutable; the importer never overwrites a blob.
drop policy if exists "Read own mock images" on storage.objects;
create policy "Read own mock images" on storage.objects for select to authenticated
  using (bucket_id = 'mock-question-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Upload own mock images" on storage.objects;
create policy "Upload own mock images" on storage.objects for insert to authenticated
  with check (bucket_id = 'mock-question-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload schema';
commit;
