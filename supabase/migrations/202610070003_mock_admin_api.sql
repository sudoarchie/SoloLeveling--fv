-- Run after 202610070002_shared_mock_question_bank.sql.
-- Register the uploader separately in mock_bank_admins from the SQL Editor.
begin;

create table if not exists public.mock_bank_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.mock_bank_admins enable row level security;
revoke all on public.mock_bank_admins from public, anon, authenticated;

create or replace function public.is_mock_bank_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mock_bank_admins a where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_mock_bank_admin() from public, anon;
grant execute on function public.is_mock_bank_admin() to authenticated;

create table if not exists public.mock_exams (
  code text primary key check (length(btrim(code)) between 1 and 100 and code = upper(btrim(code))),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.mock_exams (code, name) values ('GATE', 'GATE')
on conflict (code) do nothing;
insert into public.mock_exams (code, name)
select distinct upper(btrim(exam)), upper(btrim(exam)) from public.mock_papers
where btrim(exam) <> ''
on conflict (code) do nothing;

alter table public.mock_exams enable row level security;
drop policy if exists "Read mock exams" on public.mock_exams;
create policy "Read mock exams" on public.mock_exams for select to authenticated using (true);
drop policy if exists "Admin inserts mock exams" on public.mock_exams;
create policy "Admin inserts mock exams" on public.mock_exams for insert to authenticated
  with check (public.is_mock_bank_admin());
drop policy if exists "Admin updates mock exams" on public.mock_exams;
create policy "Admin updates mock exams" on public.mock_exams for update to authenticated
  using (public.is_mock_bank_admin()) with check (public.is_mock_bank_admin());
drop policy if exists "Admin deletes mock exams" on public.mock_exams;
create policy "Admin deletes mock exams" on public.mock_exams for delete to authenticated
  using (public.is_mock_bank_admin());
grant select, insert, update, delete on public.mock_exams to authenticated;
revoke all on public.mock_exams from anon;

drop trigger if exists mock_exam_updated on public.mock_exams;
create trigger mock_exam_updated before update on public.mock_exams
  for each row execute function public.mock_touch_updated_at();

-- Include empty exams without hiding papers imported by the existing CLI.
create or replace function public.list_mock_exams()
returns table (exam text) language sql stable security invoker set search_path = '' as $$
  select e.code from public.mock_exams e
  union
  select p.exam from public.mock_papers p;
$$;
revoke all on function public.list_mock_exams() from public, anon;
grant execute on function public.list_mock_exams() to authenticated;

notify pgrst, 'reload schema';
commit;
