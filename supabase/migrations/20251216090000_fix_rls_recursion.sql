-- Fix Infinite Recursion in RLS Policy
-- Drop the buggy policy
DROP POLICY IF EXISTS "Medical staff can view all profiles" ON public.profiles;

-- Create the fixed policy using JWT metadata to avoid self-referencing query
CREATE POLICY "Medical staff can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('doctor', 'pharmacist')
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Ensure the other policy is efficient too (though it was safe)
-- "Patients can view medical staff profiles" only checks row columns, so it is safe.
