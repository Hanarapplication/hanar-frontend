-- Email verification codes for business ownership claims (replaces phone OTP flow).

CREATE TABLE IF NOT EXISTS public.business_claim_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_claim_email_verifications_lookup
  ON public.business_claim_email_verifications(business_id, user_id, listing_email);

ALTER TABLE public.business_claim_email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_claim_email_verifications_select_own ON public.business_claim_email_verifications;
CREATE POLICY business_claim_email_verifications_select_own
  ON public.business_claim_email_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS business_claim_email_verifications_insert_own ON public.business_claim_email_verifications;
CREATE POLICY business_claim_email_verifications_insert_own
  ON public.business_claim_email_verifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS business_claim_email_verifications_update_own ON public.business_claim_email_verifications;
CREATE POLICY business_claim_email_verifications_update_own
  ON public.business_claim_email_verifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.business_claims
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.business_claims
  ALTER COLUMN claim_phone DROP NOT NULL;

COMMENT ON TABLE public.business_claim_email_verifications IS 'Email OTP codes sent to listing email for business claims.';

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text NOT NULL,
  message text NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_name text,
  business_slug text,
  source text NOT NULL DEFAULT 'contact',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_submissions_status_check CHECK (status IN ('pending', 'reviewed', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_business_id ON public.contact_submissions(business_id);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
