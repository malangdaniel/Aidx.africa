-- Create consultation_chat_messages table for P2P chat
CREATE TABLE public.consultation_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lab_orders table
CREATE TABLE public.lab_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  urgency TEXT DEFAULT 'routine', -- routine, urgent, stat
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, cancelled
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consultation_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consultation_chat_messages
CREATE POLICY "Participants can view messages" ON public.consultation_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_chat_messages.consultation_id
      AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
    )
  );

CREATE POLICY "Participants can insert messages" ON public.consultation_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = consultation_chat_messages.consultation_id
      AND (c.patient_id = auth.uid() OR c.doctor_id = auth.uid())
    )
    AND sender_id = auth.uid()
  );

-- RLS Policies for lab_orders
CREATE POLICY "Participants can view lab orders" ON public.lab_orders
  FOR SELECT USING (
    patient_id = auth.uid() OR doctor_id = auth.uid()
  );

CREATE POLICY "Doctors can create lab orders" ON public.lab_orders
  FOR INSERT WITH CHECK (
    doctor_id = auth.uid()
  );

CREATE POLICY "Doctors can update their lab orders" ON public.lab_orders
  FOR UPDATE USING (
    doctor_id = auth.uid()
  );
