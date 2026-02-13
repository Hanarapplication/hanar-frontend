-- Template + Theme for business profile (Premium only).
-- Non-premium always sees default template/theme; selection is enforced in app.

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS profile_template text NOT NULL DEFAULT 'brand';

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'classic';

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS accent_color text;

COMMENT ON COLUMN businesses.profile_template IS 'Profile layout: brand|sell|prestige|service|simple. Effective only when plan=premium.';
COMMENT ON COLUMN businesses.theme IS 'Profile theme: classic|midnight|sunset|mint|rose|slate. Effective only when plan=premium.';
COMMENT ON COLUMN businesses.accent_color IS 'Optional hex accent. Premium only.';
