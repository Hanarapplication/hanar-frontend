-- Add structured location columns for better search (filled from Google Places when using address/location inputs).

-- Organizations: keep address (text) for display; add optional structured + coords for search.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_city text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_state text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_zip text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_lat double precision;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address_lng double precision;

-- Marketplace items: keep location (text) for display; add optional structured + coords for search.
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS location_state text;
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS location_zip text;
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS location_lat double precision;
ALTER TABLE public.marketplace_items ADD COLUMN IF NOT EXISTS location_lng double precision;

COMMENT ON COLUMN public.organizations.address_city IS 'City from Google Places; used for search.';
COMMENT ON COLUMN public.marketplace_items.location_city IS 'City from Google Places; used for search.';
