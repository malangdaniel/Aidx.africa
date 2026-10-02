ALTER TABLE public.ai_diagnoses ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE INDEX IF NOT EXISTS idx_ai_diagnoses_user_session ON public.ai_diagnoses(user_id, session_id);