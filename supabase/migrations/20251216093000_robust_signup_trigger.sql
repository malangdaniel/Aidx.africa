-- Comprehensive Fix for Signup Issues

-- 1. Ensure RLS Policy is non-recursive and correct
DROP POLICY IF EXISTS "Medical staff can view all profiles" ON public.profiles;

CREATE POLICY "Medical staff and admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('doctor', 'pharmacist', 'admin')
);

-- 2. Refine the Signup Trigger Logic to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role public.app_role;
  v_role_str text;
BEGIN
  -- Safely extract and normalize role
  v_role_str := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'patient'));
  
  -- Validation fallback
  IF v_role_str NOT IN ('patient', 'doctor', 'pharmacist', 'admin') THEN
    v_role_str := 'patient';
  END IF;
  
  v_role := v_role_str::public.app_role;

  -- Insert into profiles
  INSERT INTO public.profiles (user_id, role, first_name, last_name)
  VALUES (
    NEW.id,
    v_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Insert into wallets (if table exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets') THEN
      INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  END IF;
  
  -- Insert role-specific tables
  IF (v_role = 'doctor') THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  ELSIF (v_role = 'pharmacist') THEN
    INSERT INTO public.pharmacies (user_id, business_name) 
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', 'Unnamed Pharmacy'));
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log validation or insertion error (visible in Supabase logs)
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    -- Reraise to fail the signup so we don't end up with inconsistent state
    RAISE; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Ensure Trigger is linked
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
