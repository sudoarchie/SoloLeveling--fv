-- ============================================================
-- GATE Tracker Pro — SEED DATA (for testing)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Self-contained: if auth.users is empty, it creates a test user:
--   email:    test@example.com
--   password: test1234
-- Then seeds data for EVERY user in auth.users.
-- Re-runnable: it deletes its own seed rows first, then re-inserts.
-- ============================================================

do $$
declare
  uid uuid;
  user_count integer;
  today date := current_date;
begin
  -- --------------------------------------------------------
  -- 0a. Auto-create a test user if there are no users at all
  --     (password is bcrypt-hashed; "test1234")
  -- --------------------------------------------------------
  select count(*) into user_count from auth.users;

  if user_count = 0 then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'test@example.com',
      crypt('test1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Test Hunter"}',
      now(),
      now(),
      '', '', '', ''
    );

    -- Fire the on_auth_user_created trigger manually (inserts via SQL
    -- don't always fire it in the SQL editor context)
    insert into public.streaks (user_id)
    select id from auth.users where email = 'test@example.com'
    on conflict (user_id) do nothing;

    insert into public.user_progress (user_id)
    select id from auth.users where email = 'test@example.com'
    on conflict (user_id) do nothing;

    -- auth.identities row is required for password sign-in to work
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    select
      gen_random_uuid(),
      u.id,
      u.id::text,
      jsonb_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    from auth.users as u
    where u.email = 'test@example.com'
    on conflict (provider_id, provider) do nothing;

    raise notice 'Created test user: test@example.com / test1234';
    select count(*) into user_count from auth.users;
  end if;

  raise notice 'Seeding for % user(s)...', user_count;

  -- Loop over all users (usually just you in dev)
  for uid in select id from auth.users
  loop
    -- --------------------------------------------------------
    -- 0. Clean previous seed rows for this user
    -- --------------------------------------------------------
    delete from public.revision_topics    where user_id = uid;
    delete from public.daily_quests       where user_id = uid;
    delete from public.quest_log          where user_id = uid;
    delete from public.streaks            where user_id = uid;
    delete from public.daily_reports      where user_id = uid;
    delete from public.user_progress      where user_id = uid;
    delete from public.mock_test_attempts where user_id = uid;
    delete from public.mock_exams         where user_id = uid;

    -- --------------------------------------------------------
    -- 1. Revision topics — covers every state of the schedule
    -- --------------------------------------------------------
    insert into public.revision_topics (user_id, name, subject, stage, review_count, next_review_date, mastered, difficulty) values
      -- Due TODAY (these show up as tickable to-do items)
      (uid, 'Integration by parts',      'Mathematics', 0, 0, today,     false, 'hard'),
      (uid, 'Thermodynamics — 2nd law',  'Physics',     1, 1, today,     false, 'medium'),
      (uid, 'OS — Deadlocks',            'CS',          2, 2, today,     false, 'easy'),
      (uid, 'Normalisation 1NF–3NF',     'CS',          0, 0, today - 2, false, 'hard'),
      (uid, 'Electromagnetic induction', 'Physics',     1, 1, today - 1, false, 'medium'),

      -- Coming up (future reviews)
      (uid, 'Fourier series',            'Mathematics', 1, 1, today + 1, false, 'medium'),
      (uid, 'Compiler — Parsing',        'CS',          2, 2, today + 3, false, 'hard'),
      (uid, 'Organic — Aldehydes',       'Chemistry',   0, 0, today + 2, false, 'easy'),
      (uid, 'Probability distributions', 'Mathematics', 2, 2, today + 6, false, 'medium'),
      (uid, 'DBMS — Indexing',           'CS',          1, 1, today + 12, false, 'easy'),

      -- Mastered (4 successful reviews)
      (uid, 'Kinematics basics',         'Physics',     4, 4, today,     true,  'easy'),
      (uid, 'Chemical bonding',          'Chemistry',   4, 4, today,     true,  'medium');

    -- --------------------------------------------------------
    -- 2. Today's daily quests — partially completed
    --    (matches the QUEST_TEMPLATES in useDailyQuests.ts)
    --    completedAt timestamps are generated from today's date
    -- --------------------------------------------------------
    insert into public.daily_quests (user_id, quest_date, quests, all_completed) values (
      uid,
      today,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'solve-mcqs',
          'title', 'Solve 20 practice questions',
          'description', 'Retrieval practice — testing yourself beats re-reading',
          'icon', 'PenLine',
          'target', 20,
          'progress', 12,
          'expReward', 100,
          'completed', false
        ),
        jsonb_build_object(
          'id', 'revise-topic',
          'title', 'Revise 1 weak topic',
          'description', 'Tackle your hardest subject while it''s fresh',
          'icon', 'BookOpen',
          'target', 1,
          'progress', 1,
          'expReward', 80,
          'completed', true,
          'completedAt', (now() - interval '2 hours')::text
        ),
        jsonb_build_object(
          'id', 'deep-work',
          'title', '2× 25-min focused study',
          'description', 'Phone away, single task, full concentration',
          'icon', 'Target',
          'target', 2,
          'progress', 0,
          'expReward', 120,
          'completed', false
        ),
        jsonb_build_object(
          'id', 'morning-start',
          'title', 'Start before 10 AM',
          'description', 'Your brain encodes memory best at its morning peak',
          'icon', 'Sunrise',
          'target', 1,
          'progress', 1,
          'expReward', 50,
          'completed', true,
          'completedAt', (now() - interval '4 hours')::text
        )
      ),
      false
    );

    -- --------------------------------------------------------
    -- 3. Streak — 6-day streak, 14 total days completed
    -- --------------------------------------------------------
    insert into public.streaks (user_id, current_streak, longest_streak, last_quest_date, days_completed, streak_freezes) values
      (uid, 6, 11, today - 1, 14, 1);

    -- --------------------------------------------------------
    -- 3b. User progress — S-Rank EXP, settings, cosmetics
    --     (replaces the old localStorage "gate-tracker-pro" key)
    -- --------------------------------------------------------
    insert into public.user_progress (user_id, current_exp, exam_date, sound_enabled, selected_theme, unlocked_titles, active_title, unlocked_cosmetics) values
      (
        uid,
        5200,                          -- S-Rank (4500–6500) for rank testing
        today + 90,                    -- exam in 90 days
        true,
        'purple',
        '["Night Commander","Shadow Sovereign"]'::jsonb,
        'Night Commander',
        '["dark-aura","gold-frame"]'::jsonb
      );

    -- --------------------------------------------------------
    -- 3c. Daily reports — last 7 days of entries
    --     (feeds charts, heatmap, streak stats)
    -- --------------------------------------------------------
    insert into public.daily_reports (user_id, report_date, lectures_completed, topics_revised, practice_hours, morning_session, exercise_done, distractions_level, mental_state, exp_gained) values
      (uid, today,     15, 3, 4.0, true,  true,  'None',   'Sharp',      930),
      (uid, today - 1, 20, 2, 3.5, true,  true,  'Low',    'Good',       960),
      (uid, today - 2, 10, 1, 2.0, false, false, 'Medium', 'Tired',      280),
      (uid, today - 3, 25, 4, 5.0, true,  true,  'None',   'Focused',   1480),
      (uid, today - 4,  8, 2, 1.5, false, true,  'High',   'Distracted', 190),
      (uid, today - 5, 18, 3, 3.0, true,  false, 'Low',    'Okay',       820),
      (uid, today - 6, 12, 1, 2.5, true,  true,  'None',   'Good',       780);

    -- --------------------------------------------------------
    -- 4. Quest log — history from the past few days
    -- --------------------------------------------------------
    insert into public.quest_log (user_id, quest_id, quest_title, exp_reward, completed_at) values
      (uid, 'solve-mcqs',    'Solve 20 practice questions', 100, now() - interval '1 day'),
      (uid, 'revise-topic',  'Revise 1 weak topic',          80, now() - interval '1 day'),
      (uid, 'deep-work',     '2× 25-min focused study',     120, now() - interval '2 days'),
      (uid, 'morning-start', 'Start before 10 AM',           50, now() - interval '2 days'),
      (uid, 'solve-mcqs',    'Solve 20 practice questions', 100, now() - interval '3 days'),
      (uid, 'revise-topic',  'Revise 1 weak topic',          80, now() - interval '4 days');

    -- --------------------------------------------------------
    -- 5. Mock tests — two exams with scored attempts
    --    EXP formula: 200 + pct/100*300, PB gets ×1.5
    -- --------------------------------------------------------
    insert into public.mock_exams (user_id, name, total_marks) values
      (uid, 'GATE CS Full Mock 1',  100),
      (uid, 'Made Easy Part Test',   50)
    returning name, id;

    insert into public.mock_test_attempts (user_id, exam_id, marks_obtained, total_marks, score_pct, exp_gained, attempted_at)
    select
      uid,
      e.id,
      a.marks,
      e.total_marks,
      round((a.marks / e.total_marks::numeric) * 100, 2),
      round((200 + round((a.marks / e.total_marks::numeric) * 300)) *
        case when a.is_pb then 1.5 else 1 end),
      now() - a.days_ago
    from (values
      ('GATE CS Full Mock 1',  42.0, false, interval '12 days'),
      ('GATE CS Full Mock 1',  55.0, true,  interval '8 days'),
      ('GATE CS Full Mock 1',  61.0, true,  interval '3 days'),
      ('Made Easy Part Test',  28.0, false, interval '6 days'),
      ('Made Easy Part Test',  35.0, true,  interval '1 day')
    ) as a(exam_name, marks, is_pb, days_ago)
    join public.mock_exams e on e.user_id = uid and e.name = a.exam_name;

    raise notice 'Seeded data for user %', uid;
  end loop;

  raise notice 'DONE. Seeded % user(s).', user_count;
end $$;

-- Quick sanity check
select 'revision_topics' as table, count(*) from public.revision_topics
union all
select 'daily_quests', count(*) from public.daily_quests
union all
select 'streaks', count(*) from public.streaks
union all
select 'quest_log', count(*) from public.quest_log
union all
select 'user_progress', count(*) from public.user_progress
union all
select 'daily_reports', count(*) from public.daily_reports
union all
select 'mock_exams', count(*) from public.mock_exams
union all
select 'mock_test_attempts', count(*) from public.mock_test_attempts;

-- Test user credentials (only created if auth.users was empty):
--   email:    test@example.com
--   password: test1234
