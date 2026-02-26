-- Admin Analytics for Elite Health Alerts
-- -----------------------------------------------------------------------------
-- These queries provide insights into alert performance, noise levels, and calibration.

-- 1. Global Alert Accuracy (Helpful vs Not Helpful)
CREATE OR REPLACE VIEW public.alert_accuracy_stats AS
SELECT 
    metric,
    severity,
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE feedback = 'helpful') as helpful_count,
    COUNT(*) FILTER (WHERE feedback = 'not_helpful') as noisy_count,
    ROUND(
        (COUNT(*) FILTER (WHERE feedback = 'helpful')::numeric / 
        NULLIF(COUNT(*) FILTER (WHERE feedback IS NOT NULL), 0)) * 100, 
        2
    ) as helpful_ratio
FROM alert_events
GROUP BY metric, severity
ORDER BY total_alerts DESC;

-- 2. Average Time to Resolution (in hours)
CREATE OR REPLACE VIEW public.alert_resolution_stats AS
SELECT 
    metric,
    severity,
    COUNT(*) as resolved_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - triggered_at)) / 3600)::numeric, 2) as avg_hours_to_resolve
FROM alert_events
WHERE resolved_at IS NOT NULL
GROUP BY metric, severity;

-- 3. Daily Alert Frequency (last 30 days)
CREATE OR REPLACE VIEW public.alert_daily_frequency AS
SELECT 
    triggered_at::date as alert_date,
    severity,
    COUNT(*) as alert_count
FROM alert_events
WHERE triggered_at >= NOW() - INTERVAL '30 days'
GROUP BY alert_date, severity
ORDER BY alert_date DESC;

-- 4. User-Specific Alert Noise (Top noisy users for tuning)
CREATE OR REPLACE VIEW public.user_alert_noise_stats AS
SELECT 
    user_id,
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE feedback = 'not_helpful') as noisy_count,
    ROUND(
        (COUNT(*) FILTER (WHERE feedback = 'not_helpful')::numeric / 
        NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as noise_percentage
FROM alert_events
GROUP BY user_id
HAVING COUNT(*) > 5
ORDER BY noise_percentage DESC;

-- 5. Resolution Efficiency (Normal readings vs manual closure)
-- Note: 'resolved_at' set by the Edge Function vs 'acknowledged_at' (manual)
SELECT 
    metric,
    COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) as auto_resolved,
    COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL) as manually_acknowledged
FROM alert_events
GROUP BY metric;
