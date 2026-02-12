-- Feed banners: admin-uploaded banners shown in the home feed (top or between posts).
-- In Supabase Dashboard → Storage: create a public bucket named "feed-banners" (if not exists).
CREATE TABLE IF NOT EXISTS public.feed_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path text NOT NULL,
  link_url text NOT NULL,
  alt text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feed_banners IS 'Banners displayed in the home feed; admin uploads image and sets link.';
CREATE INDEX IF NOT EXISTS feed_banners_active_created_at ON public.feed_banners (active, created_at DESC);
