import type { SupabaseClient } from '@supabase/supabase-js';

/** Count non-deleted comments per post (soft-deleted rows use `deleted: true`). */
export async function getActiveCommentCountsByPostId(
  client: SupabaseClient,
  postIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(postIds.map((id) => String(id)))].filter(Boolean);
  const out: Record<string, number> = {};
  unique.forEach((id) => {
    out[id] = 0;
  });
  if (unique.length === 0) return out;

  const { data, error } = await client
    .from('community_comments')
    .select('post_id')
    .in('post_id', unique)
    .or('deleted.is.null,deleted.eq.false');

  if (error) {
    console.error('[getActiveCommentCountsByPostId]', error.message);
    return out;
  }

  for (const row of data || []) {
    const pid = String((row as { post_id?: string | number | null }).post_id ?? '');
    if (pid && pid in out) out[pid] += 1;
  }
  return out;
}

/** Like totals from `community_post_likes` (source of truth vs denormalized `likes_post`). */
export async function getLikeCountsByPostId(
  client: SupabaseClient,
  postIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(postIds.map((id) => String(id)))].filter(Boolean);
  const out: Record<string, number> = {};
  unique.forEach((id) => {
    out[id] = 0;
  });
  if (unique.length === 0) return out;

  const { data, error } = await client.from('community_post_likes').select('post_id').in('post_id', unique);

  if (error) {
    console.error('[getLikeCountsByPostId]', error.message);
    return out;
  }

  for (const row of data || []) {
    const pid = String((row as { post_id?: string | number | null }).post_id ?? '');
    if (pid && pid in out) out[pid] += 1;
  }
  return out;
}

/** Aligns comment pill and like count with DB tables (non-deleted comments + like rows). */
export async function patchPostsWithActiveCommentCounts<T extends { id: string }>(
  client: SupabaseClient,
  posts: T[]
): Promise<T[]> {
  if (posts.length === 0) return posts;
  const ids = posts.map((p) => String(p.id));
  const [commentMap, likeMap] = await Promise.all([
    getActiveCommentCountsByPostId(client, ids),
    getLikeCountsByPostId(client, ids),
  ]);
  return posts.map((p) => {
    const id = String(p.id);
    return {
      ...p,
      community_comments: [{ count: commentMap[id] ?? 0 }],
      likes_post: likeMap[id] ?? 0,
    };
  }) as T[];
}
