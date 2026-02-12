-- Create the feed-banners storage bucket (public, for banner images).
-- Requires storage schema. If INSERT fails (e.g. read-only storage), create in Dashboard:
-- Storage → New bucket → Name: feed-banners → Public: On.

INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-banners', 'feed-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;
