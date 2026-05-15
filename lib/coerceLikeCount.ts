/** Normalizes API like totals (number, numeric string, or common object shapes). */
export function coerceLikeCount(value: unknown): number {
  if (typeof value === 'bigint') return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.likes_post === 'number' || typeof obj.likes_post === 'string') return coerceLikeCount(obj.likes_post);
    if (typeof obj.likes === 'number' || typeof obj.likes === 'string') return coerceLikeCount(obj.likes);
    if (typeof obj.likes_count === 'number' || typeof obj.likes_count === 'string') return coerceLikeCount(obj.likes_count);
    if (typeof obj.count === 'number' || typeof obj.count === 'string') return coerceLikeCount(obj.count);
    if (typeof obj.value === 'number' || typeof obj.value === 'string') return coerceLikeCount(obj.value);
  }
  return 0;
}
