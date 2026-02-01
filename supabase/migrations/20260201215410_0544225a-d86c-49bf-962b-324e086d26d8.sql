-- Fix role assignment on signup: use raw_user_meta_data.role instead of always 'patient'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  selected_role public.app_role;
BEGIN
  -- Normalize/validate role from metadata (defensive default to patient)
  selected_role := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'role', '') IN ('patient', 'doctor', 'pharmacist', 'admin')
      THEN (NEW.raw_user_meta_data->>'role')::public.app_role
    ELSE 'patient'::public.app_role
  END;

  -- Insert into profiles (without role)
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );

  -- Insert role into separate user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, selected_role);

  -- Insert into wallets
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  -- Insert role-specific tables
  IF (selected_role = 'doctor') THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  ELSIF (selected_role = 'pharmacist') THEN
    INSERT INTO public.pharmacies (user_id, business_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', 'Unnamed Pharmacy'));
  END IF;

  RETURN NEW;
END;
$$;