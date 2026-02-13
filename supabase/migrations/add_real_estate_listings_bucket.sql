-- Real estate listing images: dedicated bucket (same pattern as car-listings).
-- Path format: {user_id}/real-estate/{listing_id}/{timestamp}-{filename}
-- Run in Supabase SQL Editor or via migration.

-- Create bucket (public so listing images are viewable on business pages)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'real-estate-listings',
  'real-estate-listings',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow authenticated users to upload only under their own folder (first path segment = user id)
CREATE POLICY "real_estate_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'real-estate-listings'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Allow authenticated users to update/delete only their own files
CREATE POLICY "real_estate_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'real-estate-listings'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'real-estate-listings'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "real_estate_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'real-estate-listings'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Public read so listing images work on public business pages (bucket is public; this allows client .list()/select if needed)
CREATE POLICY "real_estate_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'real-estate-listings');
