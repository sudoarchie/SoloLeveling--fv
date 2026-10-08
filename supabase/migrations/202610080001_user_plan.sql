-- Add plan column to user_progress.
-- 'free' = default for all users, 'pro' = AI features unlocked.
-- You assign pro manually:
--   UPDATE user_progress SET plan = 'pro' WHERE user_id = '<uuid>';

ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Partial index so the cron can quickly find pro users
CREATE INDEX IF NOT EXISTS idx_user_progress_plan
  ON public.user_progress (plan) WHERE plan = 'pro';
