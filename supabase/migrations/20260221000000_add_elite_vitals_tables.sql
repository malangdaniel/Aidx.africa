-- =============================================================================
-- AiDx Elite — Premium Health Coach: Database Migration
-- Created: 2026-02-21
-- Description: Creates elite vitals tracking tables with RLS and indexes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. elite_vitals_raw
--    Stores every incoming data point as recorded (pre-normalization).
--    Sources: 'manual' | 'healthkit' | 'google_fit' | 'device_estimate'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elite_vitals_raw (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric        TEXT NOT NULL,        -- e.g. 'heart_rate', 'spo2', 'temperature'
    value         NUMERIC NOT NULL,
    unit          TEXT NOT NULL,        -- e.g. 'bpm', '%', '°C', 'mmHg', 'kg'
    timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source        TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'healthkit' | 'google_fit' | 'device_estimate'
    confidence    NUMERIC NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    meta          JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-series index (primary query pattern: user + time window)
CREATE INDEX IF NOT EXISTS idx_elite_vitals_raw_user_ts
    ON public.elite_vitals_raw (user_id, timestamp DESC);

-- Metric-specific queries
CREATE INDEX IF NOT EXISTS idx_elite_vitals_raw_user_metric_ts
    ON public.elite_vitals_raw (user_id, metric, timestamp DESC);

-- ---------------------------------------------------------------------------
-- 2. elite_vitals_normalized
--    Stores cleaned, unit-standardized values with rolling stats.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elite_vitals_normalized (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_id            UUID NOT NULL REFERENCES public.elite_vitals_raw(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric            TEXT NOT NULL,
    normalized_value  NUMERIC NOT NULL,
    normalized_unit   TEXT NOT NULL,
    timestamp         TIMESTAMPTZ NOT NULL,
    rolling_mean_24h  NUMERIC,           -- rolling mean of prior 24h for this metric
    rolling_sd_24h    NUMERIC,           -- rolling std dev of prior 24h
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elite_vitals_norm_user_ts
    ON public.elite_vitals_normalized (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_elite_vitals_norm_user_metric_ts
    ON public.elite_vitals_normalized (user_id, metric, timestamp DESC);

-- ---------------------------------------------------------------------------
-- 3. elite_baselines
--    Personal baseline per user per metric (7-14 day warm-up, monthly update).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elite_baselines (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric         TEXT NOT NULL,
    baseline_mean  NUMERIC NOT NULL,
    baseline_sd    NUMERIC NOT NULL DEFAULT 0,
    sample_count   INTEGER NOT NULL DEFAULT 0,
    last_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, metric)
);

CREATE INDEX IF NOT EXISTS idx_elite_baselines_user
    ON public.elite_baselines (user_id);

-- ---------------------------------------------------------------------------
-- 4. elite_scores
--    Daily computed health indices per user.
--    Scores are 0-100, confidence_json holds per-index confidence values.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elite_scores (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score_date                DATE NOT NULL,
    physiological_stability   NUMERIC CHECK (physiological_stability BETWEEN 0 AND 100),
    immune_activation         NUMERIC CHECK (immune_activation BETWEEN 0 AND 100),
    cardiovascular_strain     NUMERIC CHECK (cardiovascular_strain BETWEEN 0 AND 100),
    recovery_efficiency       NUMERIC CHECK (recovery_efficiency BETWEEN 0 AND 100),
    confidence_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
    computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_elite_scores_user_date
    ON public.elite_scores (user_id, score_date DESC);

-- ---------------------------------------------------------------------------
-- 5. elite_alerts
--    Safety threshold violations and their resolution state.
--    alert_level: 'low' | 'medium' | 'high' | 'critical'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elite_alerts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score_id     UUID REFERENCES public.elite_scores(id) ON DELETE SET NULL,
    alert_level  TEXT NOT NULL CHECK (alert_level IN ('low','medium','high','critical')),
    metric       TEXT,            -- the specific metric that triggered the alert
    reason       TEXT NOT NULL,   -- human-readable explanation
    payload      JSONB DEFAULT '{}'::jsonb,  -- full clinical packet JSON
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMPTZ     -- NULL = still active
);

CREATE INDEX IF NOT EXISTS idx_elite_alerts_user_active
    ON public.elite_alerts (user_id, created_at DESC)
    WHERE resolved_at IS NULL;

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.elite_vitals_raw        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_vitals_normalized ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_baselines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elite_alerts            ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- elite_vitals_raw: patients see their own; clinicians see their patients
-- ---------------------------------------------------------------------------
CREATE POLICY "patients_own_raw_vitals"
    ON public.elite_vitals_raw
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "clinicians_read_raw_vitals"
    ON public.elite_vitals_raw
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('doctor', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- elite_vitals_normalized: same pattern
-- ---------------------------------------------------------------------------
CREATE POLICY "patients_own_norm_vitals"
    ON public.elite_vitals_normalized
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "clinicians_read_norm_vitals"
    ON public.elite_vitals_normalized
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('doctor', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- elite_baselines
-- ---------------------------------------------------------------------------
CREATE POLICY "patients_own_baselines"
    ON public.elite_baselines
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "clinicians_read_baselines"
    ON public.elite_baselines
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('doctor', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- elite_scores
-- ---------------------------------------------------------------------------
CREATE POLICY "patients_own_scores"
    ON public.elite_scores
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "clinicians_read_scores"
    ON public.elite_scores
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('doctor', 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- elite_alerts
-- ---------------------------------------------------------------------------
CREATE POLICY "patients_own_alerts"
    ON public.elite_alerts
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "clinicians_read_alerts"
    ON public.elite_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('doctor', 'admin')
        )
    );
