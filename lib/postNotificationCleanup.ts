import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationWithPostRef = {
  id: string;
  type?: string | null;
  url?: string | null;
  data?: {
    post_id?: string | number | null;
    business_id?: string | null;
    [key: string]: unknown;
  } | null;
};

/** Resolve community post id from notification payload or deep link. */
export function getPostIdFromNotification(row: NotificationWithPostRef): string | null {
  const fromData = row.data?.post_id;
  if (fromData != null && String(fromData).trim()) return String(fromData).trim();
  const url = row.url || '';
  const match = url.match(/\/community\/post\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Post ids that are missing or soft-deleted. */
export async function findInactivePostIds(
  client: SupabaseClient,
  postIds: string[]
): Promise<Set<string>> {
  const unique = [...new Set(postIds.map(String).filter(Boolean))];
  if (unique.length === 0) return new Set();

  const { data, error } = await client
    .from('community_posts')
    .select('id, deleted')
    .in('id', unique);

  if (error) {
    console.error('[findInactivePostIds]', error.message);
    return new Set();
  }

  const rowsById = new Map(
    (data || []).map((row) => [
      String((row as { id: string }).id),
      row as { id: string; deleted?: boolean | null },
    ])
  );

  const inactive = new Set<string>();
  for (const id of unique) {
    const row = rowsById.get(id);
    if (!row || row.deleted) inactive.add(id);
  }
  return inactive;
}

/** Drop notifications for deleted/missing posts and delete those stale rows. */
export async function removeNotificationsForInactivePosts<T extends NotificationWithPostRef>(
  client: SupabaseClient,
  rows: T[]
): Promise<{ visible: T[]; removedIds: string[] }> {
  const postIds = rows
    .map(getPostIdFromNotification)
    .filter((id): id is string => !!id);

  if (postIds.length === 0) return { visible: rows, removedIds: [] };

  const inactiveIds = await findInactivePostIds(client, postIds);
  if (inactiveIds.size === 0) return { visible: rows, removedIds: [] };

  const removedIds = rows
    .filter((row) => {
      const postId = getPostIdFromNotification(row);
      return postId != null && inactiveIds.has(postId);
    })
    .map((row) => row.id);

  if (removedIds.length === 0) return { visible: rows, removedIds: [] };

  const removedSet = new Set(removedIds);
  const visible = rows.filter((row) => !removedSet.has(row.id));

  const { error } = await client.from('notifications').delete().in('id', removedIds);
  if (error) console.error('[removeNotificationsForInactivePosts]', error.message);

  return { visible, removedIds };
}
