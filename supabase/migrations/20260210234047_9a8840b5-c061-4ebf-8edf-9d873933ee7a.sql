-- Allow all authenticated users to view basic profile info of doctors
-- This is needed so patients can see doctor names when searching
CREATE POLICY "Authenticated users can view doctor profiles"
ON public.profiles
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND user_id IN (SELECT user_id FROM public.doctors)
);
