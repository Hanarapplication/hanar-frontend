/** Removes a comment and every descendant (by parent_id chain) from a flat list. */
export function removeCommentBranch<T extends { id: string; parent_id?: string | null }>(
  list: T[],
  rootId: string
): T[] {
  const ids = new Set<string>([rootId]);
  let growing = true;
  while (growing) {
    growing = false;
    for (const row of list) {
      const p = row.parent_id ?? null;
      if (p && ids.has(p) && !ids.has(row.id)) {
        ids.add(row.id);
        growing = true;
      }
    }
  }
  return list.filter((c) => !ids.has(c.id));
}
