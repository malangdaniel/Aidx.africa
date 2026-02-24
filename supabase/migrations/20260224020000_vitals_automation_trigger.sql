-- =============================================================================
-- Automated Vitals Scoring & Baseline Trigger
-- Created: 2026-02-24
-- Description: Automatically invokes Edge Functions for scoring and baselines
--              when new normalized vitals are inserted.
-- =============================================================================

-- 1. Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS net;

-- 2. Automation Function
CREATE OR REPLACE FUNCTION public.trigger_vitals_automation()
RETURNS trigger AS $$
DECLARE
  v_project_id text := 'hixxslbiovywojzzveqz'; -- From config.toml
  v_payload jsonb;
BEGIN
  -- Construct the payload
  v_payload := jsonb_build_object('userId', NEW.user_id);

  -- 1. Trigger Score Computation
  -- We use net.http_post for asynchronous, non-blocking execution.
  -- Authorization usually requires an 'apikey' (anon) or a Bearer token.
  -- In development, we might use a placeholder or assume the function handles public calls if configured.
  PERFORM net.http_post(
    url := 'https://' || v_project_id || '.supabase.co/functions/v1/compute_scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := v_payload
  );

  -- 2. Trigger Baseline Computation
  PERFORM net.http_post(
    url := 'https://' || v_project_id || '.supabase.co/functions/v1/compute_baseline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := v_payload
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. The Trigger
DROP TRIGGER IF EXISTS tr_vitals_automation ON public.elite_vitals_normalized;
CREATE TRIGGER tr_vitals_automation
  AFTER INSERT ON public.elite_vitals_normalized
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_vitals_automation();

COMMENT ON FUNCTION public.trigger_vitals_automation() IS 'Invokes compute_scores and compute_baseline Edge Functions for a user.';
