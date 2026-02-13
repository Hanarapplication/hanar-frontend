-- Real estate listings per business (same pattern as dealerships / car listings).
-- Required for the business edit page Real Estate category to save.

CREATE TABLE IF NOT EXISTS public.real_estate_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  price numeric(12,2) NULL,
  property_type text NULL,
  address text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.real_estate_listings IS 'Real estate listings for businesses with category Real Estate.';
CREATE INDEX IF NOT EXISTS real_estate_listings_business_id ON public.real_estate_listings (business_id);
CREATE INDEX IF NOT EXISTS real_estate_listings_created_at ON public.real_estate_listings (created_at DESC);

ALTER TABLE public.real_estate_listings ENABLE ROW LEVEL SECURITY;

-- Only business owner can select/insert/update/delete their listings
CREATE POLICY "real_estate_select_own"
ON public.real_estate_listings FOR SELECT
TO authenticated
USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "real_estate_insert_own"
ON public.real_estate_listings FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "real_estate_update_own"
ON public.real_estate_listings FOR UPDATE
TO authenticated
USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
)
WITH CHECK (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

CREATE POLICY "real_estate_delete_own"
ON public.real_estate_listings FOR DELETE
TO authenticated
USING (
  business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
);

-- Allow public read for business profile pages (optional: remove if listings are only shown to owner)
CREATE POLICY "real_estate_select_public"
ON public.real_estate_listings FOR SELECT
TO anon
USING (true);
