-- Migration: AI Chat Sessions & Pomodoro Focus Sessions
-- Supports persistent chat history, cross-chat memory, and Pomodoro focus tracking.

-- 1. AI Chat Sessions Table
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_updated
  ON public.ai_chat_sessions (user_id, updated_at DESC);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions"
  ON public.ai_chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON public.ai_chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON public.ai_chat_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON public.ai_chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Pomodoro Sessions Table
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset text NOT NULL,
  duration_minutes integer NOT NULL,
  description text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  exp_awarded integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_date
  ON public.pomodoro_sessions (user_id, started_at DESC);

ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pomodoro sessions"
  ON public.pomodoro_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pomodoro sessions"
  ON public.pomodoro_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pomodoro sessions"
  ON public.pomodoro_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pomodoro sessions"
  ON public.pomodoro_sessions FOR DELETE
  USING (auth.uid() = user_id);
