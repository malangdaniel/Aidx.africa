-- Ensure Vitals Table exists with correct schema and RLS
CREATE TABLE IF NOT EXISTS public.vitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  systolic INTEGER,
  diastolic INTEGER,
  heart_rate INTEGER,
  weight DECIMAL(5,2),
  temperature DECIMAL(4,1),
  oxygen_saturation INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own vitals" ON public.vitals;
DROP POLICY IF EXISTS "Users can insert own vitals" ON public.vitals;
DROP POLICY IF EXISTS "Doctors can view patient vitals" ON public.vitals;

-- Recreate policies
CREATE POLICY "Users can view own vitals" ON public.vitals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own vitals" ON public.vitals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Doctors can view patient vitals" ON public.vitals
  FOR SELECT USING (
    EXISTS (
       SELECT 1 FROM public.consultations c
       WHERE c.patient_id = vitals.user_id 
       AND c.doctor_id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor'
  );

-- Ensure we have the foreign key to profiles if possible (for PostgREST joins)
-- This is optional but helpful for the types skip
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vitals_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.vitals 
    ADD CONSTRAINT vitals_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;
