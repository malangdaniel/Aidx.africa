-- Add medical demographics to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS blood_group TEXT;

-- Add AI fields to consultations
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS clinical_summary TEXT,
ADD COLUMN IF NOT EXISTS decision_support JSONB;
