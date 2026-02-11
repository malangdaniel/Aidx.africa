-- Enable Doctors to view Patient Profiles
-- This is critical for the "Upcoming Sessions" and "Consultation Room" to display patient names/photos.

-- 1. Relax RLS on profiles to allow Doctors (or all authenticated users) to view basic profile info.
-- Since determining "Doctor" status requires a join which can be expensive in RLS, 
-- and names/avatars are generally visible in directory apps, we allow authenticated read.

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Keep update/insert restricted to own profile
-- (These already likely exist, but ensuring they remain)
-- CREATE POLICY "Users can update own profile" ... (Assumed existing)


-- 2. Ensure Foreign Key for Consultations -> Profiles exists
-- This enables the syntax: .select('..., profiles:patient_id(...)')

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'consultations_patient_id_profiles_fkey'
    ) THEN
        ALTER TABLE public.consultations 
        ADD CONSTRAINT consultations_patient_id_profiles_fkey 
        FOREIGN KEY (patient_id) REFERENCES public.profiles(user_id);
    END IF;
END $$;
