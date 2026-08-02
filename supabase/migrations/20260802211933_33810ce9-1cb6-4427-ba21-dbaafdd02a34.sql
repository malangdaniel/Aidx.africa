ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS physical_exam text,
  ADD COLUMN IF NOT EXISTS differential_diagnosis text,
  ADD COLUMN IF NOT EXISTS referral text,
  ADD COLUMN IF NOT EXISTS follow_up_plan text,
  ADD COLUMN IF NOT EXISTS symptom_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS finalized_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.is_treating_doctor(_doctor_id uuid, _patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultations c
    WHERE c.doctor_id = _doctor_id
      AND c.patient_id = _patient_id
  )
$$;

DROP POLICY IF EXISTS "Treating doctors can view patient consultation history" ON public.consultations;
CREATE POLICY "Treating doctors can view patient consultation history"
ON public.consultations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'doctor') AND public.is_treating_doctor(auth.uid(), patient_id));

DROP POLICY IF EXISTS "Treating doctors can view patient prescriptions" ON public.prescriptions;
CREATE POLICY "Treating doctors can view patient prescriptions"
ON public.prescriptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'doctor') AND public.is_treating_doctor(auth.uid(), patient_id));

DROP POLICY IF EXISTS "Treating doctors can view patient lab orders" ON public.lab_orders;
CREATE POLICY "Treating doctors can view patient lab orders"
ON public.lab_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'doctor') AND EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = lab_orders.patient_id
    AND public.is_treating_doctor(auth.uid(), p.user_id)
));