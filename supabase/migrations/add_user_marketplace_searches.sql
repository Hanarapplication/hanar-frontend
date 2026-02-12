-- Store recent marketplace search terms per user (for "Recent searches" and relevance).
-- One row per user; searches = JSON array of strings, most recent first, max 10.
CREATE TABLE IF NOT EXISTS public.user_marketplace_searches (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  searches jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_marketplace_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own marketplace searches"
  ON public.user_marketplace_searches
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own marketplace searches"
  ON public.user_marketplace_searches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own marketplace searches"
  ON public.user_marketplace_searches
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_marketplace_searches IS 'Recent marketplace search terms per user (max 10), used for UI and relevance ranking.';
