-- Make real timed mock exams the app's largest EXP reward.
-- Re-runnable. Apply after 202610070004_timed_mock_exams.sql.
begin;

alter table mock_exam_private.attempts
  add column if not exists exp_gained integer not null default 0 check (exp_gained between 0 and 2500),
  add column if not exists is_personal_best boolean not null default false;

create or replace function mock_exam_private.finish(attempt_id uuid)
returns void language plpgsql set search_path = '' as $$
declare a mock_exam_private.attempts%rowtype; q jsonb; grade jsonb;
  score numeric := 0; total numeric := 0; correct integer := 0; incorrect integer := 0; unanswered integer := 0;
  grades jsonb := '{}'::jsonb; finished timestamptz; pct numeric := 0; previous_best numeric;
  personal_best boolean := false; reward integer := 0; coverage numeric := 0;
begin
  select * into strict a from mock_exam_private.attempts where id = attempt_id for update;
  -- This guard makes repeated submit calls idempotent and prevents duplicate EXP.
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

  pct := case when total > 0 then round(score * 100 / total, 2) else 0 end;
  coverage := case when correct + incorrect + unanswered > 0
    then (correct + incorrect)::numeric / (correct + incorrect + unanswered) else 0 end;
  select max((prior.result->>'percentage')::numeric) into previous_best
    from mock_exam_private.attempts prior
    where prior.user_id = a.user_id and prior.id <> a.id and prior.status = 'completed'
      and prior.paper_id is not distinct from a.paper_id;
  -- A personal-best bonus requires a serious attempt, not an empty submission.
  personal_best := coverage >= 0.5 and (previous_best is null or pct > previous_best);

  -- Up to 750 attempt-coverage EXP + 1,000 score EXP + 750 personal-best EXP.
  reward := round(750 * coverage)::integer
    + round(greatest(0, least(100, pct)) * 10)::integer
    + case when personal_best then 750 else 0 end;

  insert into public.user_progress(user_id, current_exp, updated_at)
    values(a.user_id, reward, clock_timestamp())
  on conflict (user_id) do update
    set current_exp = public.user_progress.current_exp + excluded.current_exp,
        updated_at = excluded.updated_at;

  update mock_exam_private.attempts set
    status = 'completed',
    completed_at = least(finished, a.deadline_at),
    completion_reason = case when finished >= a.deadline_at then 'timeout' else 'submitted' end,
    exp_gained = reward,
    is_personal_best = personal_best,
    result = jsonb_build_object(
      'score', score,
      'total_marks', total,
      'correct', correct,
      'incorrect', incorrect,
      'unanswered', unanswered,
      'question_results', grades,
      'percentage', pct,
      'exp_gained', reward,
      'is_personal_best', personal_best
    )
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
  return jsonb_build_object(
    'id', a.id, 'paper_id', a.paper_id, 'title', a.title, 'exam', a.exam, 'year', a.year,
    'duration_minutes', a.duration_minutes, 'started_at', a.started_at, 'deadline_at', a.deadline_at,
    'server_now', clock_timestamp(), 'completed_at', a.completed_at, 'status', a.status,
    'completion_reason', a.completion_reason, 'answers', a.answers, 'questions', prompts, 'result', a.result,
    'exp_gained', a.exp_gained, 'is_personal_best', a.is_personal_best
  );
end;
$$;

create or replace function public.list_mock_exam_attempts()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare expired_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view results'; end if;
  for expired_id in select id from mock_exam_private.attempts where user_id = auth.uid()
    and status = 'in_progress' and deadline_at <= clock_timestamp() loop
    perform mock_exam_private.finish(expired_id);
  end loop;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.started_at desc), '[]'::jsonb) into v_result from (
    select id, paper_id, title, exam, status, started_at, deadline_at, completed_at,
      mock_exam_private.attempts.result->'score' as score, mock_exam_private.attempts.result->'total_marks' as total_marks,
      exp_gained, is_personal_best
    from mock_exam_private.attempts where user_id = auth.uid() order by started_at desc limit 50
  ) a;
  return v_result;
end;
$$;

revoke all on function mock_exam_private.finish(uuid) from public, anon, authenticated;
revoke all on function mock_exam_private.payload(uuid) from public, anon, authenticated;
revoke all on function public.list_mock_exam_attempts() from public, anon;
grant execute on function public.list_mock_exam_attempts() to authenticated;

notify pgrst, 'reload schema';
commit;
