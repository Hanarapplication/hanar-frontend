-- Extend reports to support direct message chat reporting.

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_entity_type_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_entity_type_check
  CHECK (entity_type IN ('post', 'item', 'business', 'organization', 'chat'));
