-- Migration: Pomodoro Study Pattern & Pause Tracking
-- Allows AI Mentor to track when sessions start, when pauses happen, pause counts/durations, and resume events.

-- 1. Extend public.pomodoro_sessions with tracking columns
ALTER TABLE public.pomodoro_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS pause_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paused_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_focus_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_paused_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_resumed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Index for session queries by user and status/time
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_status
  ON public.pomodoro_sessions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at
  ON public.pomodoro_sessions (user_id, started_at DESC);

-- 2. Dedicated Pomodoro Timer Events Table (granular event log)
CREATE TABLE IF NOT EXISTS public.pomodoro_timer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.pomodoro_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'start', 'pause', 'resume', 'complete', 'abandon'
  created_at timestamptz NOT NULL DEFAULT now(),
  time_left_seconds integer DEFAULT NULL,
  pause_duration_seconds integer DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_timer_events_session
  ON public.pomodoro_timer_events (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_pomodoro_timer_events_user_time
  ON public.pomodoro_timer_events (user_id, created_at DESC);

ALTER TABLE public.pomodoro_timer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timer events"
  ON public.pomodoro_timer_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own timer events"
  ON public.pomodoro_timer_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timer events"
  ON public.pomodoro_timer_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own timer events"
  ON public.pomodoro_timer_events FOR DELETE
  USING (auth.uid() = user_id);
