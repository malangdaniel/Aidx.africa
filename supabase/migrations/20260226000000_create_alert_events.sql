-- =============================================================================
-- AiDx Elite — Calibration & Safety Layer: Alert Events
-- Created: 2026-02-26
-- Description: Creates alert_events table for tracking, calibration, and feedback.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.alert_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric            TEXT,                -- e.g. 'heart_rate', 'spo2' (NULL for composite)
    severity          TEXT NOT NULL,       -- 'early_watch' | 'watch' | 'attention' | 'high' | 'critical'
    early_warning     BOOLEAN DEFAULT FALSE,
    confidence_score  NUMERIC DEFAULT 0,   -- ∈ [0,1]
    triggered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ,         -- NULL = active
    acknowledged_at   TIMESTAMPTZ,         -- NULL = unread/unseen
    feedback          TEXT CHECK (feedback IN ('helpful', 'not_helpful')),
    meta              JSONB DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup of active/recent alerts per user
CREATE INDEX IF NOT EXISTS idx_alert_events_user_triggered
    ON public.alert_events (user_id, triggered_at DESC);

-- Index for finding active alerts to resolve
CREATE INDEX IF NOT EXISTS idx_alert_events_active
    ON public.alert_events (user_id)
    WHERE resolved_at IS NULL;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_alert_events"
    ON public.alert_events
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "clinicians_read_alert_events"
    ON public.alert_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('doctor', 'admin')
        )
    );
