ALTER TABLE public.child_orders ALTER COLUMN tracking_status SET DEFAULT 'order_placed';
UPDATE public.child_orders SET tracking_status = 'order_placed' WHERE tracking_status = 'order_received' AND status::text = 'paid';
CREATE OR REPLACE FUNCTION public.update_pharmacy_order_status(_child_order_id uuid, _new_tracking_status text, _reason text, _actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.child_orders%ROWTYPE;
  v_legacy_status public.order_status;
  v_note text := NULLIF(btrim(_reason), '');
BEGIN
  IF _actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _new_tracking_status NOT IN ('order_received','prescription_review','processing','ready_for_dispatch','out_for_delivery','delivered','cancelled','rejected') THEN RAISE EXCEPTION 'Invalid order status'; END IF;
  IF _new_tracking_status IN ('cancelled','rejected') AND (v_note IS NULL OR length(v_note) < 3 OR length(v_note) > 500) THEN RAISE EXCEPTION 'A reason between 3 and 500 characters is required'; END IF;
  SELECT co.* INTO v_order FROM public.child_orders co WHERE co.id = _child_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = v_order.pharmacy_id AND p.user_id = _actor_id) THEN RAISE EXCEPTION 'You cannot update this order'; END IF;
  IF NOT (
    (v_order.tracking_status = 'order_placed' AND _new_tracking_status IN ('order_received','prescription_review','rejected','cancelled')) OR
    (v_order.tracking_status = 'order_received' AND _new_tracking_status IN ('prescription_review','processing','rejected','cancelled')) OR
    (v_order.tracking_status = 'prescription_review' AND _new_tracking_status IN ('processing','rejected','cancelled')) OR
    (v_order.tracking_status = 'processing' AND _new_tracking_status IN ('ready_for_dispatch','cancelled')) OR
    (v_order.tracking_status = 'ready_for_dispatch' AND _new_tracking_status IN ('out_for_delivery','cancelled')) OR
    (v_order.tracking_status = 'out_for_delivery' AND _new_tracking_status = 'delivered')
  ) THEN RAISE EXCEPTION 'This status change is not allowed'; END IF;
  v_legacy_status := CASE _new_tracking_status WHEN 'order_received' THEN 'paid'::public.order_status WHEN 'prescription_review' THEN 'paid'::public.order_status WHEN 'processing' THEN 'processing'::public.order_status WHEN 'ready_for_dispatch' THEN 'processing'::public.order_status WHEN 'out_for_delivery' THEN 'out_for_delivery'::public.order_status WHEN 'delivered' THEN 'delivered'::public.order_status ELSE 'cancelled'::public.order_status END;
  UPDATE public.child_orders SET tracking_status = _new_tracking_status, status = v_legacy_status WHERE id = _child_order_id;
  IF v_note IS NULL THEN v_note := CASE _new_tracking_status WHEN 'order_received' THEN 'Order accepted by pharmacy' WHEN 'prescription_review' THEN 'Prescription review started' WHEN 'processing' THEN 'Order processing started' WHEN 'ready_for_dispatch' THEN 'Order ready for dispatch' WHEN 'out_for_delivery' THEN 'Order dispatched' WHEN 'delivered' THEN 'Order marked delivered' ELSE 'Order status updated' END; END IF;
  INSERT INTO public.order_history (child_order_id, status, tracking_status, notes, created_by) VALUES (_child_order_id, v_legacy_status, _new_tracking_status, v_note, _actor_id);
  RETURN jsonb_build_object('child_order_id', _child_order_id, 'tracking_status', _new_tracking_status, 'status', v_legacy_status::text);
END;
$$;
REVOKE ALL ON FUNCTION public.update_pharmacy_order_status(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_pharmacy_order_status(uuid, text, text, uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.set_order_history_tracking_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  IF NEW.tracking_status IS NULL THEN NEW.tracking_status := CASE NEW.status::text WHEN 'paid' THEN 'order_placed' WHEN 'pending' THEN 'order_placed' WHEN 'processing' THEN 'processing' WHEN 'out_for_delivery' THEN 'out_for_delivery' WHEN 'delivered' THEN 'delivered' WHEN 'cancelled' THEN 'cancelled' ELSE 'order_placed' END; END IF;
  RETURN NEW;
END; $$;