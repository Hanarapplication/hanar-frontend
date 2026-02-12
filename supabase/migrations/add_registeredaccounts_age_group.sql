-- Store age group for ad targeting (derived from date_of_birth).
-- Values: '13-17', '18-24', '25-34', '35-44', '45-54', '55+'

ALTER TABLE public.registeredaccounts
ADD COLUMN IF NOT EXISTS age_group text DEFAULT NULL;

COMMENT ON COLUMN public.registeredaccounts.age_group IS 'Age bracket for targeted advertising (13-17, 18-24, 25-34, 35-44, 45-54, 55+). Derived from date_of_birth.';

-- Optional: backfill existing users who have date_of_birth (run once after deploy)
-- UPDATE public.registeredaccounts
-- SET age_group = CASE
--   WHEN date_of_birth IS NULL THEN NULL
--   WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 18 THEN '13-17'
--   WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 25 THEN '18-24'
--   WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 35 THEN '25-34'
--   WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 45 THEN '35-44'
--   WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth::date)) < 55 THEN '45-54'
--   ELSE '55+'
-- END
-- WHERE date_of_birth IS NOT NULL AND (age_group IS NULL OR age_group = '');
