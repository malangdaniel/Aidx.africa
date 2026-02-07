-- Add missing columns to doctors table to support profile settings
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS consult_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS consultation_modes TEXT[] DEFAULT '{}';

-- Ensure RLS allows doctors to update their own record
DROP POLICY IF EXISTS "Doctors can update their own profile" ON public.doctors;
CREATE POLICY "Doctors can update their own profile" 
ON public.doctors FOR UPDATE 
USING (auth.uid() = user_id);

-- Ensure RLS allows doctors to insert their own record
DROP POLICY IF EXISTS "Doctors can insert their own profile" ON public.doctors;
CREATE POLICY "Doctors can insert their own profile" 
ON public.doctors FOR INSERT 
WITH CHECK (auth.uid() = user_id);
