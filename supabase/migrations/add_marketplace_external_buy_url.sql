-- Optional link for online buyers (e.g. Amazon, eBay). Opens in new tab when clicked.
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS external_buy_url text;

COMMENT ON COLUMN public.marketplace_items.external_buy_url IS 'Optional URL for online buyers (e.g. Amazon, eBay). Shown on listing detail; opens in new tab.';
