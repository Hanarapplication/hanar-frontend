-- Soft-delete / archive for marketplace items + admin-only notes history

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_source text;

COMMENT ON COLUMN public.marketplace_items.archived_at IS 'When set, listing is hidden from public marketplace and seller dashboards; retained for admin.';
COMMENT ON COLUMN public.marketplace_items.archive_source IS 'user: seller self-delete; admin: removed from admin panel.';

CREATE INDEX IF NOT EXISTS marketplace_items_archived_at_idx ON public.marketplace_items (archived_at);

CREATE TABLE IF NOT EXISTS public.marketplace_item_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_item_id uuid NOT NULL REFERENCES public.marketplace_items (id) ON DELETE CASCADE,
  admin_user_id uuid,
  admin_email text,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 8000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_item_admin_notes_item_idx
  ON public.marketplace_item_admin_notes (marketplace_item_id, created_at DESC);

ALTER TABLE public.marketplace_item_admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_item_admin_notes_deny_all ON public.marketplace_item_admin_notes;
CREATE POLICY marketplace_item_admin_notes_deny_all ON public.marketplace_item_admin_notes
  FOR ALL USING (false);
