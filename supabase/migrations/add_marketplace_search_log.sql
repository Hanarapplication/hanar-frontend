-- Log marketplace searches for admin insights (top searches by radius).
CREATE TABLE IF NOT EXISTS public.marketplace_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  search_term text NOT NULL,
  radius_miles numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_search_log_radius ON public.marketplace_search_log(radius_miles);
CREATE INDEX IF NOT EXISTS idx_marketplace_search_log_created_at ON public.marketplace_search_log(created_at);

ALTER TABLE public.marketplace_search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert search log"
  ON public.marketplace_search_log
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Service role (admin API) can read all; anon/authenticated cannot select.
CREATE POLICY "No public read"
  ON public.marketplace_search_log
  FOR SELECT
  USING (false);

COMMENT ON TABLE public.marketplace_search_log IS 'Logs marketplace searches for admin insights. radius_miles = null means unlimited radius.';

-- Top 10 search terms by count, optional filter by radius (null = unlimited).
CREATE OR REPLACE FUNCTION public.get_marketplace_top_searches(p_radius_miles numeric DEFAULT NULL)
RETURNS TABLE(term text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(search_term))::text AS term, count(*)::bigint
  FROM marketplace_search_log
  WHERE (p_radius_miles IS NULL AND radius_miles IS NULL)
     OR (p_radius_miles IS NOT NULL AND radius_miles = p_radius_miles)
  GROUP BY lower(trim(search_term))
  ORDER BY count DESC
  LIMIT 10;
$$;
COMMENT ON FUNCTION public.get_marketplace_top_searches(numeric) IS 'Returns top 10 marketplace search terms with counts; p_radius_miles null = unlimited radius.';
