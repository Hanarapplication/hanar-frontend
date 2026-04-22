-- Prevent sending messages to users who blocked the sender from messaging.

DROP POLICY IF EXISTS direct_messages_insert_sender_only ON public.direct_messages;

CREATE POLICY direct_messages_insert_sender_only ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.message_blocks mb
      WHERE mb.blocker_id = recipient_user_id
        AND mb.blocked_id = sender_user_id
    )
  );
