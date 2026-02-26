-- Create table for daily stability scores
CREATE TABLE IF NOT EXISTS public.daily_stability_scores (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date              DATE NOT NULL, -- Logical date of the score
    raw_score         NUMERIC NOT NULL,
    smoothed_score    NUMERIC NOT NULL,
    band              TEXT NOT NULL CHECK (band IN ('very_stable', 'stable', 'mild_instability', 'attention', 'high_risk')),
    meta              JSONB DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one score per user per day
    UNIQUE(user_id, date)
);

-- Index for efficient history fetching
CREATE INDEX IF NOT EXISTS idx_stability_scores_user_date
    ON public.daily_stability_scores (user_id, date DESC);

-- RLS Policies
ALTER TABLE public.daily_stability_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stability scores"
    ON public.daily_stability_scores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Clinicians can view patient stability scores"
    ON public.daily_stability_scores FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('doctor', 'pharmacist')
        )
    );
