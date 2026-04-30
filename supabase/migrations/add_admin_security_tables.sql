-- Admin login hardening: server lockout + TOTP 2FA

CREATE TABLE IF NOT EXISTS public.admin_login_security (
  email text PRIMARY KEY,
  failure_count integer NOT NULL DEFAULT 0,
  lockout_until timestamptz NULL,
  last_failure_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_security_lockout
  ON public.admin_login_security(lockout_until);

ALTER TABLE public.admin_login_security ENABLE ROW LEVEL SECURITY;

-- Service role only. No direct client access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_login_security'
      AND policyname = 'Deny all direct access to admin_login_security'
  ) THEN
    CREATE POLICY "Deny all direct access to admin_login_security"
      ON public.admin_login_security
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_two_factor (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  totp_secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  backup_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_two_factor_enabled
  ON public.admin_two_factor(enabled);

ALTER TABLE public.admin_two_factor ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_two_factor'
      AND policyname = 'Deny all direct access to admin_two_factor'
  ) THEN
    CREATE POLICY "Deny all direct access to admin_two_factor"
      ON public.admin_two_factor
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.admin_login_security IS 'Server-side admin login lockout tracker.';
COMMENT ON TABLE public.admin_two_factor IS 'Admin TOTP 2FA settings.';
