-- Business claim requests: owners claim unclaimed listings via phone verification + admin approval.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'unclaimed';

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_claim_status_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_claim_status_check
  CHECK (claim_status IN ('unclaimed', 'pending', 'claimed', 'rejected'));

UPDATE public.businesses
SET claim_status = 'claimed'
WHERE owner_id IS NOT NULL
  AND claim_status = 'unclaimed'
  AND admin_added_at IS NULL;

-- Admin-added listings keep a placeholder owner until a real owner claims them.
UPDATE public.businesses
SET claim_status = 'unclaimed'
WHERE admin_added_at IS NOT NULL
  AND claim_status = 'claimed';

COMMENT ON COLUMN public.businesses.claim_status IS 'unclaimed | pending (claim submitted) | claimed | rejected';

CREATE TABLE IF NOT EXISTS public.business_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claim_name text NOT NULL,
  claim_phone text NOT NULL,
  claim_email text,
  proof_text text NOT NULL,
  proof_image_url text,
  status text NOT NULL DEFAULT 'pending',
  phone_verified boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_claims_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_business_claims_business_id ON public.business_claims(business_id);
CREATE INDEX IF NOT EXISTS idx_business_claims_user_id ON public.business_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_business_claims_status ON public.business_claims(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_claims_one_pending_per_business
  ON public.business_claims(business_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.business_claim_phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_claim_phone_verifications_lookup
  ON public.business_claim_phone_verifications(business_id, user_id, phone);

ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_claim_phone_verifications ENABLE ROW LEVEL SECURITY;

-- Users: read own claims only
DROP POLICY IF EXISTS business_claims_select_own ON public.business_claims;
CREATE POLICY business_claims_select_own
  ON public.business_claims FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins: read all claims
DROP POLICY IF EXISTS business_claims_admin_select ON public.business_claims;
CREATE POLICY business_claims_admin_select
  ON public.business_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.adminaccounts
      WHERE adminaccounts.user_id = auth.uid()
    )
  );

-- Users: insert own claims only (no direct owner_id updates on businesses)
DROP POLICY IF EXISTS business_claims_insert_own ON public.business_claims;
CREATE POLICY business_claims_insert_own
  ON public.business_claims FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Deny user updates/deletes on claims (admin uses service role)
DROP POLICY IF EXISTS business_claims_no_user_update ON public.business_claims;
CREATE POLICY business_claims_no_user_update
  ON public.business_claims FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS business_claims_no_user_delete ON public.business_claims;
CREATE POLICY business_claims_no_user_delete
  ON public.business_claims FOR DELETE
  TO authenticated
  USING (false);

-- Phone verification rows: own user only
DROP POLICY IF EXISTS business_claim_phone_verifications_select_own ON public.business_claim_phone_verifications;
CREATE POLICY business_claim_phone_verifications_select_own
  ON public.business_claim_phone_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS business_claim_phone_verifications_insert_own ON public.business_claim_phone_verifications;
CREATE POLICY business_claim_phone_verifications_insert_own
  ON public.business_claim_phone_verifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS business_claim_phone_verifications_update_own ON public.business_claim_phone_verifications;
CREATE POLICY business_claim_phone_verifications_update_own
  ON public.business_claim_phone_verifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage bucket for claim proof documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-claim-proofs',
  'business-claim-proofs',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS business_claim_proofs_upload_own ON storage.objects;
CREATE POLICY business_claim_proofs_upload_own
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-claim-proofs'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS business_claim_proofs_public_read ON storage.objects;
CREATE POLICY business_claim_proofs_public_read
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-claim-proofs');

COMMENT ON TABLE public.business_claims IS 'Pending/approved/rejected business ownership claims.';
COMMENT ON TABLE public.business_claim_phone_verifications IS 'OTP codes for claim phone verification.';

-- Prevent authenticated users from changing businesses.owner_id (admin APIs use service role)
CREATE OR REPLACE FUNCTION public.protect_business_owner_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id AND auth.role() = 'authenticated' THEN
    NEW.owner_id := OLD.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_business_owner_id_trigger ON public.businesses;
CREATE TRIGGER protect_business_owner_id_trigger
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_business_owner_id();
