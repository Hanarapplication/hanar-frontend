import type { SupabaseClient } from '@supabase/supabase-js';

/** Remove bell notifications tied to a community post (likes, comments, etc.). */
export async function deleteNotificationsForCommunityPost(
  client: SupabaseClient,
  postId: string
): Promise<{ removed: number; error?: string }> {
  const id = String(postId || '').trim();
  if (!id) return { removed: 0 };

  const byData = await client
    .from('notifications')
    .delete()
    .filter('data->>post_id', 'eq', id)
    .select('id');

  if (byData.error) {
    console.error('[deleteNotificationsForCommunityPost]', byData.error.message);
    return { removed: 0, error: byData.error.message };
  }

  const byUrl = await client
    .from('notifications')
    .delete()
    .like('url', `%/community/post/${id}%`)
    .select('id');

  if (byUrl.error) {
    console.warn('[deleteNotificationsForCommunityPost] url cleanup:', byUrl.error.message);
  }

  const removed = new Set([
    ...((byData.data || []) as { id: string }[]).map((row) => row.id),
    ...((byUrl.data || []) as { id: string }[]).map((row) => row.id),
  ]);

  return { removed: removed.size };
}
