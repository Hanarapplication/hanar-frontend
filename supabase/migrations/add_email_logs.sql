-- Audit log for transactional outbound email (Resend). No body/html stored.
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  recipient_email text NULL,
  template text NULL,
  subject text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL
);

COMMENT ON TABLE public.email_logs IS 'Transactional email attempts via sendHanarEmail; subject/recipient/template only — never HTML/text bodies.';
COMMENT ON COLUMN public.email_logs.status IS 'pending: before provider send; sent: Resend accepted; failed: blocked or provider error.';
COMMENT ON COLUMN public.email_logs.metadata IS 'Safe structured context (e.g. truncated Resend tags); no secrets or bodies.';

CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON public.email_logs (user_id);
CREATE INDEX IF NOT EXISTS email_logs_template_idx ON public.email_logs (template);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON public.email_logs (created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
