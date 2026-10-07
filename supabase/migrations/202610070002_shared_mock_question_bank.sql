-- Run after 202610070001_mock_question_bank.sql.
-- All signed-in users can read the bank; uploaders retain write ownership.
begin;

drop policy if exists "Own mock papers" on public.mock_papers;
drop policy if exists "Own mock questions" on public.mock_questions;

drop policy if exists "Read shared mock papers" on public.mock_papers;
create policy "Read shared mock papers" on public.mock_papers for select to authenticated using (true);
drop policy if exists "Insert own mock papers" on public.mock_papers;
create policy "Insert own mock papers" on public.mock_papers for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Update own mock papers" on public.mock_papers;
create policy "Update own mock papers" on public.mock_papers for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own mock papers" on public.mock_papers;
create policy "Delete own mock papers" on public.mock_papers for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Read shared mock questions" on public.mock_questions;
create policy "Read shared mock questions" on public.mock_questions for select to authenticated using (true);
drop policy if exists "Insert own mock questions" on public.mock_questions;
create policy "Insert own mock questions" on public.mock_questions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Update own mock questions" on public.mock_questions;
create policy "Update own mock questions" on public.mock_questions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Delete own mock questions" on public.mock_questions;
create policy "Delete own mock questions" on public.mock_questions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Keep the bucket private; any signed-in reader can request a signed image URL.
drop policy if exists "Read own mock images" on storage.objects;
drop policy if exists "Read shared mock images" on storage.objects;
create policy "Read shared mock images" on storage.objects for select to authenticated
  using (bucket_id = 'mock-question-images');
-- The existing own-folder insert policy continues to restrict image uploads.

-- A stable exam code makes imports such as "gate" and " GATE " discoverable together.
create or replace function public.mock_normalize_exam()
returns trigger language plpgsql set search_path = '' as $$
begin new.exam := upper(btrim(new.exam)); return new; end;
$$;
drop trigger if exists mock_paper_normalize_exam on public.mock_papers;
create trigger mock_paper_normalize_exam before insert or update of exam on public.mock_papers
  for each row execute function public.mock_normalize_exam();
update public.mock_papers set exam = upper(btrim(exam)) where exam is distinct from upper(btrim(exam));
create index if not exists mock_papers_exam_year on public.mock_papers(exam, year desc, id);

-- Fetch every available exam without depending on the current page of papers.
create or replace function public.list_mock_exams()
returns table (exam text) language sql stable security invoker set search_path = '' as $$
  select distinct p.exam from public.mock_papers p order by p.exam;
$$;
revoke all on function public.list_mock_exams() from public, anon;
grant execute on function public.list_mock_exams() to authenticated;

notify pgrst, 'reload schema';
commit;
