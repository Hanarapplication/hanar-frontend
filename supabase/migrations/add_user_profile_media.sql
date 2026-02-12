-- Profile-only photos and videos for individual users. Not shown in home feed or community.

CREATE TABLE IF NOT EXISTS public.user_profile_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profile_media IS 'Photos and videos on individual profiles only; not in home feed or community.';
CREATE INDEX IF NOT EXISTS user_profile_media_user_id ON public.user_profile_media (user_id);
CREATE INDEX IF NOT EXISTS user_profile_media_created_at ON public.user_profile_media (created_at DESC);

-- Storage bucket for profile media (public read so profile page can show them).
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;
