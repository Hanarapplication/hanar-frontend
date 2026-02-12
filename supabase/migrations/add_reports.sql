-- Reports: users can report posts, marketplace items, businesses, and organizations.
-- Each report tracks the entity type, entity id, reason, status, and admin actions.

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('post', 'item', 'business', 'organization')),
  entity_id text NOT NULL,
  entity_title text DEFAULT '',
  reporter_id text NOT NULL,
  reporter_username text DEFAULT '',
  reason text NOT NULL DEFAULT '',
  details text DEFAULT '',
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived', 'resolved')),
  admin_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reports IS 'User-submitted reports for posts, items, businesses, and organizations.';
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_entity_idx ON public.reports (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);

-- Report comments: admins can add comments/notes to reports.
CREATE TABLE IF NOT EXISTS public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  admin_email text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.report_comments IS 'Admin comments on reports for internal tracking.';
CREATE INDEX IF NOT EXISTS report_comments_report_idx ON public.report_comments (report_id, created_at DESC);
