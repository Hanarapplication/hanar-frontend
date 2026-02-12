-- View counts for businesses, items, and feed banners (internal analytics, not shown to public).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.feed_banners
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Marketplace items (individual listings)
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Retail items (business listings)
ALTER TABLE public.retail_items
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Dealership / car listings
ALTER TABLE public.dealerships
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.businesses.view_count IS 'Internal view count; not displayed to public.';
COMMENT ON COLUMN public.feed_banners.view_count IS 'Internal view count; not displayed to public.';
COMMENT ON COLUMN public.marketplace_items.view_count IS 'Internal view count; not displayed to public.';
COMMENT ON COLUMN public.retail_items.view_count IS 'Internal view count; not displayed to public.';
COMMENT ON COLUMN public.dealerships.view_count IS 'Internal view count; not displayed to public.';

-- Atomic increment for view_count (called from API; table name and id passed as params).
CREATE OR REPLACE FUNCTION public.increment_view_count(p_table text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_table = 'businesses' THEN
    UPDATE public.businesses SET view_count = view_count + 1 WHERE id = p_id;
  ELSIF p_table = 'feed_banners' THEN
    UPDATE public.feed_banners SET view_count = view_count + 1 WHERE id = p_id;
  ELSIF p_table = 'marketplace_items' THEN
    UPDATE public.marketplace_items SET view_count = view_count + 1 WHERE id = p_id;
  ELSIF p_table = 'retail_items' THEN
    UPDATE public.retail_items SET view_count = view_count + 1 WHERE id = p_id;
  ELSIF p_table = 'dealerships' THEN
    UPDATE public.dealerships SET view_count = view_count + 1 WHERE id = p_id;
  END IF;
END;
$$;
COMMENT ON FUNCTION public.increment_view_count(text, uuid) IS 'Increments view_count for the given table and id (internal analytics).';
