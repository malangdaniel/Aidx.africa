-- Create Vitals Table
CREATE TABLE public.vitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  systolic INTEGER,
  diastolic INTEGER,
  heart_rate INTEGER,
  weight DECIMAL(5,2),
  temperature DECIMAL(4,1),
  oxygen_saturation INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for vitals
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vitals" ON public.vitals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own vitals" ON public.vitals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Doctors can view patient vitals" ON public.vitals
  FOR SELECT USING (
    EXISTS (
       SELECT 1 FROM public.consultations c
       WHERE c.patient_id = vitals.user_id 
       AND c.doctor_id = auth.uid()
    )
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'doctor' -- Broad access for now as per previous policy style
  );


-- Create Patient Records Table (Medical History)
CREATE TABLE public.patient_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Structured Data
  allergies TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  family_history TEXT[] DEFAULT '{}',
  
  -- JSONB for complex objects
  past_surgeries JSONB DEFAULT '[]'::jsonb, -- [{condition, details, year}]
  current_medications JSONB DEFAULT '[]'::jsonb, -- [{name, dosage, frequency}]
  social_history JSONB DEFAULT '{}'::jsonb, -- {smoker, smoker_details, alcohol, alcohol_details}
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for patient_records
ALTER TABLE public.patient_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records" ON public.patient_records
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own records" ON public.patient_records
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can insert own records" ON public.patient_records
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Doctors/Pharm can view patient records" ON public.patient_records
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('doctor', 'pharmacist')
  );

-- Trigger for timestamps
CREATE TRIGGER update_patient_records_updated_at 
BEFORE UPDATE ON public.patient_records 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
