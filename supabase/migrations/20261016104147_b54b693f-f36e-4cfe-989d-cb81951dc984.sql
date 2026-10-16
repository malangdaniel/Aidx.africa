ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unknown', ADD COLUMN IF NOT EXISTS delivery_instructions text;
ALTER TABLE public.child_orders ADD COLUMN IF NOT EXISTS tracking_status text;
ALTER TABLE public.child_orders ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.child_orders ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_history ADD COLUMN IF NOT EXISTS tracking_status text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS drug_name_snapshot text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS drug_strength_snapshot text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS dosage_instructions_snapshot text;
ALTER TABLE public.drugs ADD COLUMN IF NOT EXISTS strength text;
ALTER TABLE public.drugs ADD COLUMN IF NOT EXISTS dosage_instructions text;

UPDATE public.orders SET payment_status = CASE WHEN status::text IN ('paid','processing','out_for_delivery','delivered') AND COALESCE(escrow_amount, 0) > 0 THEN 'escrowed' WHEN status::text = 'pending' THEN 'pending' ELSE 'unknown' END WHERE payment_status = 'unknown';
UPDATE public.order_items oi SET drug_name_snapshot = d.name, drug_strength_snapshot = d.strength, dosage_instructions_snapshot = d.dosage_instructions FROM public.drugs d WHERE d.id = oi.drug_id AND oi.drug_name_snapshot IS NULL;
UPDATE public.child_orders SET tracking_status = CASE status::text WHEN 'pending' THEN 'order_received' WHEN 'paid' THEN 'order_received' WHEN 'processing' THEN 'processing' WHEN 'out_for_delivery' THEN 'out_for_delivery' WHEN 'delivered' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' ELSE 'order_received' END WHERE tracking_status IS NULL;
UPDATE public.order_history SET tracking_status = CASE status::text WHEN 'pending' THEN 'order_received' WHEN 'paid' THEN 'order_received' WHEN 'processing' THEN 'processing' WHEN 'out_for_delivery' THEN 'out_for_delivery' WHEN 'delivered' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' ELSE 'order_received' END WHERE tracking_status IS NULL;
ALTER TABLE public.child_orders ALTER COLUMN tracking_status SET DEFAULT 'order_received';
ALTER TABLE public.child_orders ALTER COLUMN tracking_status SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_order_history_tracking_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tracking_status IS NULL THEN
    NEW.tracking_status := CASE NEW.status::text WHEN 'pending' THEN 'order_received' WHEN 'paid' THEN 'order_received' WHEN 'processing' THEN 'processing' WHEN 'out_for_delivery' THEN 'out_for_delivery' WHEN 'delivered' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' ELSE 'order_received' END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_order_history_tracking_status_before_insert ON public.order_history;
CREATE TRIGGER set_order_history_tracking_status_before_insert BEFORE INSERT ON public.order_history FOR EACH ROW EXECUTE FUNCTION public.set_order_history_tracking_status();

CREATE OR REPLACE FUNCTION public.update_pharmacy_order_status(_child_order_id uuid, _new_tracking_status text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.child_orders%ROWTYPE;
  v_legacy_status public.order_status;
  v_note text := NULLIF(btrim(_reason), '');
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _new_tracking_status NOT IN ('order_received','prescription_review','processing','ready_for_dispatch','out_for_delivery','delivered','cancelled','rejected') THEN RAISE EXCEPTION 'Invalid order status'; END IF;
  IF _new_tracking_status IN ('cancelled','rejected') AND (v_note IS NULL OR length(v_note) < 3 OR length(v_note) > 500) THEN RAISE EXCEPTION 'A reason between 3 and 500 characters is required'; END IF;

  SELECT co.* INTO v_order FROM public.child_orders co WHERE co.id = _child_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = v_order.pharmacy_id AND p.user_id = v_user_id) THEN RAISE EXCEPTION 'You cannot update this order'; END IF;

  IF NOT (
    (v_order.tracking_status IN ('order_received') AND _new_tracking_status IN ('prescription_review','processing','rejected','cancelled')) OR
    (v_order.tracking_status = 'prescription_review' AND _new_tracking_status IN ('processing','rejected','cancelled')) OR
    (v_order.tracking_status = 'processing' AND _new_tracking_status IN ('ready_for_dispatch','cancelled')) OR
    (v_order.tracking_status = 'ready_for_dispatch' AND _new_tracking_status IN ('out_for_delivery','cancelled')) OR
    (v_order.tracking_status = 'out_for_delivery' AND _new_tracking_status = 'delivered')
  ) THEN RAISE EXCEPTION 'This status change is not allowed'; END IF;

  v_legacy_status := CASE _new_tracking_status
    WHEN 'order_received' THEN 'paid'::public.order_status
    WHEN 'prescription_review' THEN 'paid'::public.order_status
    WHEN 'processing' THEN 'processing'::public.order_status
    WHEN 'ready_for_dispatch' THEN 'processing'::public.order_status
    WHEN 'out_for_delivery' THEN 'out_for_delivery'::public.order_status
    WHEN 'delivered' THEN 'delivered'::public.order_status
    ELSE 'cancelled'::public.order_status
  END;

  UPDATE public.child_orders SET tracking_status = _new_tracking_status, status = v_legacy_status WHERE id = _child_order_id;
  IF v_note IS NULL THEN v_note := CASE _new_tracking_status WHEN 'order_received' THEN 'Order received by pharmacy' WHEN 'prescription_review' THEN 'Prescription review started' WHEN 'processing' THEN 'Order processing started' WHEN 'ready_for_dispatch' THEN 'Order ready for dispatch' WHEN 'out_for_delivery' THEN 'Order dispatched' WHEN 'delivered' THEN 'Order marked delivered' ELSE 'Order status updated' END; END IF;
  INSERT INTO public.order_history (child_order_id, status, tracking_status, notes, created_by) VALUES (_child_order_id, v_legacy_status, _new_tracking_status, v_note, v_user_id);

  RETURN jsonb_build_object('child_order_id', _child_order_id, 'tracking_status', _new_tracking_status, 'status', v_legacy_status::text);
END;
$$;
REVOKE ALL ON FUNCTION public.update_pharmacy_order_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pharmacy_order_status(uuid, text, text) TO authenticated;
REVOKE UPDATE ON public.child_orders FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Pharmacists can view assigned parent orders" ON public.orders;
CREATE POLICY "Pharmacists can view assigned parent orders" ON public.orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.child_orders co JOIN public.pharmacies ph ON ph.id = co.pharmacy_id WHERE co.parent_order_id = orders.id AND ph.user_id = auth.uid()));
DROP POLICY IF EXISTS "Pharmacists can view prescriptions linked to assigned orders" ON public.prescriptions;
CREATE POLICY "Pharmacists can view prescriptions linked to assigned orders" ON public.prescriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'pharmacist'::public.app_role) AND EXISTS (SELECT 1 FROM public.orders o JOIN public.child_orders co ON co.parent_order_id = o.id JOIN public.pharmacies ph ON ph.id = co.pharmacy_id WHERE o.prescription_id = prescriptions.id AND ph.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can view own prescription files" ON storage.objects;
CREATE POLICY "Order parties can view prescription files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'prescriptions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::public.app_role) OR (public.has_role(auth.uid(), 'pharmacist'::public.app_role) AND EXISTS (SELECT 1 FROM public.orders o JOIN public.child_orders co ON co.parent_order_id = o.id JOIN public.pharmacies ph ON ph.id = co.pharmacy_id WHERE o.prescription_image_url = name AND ph.user_id = auth.uid()))));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'child_orders') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.child_orders; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_history') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_history; END IF;
END $$;