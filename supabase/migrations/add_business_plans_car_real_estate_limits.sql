-- Set dealership (car) and real estate listing limits on business_plans to match plan packaging:
-- free: 0, starter: 5, growth: 10, premium: 999 (same for both).

-- Add column if missing (e.g. existing projects may not have it yet)
ALTER TABLE business_plans
ADD COLUMN IF NOT EXISTS max_real_estate_listings integer;

-- Set limits per plan (car and real estate identical)
UPDATE business_plans SET max_car_listings = 0, max_real_estate_listings = 0 WHERE plan = 'free';
UPDATE business_plans SET max_car_listings = 5, max_real_estate_listings = 5 WHERE plan = 'starter';
UPDATE business_plans SET max_car_listings = 10, max_real_estate_listings = 10 WHERE plan = 'growth';
UPDATE business_plans SET max_car_listings = 999, max_real_estate_listings = 999 WHERE plan = 'premium';
