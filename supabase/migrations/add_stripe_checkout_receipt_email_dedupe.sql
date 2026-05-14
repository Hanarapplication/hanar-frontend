-- One row per Stripe webhook event.id so receipt emails are not duplicated on Stripe retries.
CREATE TABLE IF NOT EXISTS public.stripe_checkout_receipt_emails (
  stripe_event_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_checkout_receipt_emails IS
  'Dedupes Hanar checkout receipt emails: insert claim before send, delete on send failure so retries can resend.';
