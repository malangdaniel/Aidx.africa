# AiDx Elite — Premium Health Coach

A self-contained feature module for AiDx that provides AI-powered personal health coaching, multi-parameter risk scoring, and intelligent alert escalation.

---

## Feature Overview

| Component | Description |
|-----------|-------------|
| **4 Health Indices** | Physiological Stability, Immune Activation, Cardiovascular Strain, Recovery Efficiency |
| **Vitals Sources** | Manual entry, Google Fit (REST), HealthKit (stub), device motion fallback |
| **AI Coaching** | Gemini-powered daily insights + follow-up Q&A (max 2 questions/day) |
| **Alert System** | Safety threshold monitoring → doctor escalation |
| **Weekly Report** | AI-generated executive summary (via Edge Function) |
| **Privacy** | Full RLS on all 5 tables; consent-first design |

---

## Environment Variables

Add to your `.env.local`:

```bash
# Enable the Elite feature (set to false to hide from all users)
VITE_ELITE_ENABLED=true

# Google Fit OAuth (for wearable sync)
VITE_GOOGLE_FIT_CLIENT_ID=your-google-oauth-client-id

# Supabase (already present in project)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Gemini (already present in project)
VITE_GEMINI_API_KEY=your-gemini-key
```

---

## Database Migration

Run the migration in Supabase Dashboard → SQL Editor, or with the CLI:

```bash
supabase db push
# or manually:
psql $DATABASE_URL -f supabase/migrations/20260221000000_add_elite_vitals_tables.sql
```

This creates five tables:

| Table | Purpose |
|-------|---------|
| `elite_vitals_raw` | Raw vitals from all sources |
| `elite_vitals_normalized` | Normalized & unit-converted values |
| `elite_baselines` | 7–14 day rolling personal baselines |
| `elite_scores` | Daily health indices (0–100) |
| `elite_alerts` | Safety threshold breaches |

All tables have Row Level Security — patients only see their own data.

---

## Deploying Edge Functions

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login & link project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets for edge functions
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Deploy all Elite functions
supabase functions deploy elite_ingest
supabase functions deploy compute_baseline
supabase functions deploy compute_scores
supabase functions deploy generate_report
```

### Edge Function Reference

| Function | Trigger | Description |
|----------|---------|-------------|
| `elite_ingest` | POST (from client) | Batch ingest raw vitals |
| `compute_baseline` | POST or cron | Compute 14-day personal baselines |
| `compute_scores` | POST or cron | Compute daily health indices + alerts |
| `generate_report` | POST (on-demand) | Generate weekly AI report via Gemini |

### Recommended CRON Schedule (Supabase Dashboard → Edge Functions → Schedules)

```
compute_baseline: 0 2 * * *    (2am daily)
compute_scores:   0 6 * * *    (6am daily)
```

---

## Google Fit OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Fitness API**
3. Create **OAuth 2.0 Credentials** → Web Application
4. Add authorized redirect URI: `https://yourdomain.com/integrations/google-fit/callback`
5. Add the client ID to `VITE_GOOGLE_FIT_CLIENT_ID`

The adapter in `src/adapters/googleFitAdapter.ts` handles the redirect flow automatically.

---

## HealthKit (iOS) Setup

> HealthKit requires a native Capacitor bridge. Web-only builds use the device motion fallback.

```bash
# Add Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init

# Add iOS
npx cap add ios

# Add HealthKit plugin
npm install @capacitor-community/health-kit
```

Then follow the comments in `src/adapters/healthkitAdapter.ts` to replace the stubs.

---

## Running Tests

> Requires Vitest + @testing-library/react

```bash
# Install test deps (if not yet installed)
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Run Elite tests
npx vitest run src/services/__tests__/EliteService.test.ts
npx vitest run src/components/elite/__tests__/AICoachCard.test.tsx
npx vitest run src/components/elite/__tests__/EliteDashboard.test.tsx

# Run all tests
npx vitest run
```

---

## Module File Structure

```
src/
├── adapters/
│   ├── healthkitAdapter.ts         # iOS HealthKit stub (Capacitor)
│   ├── googleFitAdapter.ts         # Google Fit REST API
│   └── fallbackDeviceEstimator.ts  # Device motion step counter
├── components/elite/
│   ├── AICoachCard.tsx             # Compact dashboard card
│   ├── EliteCoachChat.tsx          # Daily coaching chat widget
│   ├── EliteDashboard.tsx          # Full-page dashboard
│   ├── VitalsEntryForm.tsx         # Manual entry form
│   └── __tests__/
│       ├── AICoachCard.test.tsx
│       └── EliteDashboard.test.tsx
├── hooks/
│   └── useEliteVitals.ts           # Composite data + sync hook
├── services/
│   ├── EliteService.ts             # Core business logic
│   ├── elite/
│   │   ├── EliteApi.ts             # TanStack Query v5 hooks
│   │   └── elitePrompts.ts         # Gemini prompt templates
│   └── __tests__/
│       └── EliteService.test.ts
supabase/
├── migrations/
│   └── 20260221000000_add_elite_vitals_tables.sql
└── functions/
    ├── elite_ingest/index.ts
    ├── compute_baseline/index.ts
    ├── compute_scores/index.ts
    └── generate_report/index.ts
```

---

## Safety Guardrails

All AI-generated content follows these rules:
- ❌ No diagnostic language ("you have…")
- ✅ Coaching language ("may suggest…", "consider speaking with…")
- 🚨 Automatic escalation prompts for: SpO₂ < 92%, Temp ≥ 39°C, HR > 130 bpm
- 🔒 Clinical packets are doctor-facing and use objective clinical language

---

## Disabling the Feature

Set `VITE_ELITE_ENABLED=false` in `.env.local`. The Elite tab disappears from PatientDashboard and no API calls are made. No code removal needed.
