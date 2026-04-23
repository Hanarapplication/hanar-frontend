ALTER TABLE public.marketplace_items
ADD COLUMN IF NOT EXISTS is_on_hold boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_reviewed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.marketplace_items.is_on_hold IS 'Admin hold flag. true hides item from public marketplace.';
COMMENT ON COLUMN public.marketplace_items.is_reviewed IS 'Admin review flag for moderation workflow.';

CREATE INDEX IF NOT EXISTS marketplace_items_on_hold_idx ON public.marketplace_items (is_on_hold);
CREATE INDEX IF NOT EXISTS marketplace_items_reviewed_idx ON public.marketplace_items (is_reviewed);
