-- Add attachment metadata to direct messages.

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;
