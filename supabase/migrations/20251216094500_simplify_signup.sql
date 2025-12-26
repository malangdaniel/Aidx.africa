-- Simplify Signup Trigger to bare essentials to fix 500 error

-- 1. CLEANUP: Drop existing objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. DEFINE FUNCTION: Straightforward inserts, no dynamic checks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role public.app_role;
  v_role_str text;
BEGIN
  -- Safely extract and normalize role to lowercase
  v_role_str := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'patient'));
  
  -- Validation fallback to ensure it matches the enum
  IF v_role_str NOT IN ('patient', 'doctor', 'pharmacist', 'admin') THEN
    v_role_str := 'patient';
  END IF;
  
  v_role := v_role_str::public.app_role;

  -- 1. Insert into profiles (most critical)
  INSERT INTO public.profiles (user_id, role, first_name, last_name)
  VALUES (
    NEW.id,
    v_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );

  -- 2. Sync with user_roles table (important for role-based logic)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Rest of the initialization
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  
  IF (v_role = 'doctor') THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  ELSIF (v_role = 'pharmacist') THEN
    INSERT INTO public.pharmacies (user_id, business_name) 
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', 'Pharmacy'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. RECREATE TRIGGER
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
