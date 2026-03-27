ALTER TABLE public.marketplace_items
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.marketplace_items.expires_at IS 'Optional expiration datetime for listing visibility. NULL means no expiration.';
