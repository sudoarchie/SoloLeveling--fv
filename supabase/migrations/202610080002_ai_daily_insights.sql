-- AI-generated daily insights — one per user per day.
-- Written by the midnight cron job (service-role key, bypasses RLS).
-- Read by users through RLS select policy.

CREATE TABLE IF NOT EXISTS public.ai_daily_insights (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_date  date        NOT NULL DEFAULT current_date,
  -- Full AI analysis in markdown
  content       text        NOT NULL,
  -- Structured data: { strengths, weaknesses, todayFocus, riskLevel }
  summary       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Which LLM model generated this
  model         text        NOT NULL DEFAULT '',
  -- Token usage for cost tracking
  tokens_used   integer,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, insight_date)
);

ALTER TABLE public.ai_daily_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own insights" ON public.ai_daily_insights;
CREATE POLICY "Users can read own insights"
  ON public.ai_daily_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_date
  ON public.ai_daily_insights (user_id, insight_date DESC);
