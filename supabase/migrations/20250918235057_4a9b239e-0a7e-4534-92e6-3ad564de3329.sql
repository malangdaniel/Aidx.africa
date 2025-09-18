-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'pharmacist', 'admin');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE public.consultation_status AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'processing', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE public.severity_level AS ENUM ('mild', 'moderate', 'severe');
CREATE TYPE public.payout_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- Profiles table (core user data)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  verification_status verification_status DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  escrow_balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Doctors table
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  license_number TEXT,
  specialties TEXT[],
  consult_price DECIMAL(10,2) DEFAULT 0.00,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_consultations INTEGER DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pharmacies table
CREATE TABLE public.pharmacies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  address TEXT,
  location POINT,
  license_number TEXT,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drugs table
CREATE TABLE public.drugs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  prescription_required BOOLEAN DEFAULT false,
  image_url TEXT,
  category TEXT,
  manufacturer TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Chats table
CREATE TABLE public.ai_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT,
  original_language TEXT DEFAULT 'en',
  translated_message TEXT,
  translated_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Diagnoses table
CREATE TABLE public.ai_diagnoses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  diagnosis_data JSONB NOT NULL,
  condition TEXT,
  likelihood DECIMAL(5,2),
  confidence_percentage INTEGER,
  severity severity_level,
  rationale TEXT,
  recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Consultations table
CREATE TABLE public.consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status consultation_status DEFAULT 'scheduled',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  diagnosis TEXT,
  transcript JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Prescriptions table
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prescription_data JSONB NOT NULL,
  notes TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Carts table
CREATE TABLE public.carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cart Items table
CREATE TABLE public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders table (parent orders)
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  escrow_amount DECIMAL(10,2) DEFAULT 0.00,
  commission_amount DECIMAL(10,2) DEFAULT 0.00,
  status order_status DEFAULT 'pending',
  payment_reference TEXT,
  delivery_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order Items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES public.drugs(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Child Orders table (split by pharmacy)
CREATE TABLE public.child_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status order_status DEFAULT 'processing',
  tracking_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order History table (audit trail)
CREATE TABLE public.order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  child_order_id UUID REFERENCES public.child_orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payout Requests table
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  child_order_id UUID REFERENCES public.child_orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  commission DECIMAL(10,2) DEFAULT 0.00,
  net_amount DECIMAL(10,2) NOT NULL,
  status payout_status DEFAULT 'pending',
  payment_reference TEXT,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for wallets
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own wallet" ON public.wallets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own wallet" ON public.wallets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for doctors
CREATE POLICY "Anyone can view doctor profiles" ON public.doctors
  FOR SELECT USING (true);

CREATE POLICY "Doctors can update own profile" ON public.doctors
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Doctors can insert own profile" ON public.doctors
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for pharmacies
CREATE POLICY "Anyone can view pharmacy profiles" ON public.pharmacies
  FOR SELECT USING (true);

CREATE POLICY "Pharmacists can update own profile" ON public.pharmacies
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Pharmacists can insert own profile" ON public.pharmacies
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for drugs
CREATE POLICY "Anyone can view drugs" ON public.drugs
  FOR SELECT USING (true);

CREATE POLICY "Pharmacists can manage own drugs" ON public.drugs
  FOR ALL USING (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for AI chats
CREATE POLICY "Users can view own AI chats" ON public.ai_chats
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own AI chats" ON public.ai_chats
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for AI diagnoses
CREATE POLICY "Users can view own AI diagnoses" ON public.ai_diagnoses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own AI diagnoses" ON public.ai_diagnoses
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for consultations
CREATE POLICY "Patients and doctors can view their consultations" ON public.consultations
  FOR SELECT USING (patient_id = auth.uid() OR doctor_id = auth.uid());

CREATE POLICY "Patients can create consultations" ON public.consultations
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients and doctors can update their consultations" ON public.consultations
  FOR UPDATE USING (patient_id = auth.uid() OR doctor_id = auth.uid());

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('prescriptions', 'prescriptions', false),
  ('ids', 'ids', false),
  ('reports', 'reports', false),
  ('drug_images', 'drug_images', true);

-- Storage policies for prescriptions
CREATE POLICY "Users can view own prescriptions" ON storage.objects
  FOR SELECT USING (bucket_id = 'prescriptions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Doctors can upload prescriptions" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'prescriptions' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for IDs
CREATE POLICY "Users can view own IDs" ON storage.objects
  FOR SELECT USING (bucket_id = 'ids' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own IDs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ids' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for reports
CREATE POLICY "Users can view own reports" ON storage.objects
  FOR SELECT USING (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own reports" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for drug images
CREATE POLICY "Anyone can view drug images" ON storage.objects
  FOR SELECT USING (bucket_id = 'drug_images');

CREATE POLICY "Pharmacists can upload drug images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'drug_images');

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (user_id, role, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::app_role,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updating timestamps
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON public.pharmacies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON public.drugs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_child_orders_updated_at BEFORE UPDATE ON public.child_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();