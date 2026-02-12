-- Add video support to community posts.
-- Videos are stored as public URLs (uploaded to Supabase Storage).
-- Max duration is enforced client-side (11 seconds).
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS video text DEFAULT NULL;

COMMENT ON COLUMN public.community_posts.video IS 'Public URL of an optional short video (max 11 seconds).';
