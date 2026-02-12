-- Web push tokens (FCM) for PWA / web clients.
-- Bell in-app notifications remain in public.notifications; this table is for device tokens
-- used by a backend/Edge Function to send push notifications (e.g. Area Blast).
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  device_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push tokens"
  ON public.push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.push_tokens IS 'FCM tokens for web push (PWA). Backend/Edge Function sends pushes to these tokens.';
