ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS slug_contact_action_color text;

COMMENT ON COLUMN public.businesses.slug_contact_action_color IS 'Solid hex for Call/WhatsApp/Message/Map action circles on the business profile; null uses primary brand color.';
