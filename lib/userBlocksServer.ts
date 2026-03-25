import type { SupabaseClient } from '@supabase/supabase-js';

/** All user IDs that have a block relationship with viewer (either direction). */
export async function getMutuallyBlockedUserIds(
  admin: SupabaseClient,
  viewerUserId: string
): Promise<Set<string>> {
  const { data, error } = await admin
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${viewerUserId},blocked_id.eq.${viewerUserId}`);

  if (error || !data) return new Set();

  const set = new Set<string>();
  for (const row of data as { blocker_id: string; blocked_id: string }[]) {
    if (row.blocker_id === viewerUserId) set.add(row.blocked_id);
    else set.add(row.blocker_id);
  }
  return set;
}

export async function usersAreMutuallyBlocked(
  admin: SupabaseClient,
  a: string,
  b: string
): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const { data: r1 } = await admin
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', a)
    .eq('blocked_id', b)
    .maybeSingle();
  if (r1) return true;
  const { data: r2 } = await admin
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', b)
    .eq('blocked_id', a)
    .maybeSingle();
  return !!r2;
}
