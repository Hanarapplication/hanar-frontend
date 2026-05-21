/** Append a cache-busting query param for avatar URLs (same storage path, new bytes). */
export function withAvatarCacheBust(url: string | null | undefined, version?: string | number): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  const base = trimmed.split('?')[0];
  const v = version ?? Date.now();
  return `${base}?v=${encodeURIComponent(String(v))}`;
}

export function normalizeAvatarUrl(value?: string | null, buckets: string[] = []): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (trimmed.startsWith('/storage/v1/object/public/')) return base ? `${base}${trimmed}` : trimmed;
  if (trimmed.startsWith('storage/v1/object/public/')) return base ? `${base}/${trimmed}` : `/${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  for (const bucket of buckets) {
    const normalizedPath = trimmed.startsWith(`${bucket}/`)
      ? trimmed.slice(bucket.length + 1)
      : trimmed;
    if (base) return `${base}/storage/v1/object/public/${bucket}/${normalizedPath}`;
  }
  return trimmed;
}
