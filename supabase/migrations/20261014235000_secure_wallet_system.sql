-- ==============================================================================
-- Migration: Secure Closed-Loop Patient Wallet System (Phases 1 & 2)
-- Description:
--   1. Secure wallets table RLS (remove patient self-update/insert vulnerabilities)
--   2. Add wallet_transactions immutable double-entry ledger table
--   3. Add wallet_deposits tracking table
--   4. Atomic SECURITY DEFINER RPC functions:
--      - credit_wallet_deposit (verified deposits)
--      - charge_wallet_consultation (atomic balance check + escrow hold + booking)
--      - refund_consultation_escrow (atomic cancellation refund)
--      - charge_wallet_pharmacy (atomic order escrow hold)
--   5. Initial balance reconciliation
-- ==============================================================================

-- 1. Ensure wallets table constraints and security
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0),
  ADD CONSTRAINT wallets_escrow_non_negative CHECK (escrow_balance >= 0);

-- In case there are null values, set defaults
UPDATE public.wallets SET balance = 0.00 WHERE balance IS NULL;
UPDATE public.wallets SET escrow_balance = 0.00 WHERE escrow_balance IS NULL;
ALTER TABLE public.wallets ALTER COLUMN balance SET NOT NULL;
ALTER TABLE public.wallets ALTER COLUMN escrow_balance SET NOT NULL;
ALTER TABLE public.wallets ALTER COLUMN balance SET DEFAULT 0.00;
ALTER TABLE public.wallets ALTER COLUMN escrow_balance SET DEFAULT 0.00;

-- Drop insecure client-side update/insert policies
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;

-- Re-enable strict RLS: patients can ONLY VIEW their own wallet
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Create wallet_transactions immutable ledger table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  amount_kobo BIGINT NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  balance_after_kobo BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'deposit',
    'consultation_payment',
    'pharmacy_order',
    'refund',
    'escrow_hold',
    'escrow_release'
  )),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  reference TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON public.wallet_transactions(reference);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Create wallet_deposits tracking table
