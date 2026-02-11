-- Store user's preferred UI language so it syncs across devices when logged in.
ALTER TABLE public.registeredaccounts
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'auto';

COMMENT ON COLUMN public.registeredaccounts.preferred_language IS 'User UI language code (e.g. en, ar, auto).';
