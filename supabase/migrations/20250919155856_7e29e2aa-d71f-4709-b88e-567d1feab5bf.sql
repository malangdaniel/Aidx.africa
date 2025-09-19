-- Add missing RLS policies for prescriptions
CREATE POLICY "Patients and doctors can view prescriptions" ON public.prescriptions
  FOR SELECT USING (patient_id = auth.uid() OR doctor_id = auth.uid());

CREATE POLICY "Doctors can create prescriptions" ON public.prescriptions
  FOR INSERT WITH CHECK (doctor_id = auth.uid());

-- Add missing RLS policies for carts
CREATE POLICY "Users can manage own cart" ON public.carts
  FOR ALL USING (user_id = auth.uid());

-- Add missing RLS policies for cart_items
CREATE POLICY "Users can manage own cart items" ON public.cart_items
  FOR ALL USING (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = auth.uid()
    )
  );

-- Add missing RLS policies for orders
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own orders" ON public.orders
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own orders" ON public.orders
  FOR UPDATE USING (user_id = auth.uid());

-- Add missing RLS policies for order_items
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- Add missing RLS policies for child_orders
CREATE POLICY "Users and pharmacists can view child orders" ON public.child_orders
  FOR SELECT USING (
    parent_order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    ) OR
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists can update their child orders" ON public.child_orders
  FOR UPDATE USING (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE user_id = auth.uid()
    )
  );

-- Add missing RLS policies for order_history
CREATE POLICY "Users can view order history for their orders" ON public.order_history
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    ) OR
    child_order_id IN (
      SELECT co.id FROM public.child_orders co
      JOIN public.orders o ON co.parent_order_id = o.id
      WHERE o.user_id = auth.uid()
    ) OR
    child_order_id IN (
      SELECT co.id FROM public.child_orders co
      WHERE co.pharmacy_id IN (
        SELECT id FROM public.pharmacies WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can create order history" ON public.order_history
  FOR INSERT WITH CHECK (true);

-- Add missing RLS policies for payout_requests
CREATE POLICY "Recipients can view own payout requests" ON public.payout_requests
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Admins can view all payout requests" ON public.payout_requests
  FOR SELECT USING (public.get_current_user_role() = 'admin');

CREATE POLICY "System can create payout requests" ON public.payout_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update payout requests" ON public.payout_requests
  FOR UPDATE USING (public.get_current_user_role() = 'admin');

-- Add missing RLS policies for reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for their orders/consultations" ON public.reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE USING (reviewer_id = auth.uid());