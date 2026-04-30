-- Owner-managed 4-digit admin PIN login step.
-- A PIN is unique across admin users and can be reissued by owner-level admins.

CREATE TABLE IF NOT EXISTS public.admin_pin_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  employee_id text NULL,
  pin_code text NOT NULL,
  pin_failures integer NOT NULL DEFAULT 0,
  is_on_hold boolean NOT NULL DEFAULT false,
  requires_pin boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_pin_security_pin_code_format CHECK (pin_code ~ '^[0-9]{4}$'),
  CONSTRAINT admin_pin_security_pin_failures_nonneg CHECK (pin_failures >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_pin_security_pin_code_unique
  ON public.admin_pin_security(pin_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_pin_security_employee_id_unique
  ON public.admin_pin_security(employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_pin_security_hold
  ON public.admin_pin_security(is_on_hold);

ALTER TABLE public.admin_pin_security ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_pin_security'
      AND policyname = 'Deny all direct access to admin_pin_security'
  ) THEN
    CREATE POLICY "Deny all direct access to admin_pin_security"
      ON public.admin_pin_security
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.admin_pin_security IS 'Per-admin 4-digit PIN second-step, unique PIN, and hold state after failed attempts.';
