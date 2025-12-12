-- 1. Create user_roles table (roles should NOT be in profiles table)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- Only admins can manage roles (no direct user access)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.get_current_user_role() = 'admin');

-- 2. Create security definer function to check roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. Update get_current_user_role to use new table
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 4. Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Update handle_new_user trigger to insert into user_roles instead
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles (without role)
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Insert role into separate user_roles table (default to patient for safety)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');
  
  -- Insert into wallets
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  
  -- Insert role-specific tables
  IF (NEW.raw_user_meta_data->>'role' = 'doctor') THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  ELSIF (NEW.raw_user_meta_data->>'role' = 'pharmacist') THEN
    INSERT INTO public.pharmacies (user_id, business_name) 
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'business_name', 'Unnamed Pharmacy'));
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Fix drug_images storage policy - require pharmacist role
DROP POLICY IF EXISTS "Pharmacists can upload drug images" ON storage.objects;

CREATE POLICY "Pharmacists can upload drug images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'drug_images' 
  AND public.get_current_user_role() = 'pharmacist'
);

-- 7. Add policy for pharmacists to update/delete their own drug images
CREATE POLICY "Pharmacists can manage drug images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'drug_images' 
  AND public.get_current_user_role() = 'pharmacist'
);