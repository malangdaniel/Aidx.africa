DO $$ BEGIN
  CREATE TYPE public.consultation_payment_status AS ENUM ('pending','escrowed','released','refunded','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS payment_status public.consultation_payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS escrow_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS consultations_payment_status_idx ON public.consultations (payment_status);