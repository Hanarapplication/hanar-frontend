-- Idempotency: one native DM push per direct_messages row (prevents replays after FCM token refresh).
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS dm_push_sent_at timestamptz;

COMMENT ON COLUMN public.direct_messages.dm_push_sent_at IS
  'When set, native FCM for this DM was delivered at least once; prevents duplicate phone pushes.';
