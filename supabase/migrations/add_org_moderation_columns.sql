-- Add moderation / admin fields to organizations (for admin panel)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS admin_note text,
ADD COLUMN IF NOT EXISTS note_history jsonb DEFAULT '[]';

COMMENT ON COLUMN public.organizations.moderation_status IS 'active | on_hold | rejected - on_hold hides from public';
