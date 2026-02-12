-- Create lab_orders table for storing diagnostic test orders
CREATE TABLE IF NOT EXISTS public.lab_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    urgency TEXT CHECK (urgency IN ('routine', 'urgent', 'stat')) DEFAULT 'routine',
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    results TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_lab_orders_consultation ON public.lab_orders(consultation_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON public.lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor ON public.lab_orders(doctor_id);

-- Enable RLS
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Doctors can view lab orders for their consultations
CREATE POLICY "Doctors can view their lab orders"
    ON public.lab_orders
    FOR SELECT
    USING (
        auth.uid() = doctor_id
    );

-- Patients can view their own lab orders
CREATE POLICY "Patients can view their lab orders"
    ON public.lab_orders
    FOR SELECT
    USING (
        auth.uid() = patient_id
    );

-- Doctors can insert lab orders
CREATE POLICY "Doctors can create lab orders"
    ON public.lab_orders
    FOR INSERT
    WITH CHECK (
        auth.uid() = doctor_id
    );

-- Doctors can update their lab orders
CREATE POLICY "Doctors can update their lab orders"
    ON public.lab_orders
    FOR UPDATE
    USING (
        auth.uid() = doctor_id
    );
