-- Simplify Signup Trigger to bare essentials to fix 500 error

-- 1. CLEANUP: Drop existing objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. DEFINE FUNCTION: Straightforward inserts, no dynamic checks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles is the most critical
  -- We default to 'patient' if the role is missing or invalid to avoid cast errors
  BEGIN
    INSERT INTO public.profiles (user_id, role, first_name, last_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::public.app_role,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: If enum cast fails, force patient
    INSERT INTO public.profiles (user_id, role, first_name, last_name)
    VALUES (
      NEW.id,
      'patient'::public.app_role,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name'
    );
  END;

  -- Insert into wallets (We assume table exists as per schema)
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  
  -- Role specific inserts
  IF (NEW.raw_user_meta_data->>'role' = 'doctor') THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  ELSIF (NEW.raw_user_meta_data->>'role' = 'pharmacist') THEN
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
