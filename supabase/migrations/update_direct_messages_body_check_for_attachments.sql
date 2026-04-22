-- Allow attachment-only direct messages (empty body when attachment exists).

ALTER TABLE public.direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_body_check;

ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_body_check
  CHECK (
    char_length(body) <= 2000
    AND (
      char_length(btrim(body)) > 0
      OR attachment_url IS NOT NULL
    )
  );
