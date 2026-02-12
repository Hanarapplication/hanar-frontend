-- Add first name, last name, and date of birth for all registered users.
-- full_name can remain for display (we'll set it from first_name + ' ' + last_name in app).

ALTER TABLE public.registeredaccounts
ADD COLUMN IF NOT EXISTS first_name text DEFAULT NULL;

ALTER TABLE public.registeredaccounts
ADD COLUMN IF NOT EXISTS last_name text DEFAULT NULL;

ALTER TABLE public.registeredaccounts
ADD COLUMN IF NOT EXISTS date_of_birth date DEFAULT NULL;

COMMENT ON COLUMN public.registeredaccounts.first_name IS 'User first name (used with last_name to generate @handle).';
COMMENT ON COLUMN public.registeredaccounts.last_name IS 'User last name (used with first_name to generate @handle).';
COMMENT ON COLUMN public.registeredaccounts.date_of_birth IS 'User date of birth (optional validation: must be past, reasonable age).';
