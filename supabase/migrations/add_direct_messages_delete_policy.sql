-- Allow chat participants to delete their conversation messages.

CREATE POLICY direct_messages_delete_participants ON public.direct_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);
