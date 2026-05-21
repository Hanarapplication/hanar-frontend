-- User preference: when false, Hanar must not send FCM push notifications to this account.
ALTER TABLE public.registeredaccounts
  ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.registeredaccounts.push_notifications_enabled IS
  'When false, skip FCM push delivery for this user (in-app notifications may still apply).';
