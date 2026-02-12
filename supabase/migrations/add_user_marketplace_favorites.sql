-- User favorite marketplace items (replaces localStorage; synced to Supabase).
CREATE TABLE IF NOT EXISTS public.user_marketplace_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_key)
);

CREATE INDEX IF NOT EXISTS user_marketplace_favorites_user_id ON public.user_marketplace_favorites (user_id);

COMMENT ON TABLE public.user_marketplace_favorites IS 'User favorite marketplace items; item_key e.g. retail:uuid, individual:uuid. item_snapshot: { id, source, slug, title, price, image, location } for display.';

-- RLS: users can only read/insert/delete their own rows
ALTER TABLE public.user_marketplace_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_marketplace_favorites_select_own ON public.user_marketplace_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_marketplace_favorites_insert_own ON public.user_marketplace_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_marketplace_favorites_delete_own ON public.user_marketplace_favorites
  FOR DELETE USING (auth.uid() = user_id);
