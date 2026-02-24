-- Google Places import support for unclaimed businesses.
-- - owner_id becomes nullable (only for imported/unclaimed businesses)
-- - google_place_id for deduplication
-- - google_rating, google_user_ratings_total (optional display)

-- Add new columns
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_user_ratings_total integer;

-- Unique constraint for dedupe (allow multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS businesses_google_place_id_key
  ON public.businesses (google_place_id)
  WHERE google_place_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.google_place_id IS 'Google Places place_id; used to dedupe imports.';
COMMENT ON COLUMN public.businesses.google_rating IS 'Google Places rating (1-5). Display only.';
COMMENT ON COLUMN public.businesses.google_user_ratings_total IS 'Google Places user_ratings_total. Display only.';

-- Make owner_id nullable (existing rows keep their owner_id)
ALTER TABLE public.businesses
  ALTER COLUMN owner_id DROP NOT NULL;

COMMENT ON COLUMN public.businesses.owner_id IS 'UUID of registered user who owns the business. NULL for unclaimed imported businesses.';
