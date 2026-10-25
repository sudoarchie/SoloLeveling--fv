-- ============================================================
-- GATE Tracker Pro — Daily Quests & Streak System
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Daily quests table --------------------------------------
-- One row per user per day. Quests are generated client-side
-- from templates; this stores the day's quest list + completion.
create table if not exists public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_date date not null default current_date,
  quests jsonb not null default '[]'::jsonb,
  -- quests jsonb shape:
  -- [{ id, title, description, icon, target, progress, expReward, completed, completedAt }]
  all_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quest_date)
);

-- 2. Streaks table --------------------------------------------
create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_quest_date date,
  -- Total days the user completed all goals
  days_completed integer not null default 0,
  streak_freezes integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 2b. Spaced repetition topics ("weak topics" tracker) ---------
-- Each topic schedules reviews on the Ebbinghaus curve:
-- 1d -> 3d -> 7d -> 21d. Four successful reviews = mastered.
create table if not exists public.revision_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null default 'General',
  -- Index into the interval schedule: 0=1d, 1=3d, 2=7d, 3=21d
  stage integer not null default 0,
  -- Successful review count (0-4). 4 = mastered.
  review_count integer not null default 0,
  next_review_date date not null default current_date,
  mastered boolean not null default false,
  -- How hard the user finds this topic: easy | medium | hard.
  -- Harder topics award more EXP per review (desirable difficulty).
  difficulty text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Migration for existing installs: add difficulty if missing
alter table public.revision_topics
  add column if not exists difficulty text not null default 'medium';

-- 3. Quest completion log (for analytics later) ---------------
create table if not exists public.quest_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null,
  quest_title text,
  exp_reward integer not null default 0,
  completed_at timestamptz not null default now()
);

-- 3b. User progress & preferences (replaces localStorage) ------
-- One row per user holding all persistent state that used to
-- live in localStorage: EXP, rank progress, settings, cosmetics.
create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_exp integer not null default 0,
  exam_date date,
  sound_enabled boolean not null default true,
  selected_theme text not null default 'blue',
  unlocked_titles jsonb not null default '[]'::jsonb,
  active_title text,
  unlocked_cosmetics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3c. Daily reports (replaces localStorage dailyReports) -------
-- One row per user per day — the daily entry form data.
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null default current_date,
  lectures_completed integer not null default 0,
  topics_revised integer not null default 0,
  practice_hours numeric(5,1) not null default 0,
  morning_session boolean not null default false,
  exercise_done boolean not null default false,
  distractions_level text not null default 'None',
  mental_state text not null default '',
  exp_gained integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, report_date)
);

-- 3d. User mock tests ------------------------------------------
-- User-defined exams (e.g. "GATE CS Full Mock", "Made Easy Subject Test")
-- with scored attempts. EXP is awarded per attempt, weighted by
-- score percentage — higher scores earn more points.
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
  -- Percentage score, stored for easy sorting/analytics
  score_pct numeric(5,2) not null,
  time_spent_minutes integer default null,
  total_questions integer default null,
  questions_attempted integer default null,
  questions_correct integer default null,
  questions_incorrect integer default null,
  accuracy_pct numeric(5,2) default null,
  -- EXP awarded for this attempt
  exp_gained integer not null default 0,
  notes text default null,
  attempted_at timestamptz not null default now()
);

-- 4. Enable RLS -----------------------------------------------
alter table public.daily_quests enable row level security;
alter table public.streaks enable row level security;
alter table public.quest_log enable row level security;
alter table public.revision_topics enable row level security;
alter table public.user_progress enable row level security;
alter table public.daily_reports enable row level security;
alter table public.user_mock_exams enable row level security;
alter table public.user_mock_attempts enable row level security;

-- 5. Policies: users can only touch their own rows ------------
drop policy if exists "Users can CRUD own quests" on public.daily_quests;
create policy "Users can CRUD own quests"
  on public.daily_quests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own streak" on public.streaks;
create policy "Users can CRUD own streak"
  on public.streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own quest log" on public.quest_log;
create policy "Users can CRUD own quest log"
  on public.quest_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own revision topics" on public.revision_topics;
create policy "Users can CRUD own revision topics"
  on public.revision_topics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own progress" on public.user_progress;
create policy "Users can CRUD own progress"
  on public.user_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own daily reports" on public.daily_reports;
create policy "Users can CRUD own daily reports"
  on public.daily_reports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

-- 6. Auto-create streak + progress rows on signup -------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.streaks (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.user_progress (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Indexes ---------------------------------------------------
create index if not exists idx_daily_quests_user_date
  on public.daily_quests (user_id, quest_date desc);
create index if not exists idx_quest_log_user
  on public.quest_log (user_id, completed_at desc);
create index if not exists idx_revision_topics_user_next
  on public.revision_topics (user_id, next_review_date);
create index if not exists idx_daily_reports_user_date
  on public.daily_reports (user_id, report_date desc);
create index if not exists idx_user_mock_exams_user
  on public.user_mock_exams (user_id, created_at);
create index if not exists idx_user_mock_attempts_user
  on public.user_mock_attempts (user_id, attempted_at desc);
create index if not exists idx_user_mock_attempts_exam
  on public.user_mock_attempts (exam_id, attempted_at desc);


-- ============================================================
-- 8. Pomodoro Focus Sessions & Timer Events Tracking
-- ============================================================

create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preset text not null,
  duration_minutes integer not null,
  description text not null default '',
  status text not null default 'completed',
  completed boolean not null default false,
  exp_awarded integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz default null,
  pause_count integer not null default 0,
  total_paused_seconds integer not null default 0,
  actual_focus_seconds integer not null default 0,
  last_paused_at timestamptz default null,
  last_resumed_at timestamptz default null,
  events jsonb not null default '[]'::jsonb
);

create index if not exists idx_pomodoro_sessions_user_date
  on public.pomodoro_sessions (user_id, started_at desc);

create index if not exists idx_pomodoro_sessions_user_status
  on public.pomodoro_sessions (user_id, status);

alter table public.pomodoro_sessions enable row level security;

create policy "Users can view own pomodoro sessions"
  on public.pomodoro_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own pomodoro sessions"
  on public.pomodoro_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pomodoro sessions"
  on public.pomodoro_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own pomodoro sessions"
  on public.pomodoro_sessions for delete
  using (auth.uid() = user_id);

-- Dedicated Pomodoro Timer Events Table
create table if not exists public.pomodoro_timer_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.pomodoro_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now(),
  time_left_seconds integer default null,
  pause_duration_seconds integer default null,
  metadata jsonb default '{}'::jsonb
);

create index if not exists idx_pomodoro_timer_events_session
  on public.pomodoro_timer_events (session_id, created_at asc);

create index if not exists idx_pomodoro_timer_events_user_time
  on public.pomodoro_timer_events (user_id, created_at desc);

alter table public.pomodoro_timer_events enable row level security;

create policy "Users can view own timer events"
  on public.pomodoro_timer_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own timer events"
  on public.pomodoro_timer_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own timer events"
  on public.pomodoro_timer_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own timer events"
  on public.pomodoro_timer_events for delete
  using (auth.uid() = user_id);
