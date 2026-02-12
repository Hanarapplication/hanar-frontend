-- Casual Seller Pack: paid 30-day pack for individuals to list up to 5 items.
-- Free tier: 1 active listing, expires 30 days after created_at.
-- Pack: $19.99 for 30 days, max 5 active listings. Renewal extends pack_expires_at by +30 days.
CREATE TABLE IF NOT EXISTS public.individual_listing_packs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.individual_listing_packs IS 'Individual users who bought Casual Seller Pack. pack_expires_at: until when they can have up to 5 listings. Renewal adds +30 days from current expiry or from now if expired.';

CREATE INDEX IF NOT EXISTS individual_listing_packs_expires ON public.individual_listing_packs (pack_expires_at);

ALTER TABLE public.individual_listing_packs ENABLE ROW LEVEL SECURITY;

-- Users can read their own pack row (API uses service role for write)
CREATE POLICY individual_listing_packs_select_own ON public.individual_listing_packs
  FOR SELECT USING (auth.uid() = user_id);
