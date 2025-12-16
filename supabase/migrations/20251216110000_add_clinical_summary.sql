-- Add clinical_summary to patient_records
ALTER TABLE public.patient_records 
ADD COLUMN IF NOT EXISTS clinical_summary TEXT;
