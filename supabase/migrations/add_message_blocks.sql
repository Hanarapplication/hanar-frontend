-- Message-only blocking (separate from full profile/user block).

CREATE TABLE IF NOT EXISTS public.message_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_blocks_no_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT message_blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_message_blocks_blocker ON public.message_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_message_blocks_blocked ON public.message_blocks(blocked_id);

ALTER TABLE public.message_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_blocks_select_own ON public.message_blocks
  FOR SELECT TO authenticated
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY message_blocks_insert_self ON public.message_blocks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY message_blocks_delete_blocker ON public.message_blocks
  FOR DELETE TO authenticated
  USING (auth.uid() = blocker_id);
