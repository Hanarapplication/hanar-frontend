-- Direct user-to-user messages (used for contacting sellers, businesses, and organizations).

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 2000),
  recipient_entity_type text CHECK (recipient_entity_type IN ('user', 'business', 'organization')),
  recipient_entity_id uuid,
  recipient_entity_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'direct_messages_no_self'
      AND conrelid = 'public.direct_messages'::regclass
  ) THEN
    ALTER TABLE public.direct_messages
      ADD CONSTRAINT direct_messages_no_self CHECK (sender_user_id <> recipient_user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created
  ON public.direct_messages(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_created
  ON public.direct_messages(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_recipient
  ON public.direct_messages(recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY direct_messages_select_participants ON public.direct_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);

CREATE POLICY direct_messages_insert_sender_only ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_user_id);

CREATE POLICY direct_messages_update_participants ON public.direct_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);
