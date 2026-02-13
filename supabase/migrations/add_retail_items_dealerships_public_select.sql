-- Allow public read access for retail_items and dealerships so listings appear in:
-- home feed, marketplace, and business profile pages.
-- Without these policies, anon/authenticated users get empty results even when data exists.

-- Ensure RLS is enabled (required for policies to take effect)
ALTER TABLE public.retail_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealerships ENABLE ROW LEVEL SECURITY;

-- Retail items: allow anyone to SELECT
DROP POLICY IF EXISTS "retail_items_select_public" ON public.retail_items;
CREATE POLICY "retail_items_select_public"
  ON public.retail_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- Dealerships (car listings): allow anyone to SELECT
DROP POLICY IF EXISTS "dealerships_select_public" ON public.dealerships;
CREATE POLICY "dealerships_select_public"
  ON public.dealerships FOR SELECT
  TO anon, authenticated
  USING (true);
