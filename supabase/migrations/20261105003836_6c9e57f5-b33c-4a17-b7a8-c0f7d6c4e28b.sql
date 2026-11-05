-- Recalculate a doctor's rating whenever a review on them changes
CREATE OR REPLACE FUNCTION public.sync_doctor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewee uuid;
BEGIN
  v_reviewee := COALESCE(NEW.reviewee_id, OLD.reviewee_id);

  UPDATE public.doctors d
  SET rating = COALESCE((
    SELECT ROUND(AVG(r.rating)::numeric, 1)
    FROM public.reviews r
    WHERE r.reviewee_id = d.user_id
  ), 0)
  WHERE d.user_id = v_reviewee;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_doctor_rating ON public.reviews;
CREATE TRIGGER trg_sync_doctor_rating
AFTER INSERT OR UPDATE OF rating OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_doctor_rating();

-- Backfill current ratings from existing reviews
UPDATE public.doctors d
SET rating = COALESCE((
  SELECT ROUND(AVG(r.rating)::numeric, 1)
  FROM public.reviews r
  WHERE r.reviewee_id = d.user_id
), 0);