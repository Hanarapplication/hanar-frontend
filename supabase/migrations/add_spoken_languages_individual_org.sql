-- Spoken languages for individuals and organizations (for ads and matching).
-- Businesses already have spoken_languages via add_business_spoken_languages.sql.

ALTER TABLE public.registeredaccounts
  ADD COLUMN IF NOT EXISTS spoken_languages text[] DEFAULT '{}';

COMMENT ON COLUMN public.registeredaccounts.spoken_languages IS 'Language/dialect codes the user speaks (e.g. en, ar, ar-IQ, ar-EG). Used for ad targeting and display.';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS spoken_languages text[] DEFAULT '{}';

COMMENT ON COLUMN public.organizations.spoken_languages IS 'Language/dialect codes the organization uses (e.g. en, ar, ar-SY). Used for ad targeting and display.';
