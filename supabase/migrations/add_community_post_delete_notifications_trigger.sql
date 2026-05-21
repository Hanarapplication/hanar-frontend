-- When a community post is soft-deleted or hard-deleted, remove related notifications
-- so bell counts and notification lists stay accurate.

CREATE OR REPLACE FUNCTION public.delete_notifications_for_community_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_post_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_post_id := OLD.id::text;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.deleted IS TRUE
    AND (OLD.deleted IS DISTINCT FROM TRUE) THEN
    target_post_id := NEW.id::text;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM public.notifications
  WHERE data->>'post_id' = target_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS community_posts_delete_notifications_on_soft_delete ON public.community_posts;
CREATE TRIGGER community_posts_delete_notifications_on_soft_delete
  AFTER UPDATE OF deleted ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_notifications_for_community_post();

DROP TRIGGER IF EXISTS community_posts_delete_notifications_on_hard_delete ON public.community_posts;
CREATE TRIGGER community_posts_delete_notifications_on_hard_delete
  AFTER DELETE ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_notifications_for_community_post();
