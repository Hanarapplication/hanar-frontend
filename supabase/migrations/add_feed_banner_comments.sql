-- Comments on feed banners (admin-only, for internal notes).
CREATE TABLE IF NOT EXISTS public.feed_banner_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_banner_id uuid NOT NULL REFERENCES public.feed_banners(id) ON DELETE CASCADE,
  body text NOT NULL,
  author text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_banner_comments_banner_id ON public.feed_banner_comments (feed_banner_id);
CREATE INDEX IF NOT EXISTS feed_banner_comments_created_at ON public.feed_banner_comments (created_at ASC);

COMMENT ON TABLE public.feed_banner_comments IS 'Admin comments/notes on feed banners; kept in place when new comments are added.';
