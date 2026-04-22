ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS slug_retail_search_accent_color text,
ADD COLUMN IF NOT EXISTS slug_view_detail_button_color text,
ADD COLUMN IF NOT EXISTS slug_sidebar_menu_button_color text;

COMMENT ON COLUMN public.businesses.slug_retail_search_accent_color IS 'Hex color for retail (Basel) header bar, search CTA, and related accents; null uses default teal.';
COMMENT ON COLUMN public.businesses.slug_view_detail_button_color IS 'Solid hex for View details and primary CTAs on the slug page; null uses brand gradient/solid.';
COMMENT ON COLUMN public.businesses.slug_sidebar_menu_button_color IS 'Solid hex for burger menu action buttons; null uses brand gradient/solid.';
