-- Per-user "delete chat" support: clears a conversation for one user only.

CREATE TABLE IF NOT EXISTS public.message_conversation_clears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cleared_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_conversation_clears_no_self CHECK (user_id <> peer_id),
  CONSTRAINT message_conversation_clears_unique_pair UNIQUE (user_id, peer_id)
);

CREATE INDEX IF NOT EXISTS idx_message_conversation_clears_user
  ON public.message_conversation_clears(user_id, updated_at DESC);

ALTER TABLE public.message_conversation_clears ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_conversation_clears_select_own ON public.message_conversation_clears
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY message_conversation_clears_insert_own ON public.message_conversation_clears
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY message_conversation_clears_update_own ON public.message_conversation_clears
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