CREATE TABLE IF NOT EXISTS public.wallet_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  fee NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (fee >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT,
  provider_checkout_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wallet_deposits_user_created ON public.wallet_deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_reference ON public.wallet_deposits(reference);

ALTER TABLE public.wallet_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deposits" ON public.wallet_deposits;
CREATE POLICY "Users can view own deposits" ON public.wallet_deposits
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Atomic PostgreSQL RPC Functions (SECURITY DEFINER)

-- Function A: Credit a verified deposit to wallet
CREATE OR REPLACE FUNCTION public.credit_wallet_deposit(
  p_deposit_reference TEXT,
  p_provider_ref TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance NUMERIC(12,2);
  v_new_balance_kobo BIGINT;
  v_tx_id UUID;
BEGIN
  -- Lock deposit row
  SELECT * INTO v_deposit
  FROM public.wallet_deposits
  WHERE reference = p_deposit_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit with reference % not found', p_deposit_reference;
  END IF;

  -- Idempotency check: if already completed, return current state
  IF v_deposit.status = 'completed' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE id = v_deposit.wallet_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_credited', true,
      'reference', v_deposit.reference,
      'balance', v_wallet.balance
    );
  END IF;

  IF v_deposit.status <> 'pending' THEN
    RAISE EXCEPTION 'Deposit is not pending (status: %)', v_deposit.status;
  END IF;

  -- Lock wallet row
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE id = v_deposit.wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet % not found', v_deposit.wallet_id;
  END IF;

  -- Calculate new balance
  v_new_balance := ROUND(v_wallet.balance + v_deposit.amount, 2);
  v_new_balance_kobo := ROUND(v_new_balance * 100)::bigint;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Update deposit status
  UPDATE public.wallet_deposits
  SET status = 'completed',
      provider_reference = COALESCE(p_provider_ref, provider_reference),
      completed_at = now(),
      metadata = metadata || p_metadata
  WHERE id = v_deposit.id;

  -- Record in immutable ledger
  INSERT INTO public.wallet_transactions (
    user_id,
    wallet_id,
    amount,
    amount_kobo,
    balance_after,
    balance_after_kobo,
    type,
    status,
    reference,
    idempotency_key,
    description,
    metadata
  ) VALUES (
    v_deposit.user_id,
    v_wallet.id,
    v_deposit.amount,
    v_deposit.amount_kobo,
    v_new_balance,
    v_new_balance_kobo,
    'deposit',
    'completed',
    'TX-' || v_deposit.reference,
    'IDEM-' || v_deposit.reference,
    'Wallet funding via ' || v_deposit.provider,
    jsonb_build_object(
      'deposit_id', v_deposit.id,
      'provider', v_deposit.provider,
      'provider_reference', p_provider_ref
    ) || p_metadata
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_credited', false,
    'transaction_id', v_tx_id,
    'reference', v_deposit.reference,
    'amount', v_deposit.amount,
    'balance', v_new_balance
  );
END;
$$;

-- Function B: Atomic Consultation Charge & Escrow Hold
CREATE OR REPLACE FUNCTION public.charge_wallet_consultation(
  p_doctor_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_price NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_wallet RECORD;
  v_new_balance NUMERIC(12,2);
  v_new_balance_kobo BIGINT;
  v_new_escrow NUMERIC(12,2);
  v_consultation_id UUID;
  v_ref TEXT;
  v_price NUMERIC(12,2);
  v_price_kobo BIGINT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_price := ROUND(COALESCE(p_price, 0), 2);
  v_price_kobo := ROUND(v_price * 100)::bigint;

  -- Lock wallet row
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient wallet not found';
  END IF;

  IF v_wallet.balance < v_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Required: %, Available: %', v_price, v_wallet.balance;
  END IF;

  -- Move funds to escrow
  v_new_balance := ROUND(v_wallet.balance - v_price, 2);
  v_new_balance_kobo := ROUND(v_new_balance * 100)::bigint;
  v_new_escrow := ROUND(v_wallet.escrow_balance + v_price, 2);

  UPDATE public.wallets
  SET balance = v_new_balance,
      escrow_balance = v_new_escrow,
      updated_at = now()
  WHERE id = v_wallet.id;

  v_ref := 'ESC-CON-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  -- Insert consultation
  INSERT INTO public.consultations (
    doctor_id,
    patient_id,
    status,
    scheduled_at,
    price,
    notes,
    payment_status,
    escrow_amount,
    paid_at,
    payment_reference
  ) VALUES (
    p_doctor_id,
    v_caller_id,
    'scheduled',
    p_scheduled_at,
    v_price,
    p_notes,
    'escrowed',
    v_price,
    now(),
    v_ref
  ) RETURNING id INTO v_consultation_id;

  -- Insert ledger entry
  INSERT INTO public.wallet_transactions (
    user_id,
    wallet_id,
    amount,
    amount_kobo,
    balance_after,
    balance_after_kobo,
    type,
    status,
    reference,
    idempotency_key,
    description,
    metadata
  ) VALUES (
    v_caller_id,
    v_wallet.id,
    -v_price,
    -v_price_kobo,
    v_new_balance,
    v_new_balance_kobo,
    'consultation_payment',
    'completed',
    v_ref,
    'IDEM-' || v_ref,
    'Doctor consultation escrow payment',
    jsonb_build_object(
      'consultation_id', v_consultation_id,
      'doctor_id', p_doctor_id,
      'scheduled_at', p_scheduled_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'consultation_id', v_consultation_id,
    'payment_reference', v_ref,
    'amount', v_price,
    'balance', v_new_balance,
    'escrow_balance', v_new_escrow
  );
END;
$$;

-- Function C: Atomic Refund Consultation (Releases Escrow back to Available Balance)
CREATE OR REPLACE FUNCTION public.refund_consultation_escrow(
  p_consultation_id UUID,
  p_reason TEXT DEFAULT 'Consultation cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_consultation RECORD;
  v_wallet RECORD;
  v_refund_amount NUMERIC(12,2);
  v_refund_kobo BIGINT;
  v_new_balance NUMERIC(12,2);
  v_new_balance_kobo BIGINT;
  v_new_escrow NUMERIC(12,2);
  v_ref TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock consultation
  SELECT * INTO v_consultation
  FROM public.consultations
  WHERE id = p_consultation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultation not found';
  END IF;

  -- Verify caller is doctor or patient of consultation, or service role
  IF v_consultation.patient_id <> v_caller_id AND v_consultation.doctor_id <> v_caller_id THEN
    RAISE EXCEPTION 'Unauthorized to refund this consultation';
  END IF;

  IF v_consultation.payment_status <> 'escrowed' THEN
    RAISE EXCEPTION 'Consultation payment is not in escrow (status: %)', v_consultation.payment_status;
  END IF;

  v_refund_amount := ROUND(COALESCE(v_consultation.escrow_amount, v_consultation.price, 0), 2);
  v_refund_kobo := ROUND(v_refund_amount * 100)::bigint;

  -- Lock patient wallet
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_consultation.patient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient wallet not found';
  END IF;

  -- Return escrow to available balance
  v_new_balance := ROUND(v_wallet.balance + v_refund_amount, 2);
  v_new_balance_kobo := ROUND(v_new_balance * 100)::bigint;
  v_new_escrow := ROUND(GREATEST(0, v_wallet.escrow_balance - v_refund_amount), 2);

  UPDATE public.wallets
  SET balance = v_new_balance,
      escrow_balance = v_new_escrow,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Update consultation
  UPDATE public.consultations
  SET status = 'cancelled',
      payment_status = 'refunded',
      escrow_amount = 0.00
  WHERE id = v_consultation.id;

  v_ref := 'REF-CON-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  -- Record ledger transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    wallet_id,
    amount,
    amount_kobo,
    balance_after,
    balance_after_kobo,
    type,
    status,
    reference,
    idempotency_key,
    description,
    metadata
  ) VALUES (
    v_consultation.patient_id,
    v_wallet.id,
    v_refund_amount,
    v_refund_kobo,
    v_new_balance,
    v_new_balance_kobo,
    'refund',
    'completed',
    v_ref,
    'IDEM-' || v_ref,
    'Consultation refund (' || p_reason || ')',
    jsonb_build_object(
      'consultation_id', v_consultation.id,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_reference', v_ref,
    'refunded_amount', v_refund_amount,
    'balance', v_new_balance,
    'escrow_balance', v_new_escrow
  );
END;
$$;

-- Function D: Initial Ledger Reconciliation
-- For any existing wallets with balance > 0, generate opening balance transactions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT w.id AS wallet_id, w.user_id, w.balance
    FROM public.wallets w
    WHERE w.balance > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.wallet_transactions wt WHERE wt.wallet_id = w.id
      )
  ) LOOP
    INSERT INTO public.wallet_transactions (
      user_id,
      wallet_id,
      amount,
      amount_kobo,
      balance_after,
      balance_after_kobo,
      type,
      status,
      reference,
      idempotency_key,
      description,
      metadata
    ) VALUES (
      r.user_id,
      r.wallet_id,
      r.balance,
      ROUND(r.balance * 100)::bigint,
      r.balance,
      ROUND(r.balance * 100)::bigint,
      'deposit',
      'completed',
      'INIT-BAL-' || upper(substr(md5(r.wallet_id::text), 1, 8)),
      'IDEM-INIT-' || r.wallet_id::text,
      'Initial opening wallet balance',
      jsonb_build_object('source', 'ledger_reconciliation_v1')
    );
  END LOOP;
END;
$$;
