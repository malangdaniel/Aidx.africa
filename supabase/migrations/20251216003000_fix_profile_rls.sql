-- Allow doctors and pharmacists to view all profiles (to see patients)
CREATE POLICY "Medical staff can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.profiles 
    WHERE role IN ('doctor', 'pharmacist')
  )
);

-- Allow patients to view doctor and pharmacist profiles (for search)
CREATE POLICY "Patients can view medical staff profiles"
ON public.profiles
FOR SELECT
USING (
   role IN ('doctor', 'pharmacist')
);

-- Note: The existing "Users can view own profile" covers self-viewing.
-- These additions ensure cross-role visibility needed for the app.
