-- Allow businesses to choose a profile page design. Paid plans get access to more themes.
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS profile_theme text NOT NULL DEFAULT 'default';

COMMENT ON COLUMN businesses.profile_theme IS 'Profile page design: default (all), modern (starter+), minimal (growth+), premium (premium only)';
