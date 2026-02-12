-- Gender for individual accounts (optional; used for profile and ad targeting).
-- Values: 'man', 'woman', 'she', 'he', 'they'

ALTER TABLE public.registeredaccounts
ADD COLUMN IF NOT EXISTS gender text DEFAULT NULL;

COMMENT ON COLUMN public.registeredaccounts.gender IS 'User gender for individual accounts: man, woman, she, he, they.';
