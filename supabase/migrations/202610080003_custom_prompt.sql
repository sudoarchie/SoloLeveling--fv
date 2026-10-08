-- Add custom_prompt column to user_progress table
-- This serves as the user's custom instructions / personal memory for the AI mentor,
-- mirroring ChatGPT's custom instructions / memory feature.

ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS custom_prompt text DEFAULT NULL;
