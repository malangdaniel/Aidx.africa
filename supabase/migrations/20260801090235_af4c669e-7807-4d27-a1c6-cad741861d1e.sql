CREATE UNIQUE INDEX IF NOT EXISTS consultations_doctor_slot_unique
ON public.consultations (doctor_id, scheduled_at)
WHERE scheduled_at IS NOT NULL AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.get_doctor_booked_slots(_doctor_id uuid, _day date)
RETURNS TABLE (scheduled_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.scheduled_at
  FROM public.consultations c
  WHERE c.doctor_id = _doctor_id
    AND c.scheduled_at IS NOT NULL
    AND (c.status IS NULL OR c.status <> 'cancelled')
    AND c.scheduled_at >= _day::timestamptz
    AND c.scheduled_at < (_day + 1)::timestamptz
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_booked_slots(uuid, date) TO authenticated;