-- Wider report lifecycle + report individual sellers (by user id).

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_status_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (
    status IN (
      'unread',
      'read',
      'in_review',
      'need_attention',
      'archived',
      'resolved'
    )
  );

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_entity_type_check;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_entity_type_check
  CHECK (
    entity_type IN (
      'post',
      'item',
      'business',
      'organization',
      'chat',
      'seller'
    )
  );

COMMENT ON COLUMN public.reports.status IS
  'unread: new. read: seen. in_review: being reviewed. need_attention: escalated. resolved: solved. archived: closed without action.';

COMMENT ON COLUMN public.reports.entity_type IS
  'seller = individual marketplace seller (entity_id = user id). item/business/post/organization/chat as before.';
