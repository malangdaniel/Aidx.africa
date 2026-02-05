-- Migration to add missing foreign key relationships to the profiles table
-- This enables Supabase/PostgREST to perform auto-joins between these tables and profiles.

-- 1. Ensure doctors table joins correctly
ALTER TABLE public.doctors 
DROP CONSTRAINT IF EXISTS doctors_user_id_profiles_fkey,
ADD CONSTRAINT doctors_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 2. Ensure pharmacies table joins correctly
ALTER TABLE public.pharmacies 
DROP CONSTRAINT IF EXISTS pharmacies_user_id_profiles_fkey,
ADD CONSTRAINT pharmacies_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 3. Ensure consultations table joins correctly for both patient and doctor
ALTER TABLE public.consultations 
DROP CONSTRAINT IF EXISTS consultations_patient_id_profiles_fkey,
DROP CONSTRAINT IF EXISTS consultations_doctor_id_profiles_fkey,
ADD CONSTRAINT consultations_patient_id_profiles_fkey 
FOREIGN KEY (patient_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE,
ADD CONSTRAINT consultations_doctor_id_profiles_fkey 
FOREIGN KEY (doctor_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 4. Ensure prescriptions table joins correctly
ALTER TABLE public.prescriptions 
DROP CONSTRAINT IF EXISTS prescriptions_patient_id_profiles_fkey,
DROP CONSTRAINT IF EXISTS prescriptions_doctor_id_profiles_fkey,
ADD CONSTRAINT prescriptions_patient_id_profiles_fkey 
FOREIGN KEY (patient_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE,
ADD CONSTRAINT prescriptions_doctor_id_profiles_fkey 
FOREIGN KEY (doctor_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 5. Ensure user_roles table joins correctly
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_profiles_fkey,
ADD CONSTRAINT user_roles_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 6. Ensure wallets table joins correctly
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_user_id_profiles_fkey,
ADD CONSTRAINT wallets_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 7. Ensure AI related tables join correctly
ALTER TABLE public.ai_chats 
DROP CONSTRAINT IF EXISTS ai_chats_user_id_profiles_fkey,
ADD CONSTRAINT ai_chats_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

ALTER TABLE public.ai_diagnoses 
DROP CONSTRAINT IF EXISTS ai_diagnoses_user_id_profiles_fkey,
ADD CONSTRAINT ai_diagnoses_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 8. Ensure orders join correctly
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_user_id_profiles_fkey,
ADD CONSTRAINT orders_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;
