-- Let individual users choose: post to profile (followers only) or to community (public).
-- Profile page shows all of the user's posts; home/community feeds show only visibility = 'community'.

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'community';

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_visibility_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_visibility_check
  CHECK (visibility IS NULL OR visibility IN ('profile', 'community'));

-- Backfill: existing rows stay public
UPDATE public.community_posts
SET visibility = 'community'
WHERE visibility IS NULL;

COMMENT ON COLUMN public.community_posts.visibility IS 'profile = only on author profile (followers); community = also in public community/home feed.';
