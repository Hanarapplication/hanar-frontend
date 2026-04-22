ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS slug_primary_color text,
ADD COLUMN IF NOT EXISTS slug_secondary_color text,
ADD COLUMN IF NOT EXISTS slug_use_gradient boolean DEFAULT true;

COMMENT ON COLUMN public.businesses.slug_primary_color IS 'Primary hex color for business slug page accents.';
COMMENT ON COLUMN public.businesses.slug_secondary_color IS 'Secondary hex color for business slug page accents and gradients.';
COMMENT ON COLUMN public.businesses.slug_use_gradient IS 'Whether business slug page accents use gradient blend between primary and secondary colors.';

