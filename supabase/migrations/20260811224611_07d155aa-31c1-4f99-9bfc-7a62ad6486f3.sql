ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prescription_image_url text;

-- Storage policies for the private prescriptions bucket
DROP POLICY IF EXISTS "Users can upload own prescription files" ON storage.objects;
CREATE POLICY "Users can upload own prescription files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can view own prescription files" ON storage.objects;
CREATE POLICY "Users can view own prescription files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'prescriptions' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'pharmacist')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'doctor')
  )
);

DROP POLICY IF EXISTS "Users can update own prescription files" ON storage.objects;
CREATE POLICY "Users can update own prescription files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own prescription files" ON storage.objects;
CREATE POLICY "Users can delete own prescription files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);