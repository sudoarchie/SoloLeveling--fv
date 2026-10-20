-- 202610180001_user_mock_tests.sql
-- Separate personal mock test tracker from the Mock Question Bank catalog.
-- Adds support for:
--   1. Full Paper vs Subject-wise vs Topic test classification
--   2. Subject & Platform tags (Testbook, Made Easy, ACE, etc.)
--   3. Time spent (hours / minutes)
--   4. Question breakdown (attempted, correct, incorrect) & Accuracy %
--   5. Scored attempts with EXP rewards and Personal Best bonuses

create table if not exists public.user_mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exam_type text not null default 'full_paper' check (exam_type in ('full_paper', 'subject_wise', 'topic_test')),
  subject text default null,
  platform text default null,
  total_marks numeric(6,2) not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.user_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.user_mock_exams(id) on delete cascade,
  marks_obtained numeric(6,2) not null,
  total_marks numeric(6,2) not null,
  score_pct numeric(5,2) not null,
  time_spent_minutes integer default null,
  total_questions integer default null,
  questions_attempted integer default null,
  questions_correct integer default null,
  questions_incorrect integer default null,
  accuracy_pct numeric(5,2) default null,
  exp_gained integer not null default 0,
  notes text default null,
  attempted_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.user_mock_exams enable row level security;
alter table public.user_mock_attempts enable row level security;

-- RLS Policies
drop policy if exists "Users can CRUD own user_mock_exams" on public.user_mock_exams;
create policy "Users can CRUD own user_mock_exams"
  on public.user_mock_exams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own user_mock_attempts" on public.user_mock_attempts;
create policy "Users can CRUD own user_mock_attempts"
  on public.user_mock_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Performance Indexes
create index if not exists idx_user_mock_exams_user
  on public.user_mock_exams (user_id, created_at);

create index if not exists idx_user_mock_attempts_user
  on public.user_mock_attempts (user_id, attempted_at desc);

create index if not exists idx_user_mock_attempts_exam
  on public.user_mock_attempts (exam_id, attempted_at desc);
