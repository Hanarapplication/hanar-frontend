-- Composite unique so /api/push/register-token can upsert on (user_id, token).
-- Global uniqueness of `token` is already enforced by user_push_tokens_token_key; this index
-- is safe to add and matches PostgREST upsert onConflict: 'user_id,token'.
CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_user_id_token_key
  ON public.user_push_tokens (user_id, token);
