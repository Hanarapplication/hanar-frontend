-- Optional: spoken languages at this business (e.g. ['en','es','ar']).
-- Used to show "Speaks your language" and sort compatible businesses at top (premium feature).
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS spoken_languages text[] DEFAULT '{}';

COMMENT ON COLUMN public.businesses.spoken_languages IS 'Language codes the business speaks (e.g. en, es, ar). Used for search/sort by language match.';
