-- Add subcategory column to businesses for more specific business type (e.g. under Dealership: Car Dealer, Truck Dealer).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS subcategory text DEFAULT NULL;

COMMENT ON COLUMN public.businesses.subcategory IS 'Specific type within category (e.g. Car Dealer under Dealership, Restaurant under Food).';
