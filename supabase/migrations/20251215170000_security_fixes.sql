-- 1. Fix: PUBLIC_DATA_EXPOSURE (Pharmacies)
-- Revoke the permissive public policy
DROP POLICY IF EXISTS "Anyone can view pharmacy profiles" ON public.pharmacies;

-- Add clearer policy: Authenticated users can view (required for patient searches)
-- But effectively this is safer than "anon" public access
CREATE POLICY "Authenticated users can view pharmacy profiles" 
  ON public.pharmacies FOR SELECT 
  USING (auth.role() = 'authenticated');


-- 2. Fix: OPEN_ENDPOINTS (Order History)
-- Revoke policy that might allow public inserts (if it existed) or just ensure new one prevents it
DROP POLICY IF EXISTS "System can create order history" ON public.order_history;

-- Allow inserts only if they come from backend (service_role) or triggers
-- The WITH CHECK (false) effectively blocks any user-initiated insert
CREATE POLICY "No public inserts for order history" 
  ON public.order_history FOR INSERT 
  WITH CHECK (false);


-- 3. Fix: MISSING_RLS (Order Items for Pharmacies)
-- Pharmacists need to see items for orders assigned to their pharmacy (via child_orders or direct relation if exists)
-- Assuming structure: order_items -> pharmacy_id column exists based on previous migration (20250918...)
CREATE POLICY "Pharmacists can view assigned order items" 
  ON public.order_items FOR SELECT 
  USING (
    pharmacy_id IN (
      SELECT id FROM public.pharmacies WHERE user_id = auth.uid()
    )
  );
