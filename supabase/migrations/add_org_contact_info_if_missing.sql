-- Optional: run only if organizations table does NOT already have contact_info / socials.
-- Registration and org dashboard use contact_info.phone and socials.

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT '{}';

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS socials jsonb DEFAULT '{}';

COMMENT ON COLUMN public.organizations.contact_info IS 'e.g. { "phone": "+1...", "email": "...", "whatsapp": "..." }';
COMMENT ON COLUMN public.organizations.socials IS 'e.g. { "instagram": "...", "facebook": "...", "website": "..." }';
