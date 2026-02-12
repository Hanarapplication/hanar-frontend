-- Packages: display duration options (2 weeks, 1 month, 3 months, 1 year, etc.)
CREATE TABLE IF NOT EXISTS public.feed_banner_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  duration_days int NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feed_banner_packages IS 'Display duration packages for feed banners (e.g. 2 weeks, 1 month, 1 year).';

-- Add new columns to feed_banners (status, expiry, package link)
ALTER TABLE public.feed_banners
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_days int,
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.feed_banner_packages(id);

COMMENT ON COLUMN public.feed_banners.status IS 'active = shown in feed; on_hold = paused; archived = expired or manually archived.';
COMMENT ON COLUMN public.feed_banners.expires_at IS 'When banner stops showing; past this = auto-archived.';
COMMENT ON COLUMN public.feed_banners.duration_days IS 'Display duration in days (from package or custom).';

-- Constrain status
ALTER TABLE public.feed_banners
  DROP CONSTRAINT IF EXISTS feed_banners_status_check;
ALTER TABLE public.feed_banners
  ADD CONSTRAINT feed_banners_status_check CHECK (status IN ('active', 'on_hold', 'archived'));

-- Backfill: set status from old active column and set expires_at/duration_days for existing rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feed_banners' AND column_name = 'active') THEN
    UPDATE public.feed_banners
    SET status = CASE WHEN active = true THEN 'active' ELSE 'on_hold' END,
        expires_at = COALESCE(expires_at, created_at + interval '30 days'),
        duration_days = COALESCE(duration_days, 30);
    ALTER TABLE public.feed_banners DROP COLUMN active;
  END IF;
  UPDATE public.feed_banners SET expires_at = created_at + (duration_days || ' days')::interval WHERE expires_at IS NULL AND duration_days IS NOT NULL;
END $$;

-- Indexes for listing and feed query
CREATE INDEX IF NOT EXISTS feed_banners_status_expires ON public.feed_banners (status, expires_at);
CREATE INDEX IF NOT EXISTS feed_banners_created_at ON public.feed_banners (created_at DESC);

-- Seed default packages (idempotent)
INSERT INTO public.feed_banner_packages (name, duration_days, sort_order)
VALUES
  ('2 Weeks', 14, 10),
  ('1 Month', 30, 20),
  ('3 Months', 90, 30),
  ('6 Months', 180, 40),
  ('1 Year', 365, 50)
ON CONFLICT (name) DO NOTHING;
