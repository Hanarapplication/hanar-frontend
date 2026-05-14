import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Business contact email: public `businesses.email` first, then Auth user email for `owner_id`.
 */
export async function resolveBusinessContactEmail(
  supabaseAdmin: SupabaseClient,
  args: { email?: string | null; owner_id?: string | null }
): Promise<string | null> {
  const direct = typeof args.email === 'string' && args.email.trim() ? args.email.trim() : '';
  if (direct) return direct;
  if (!args.owner_id) return null;
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(args.owner_id);
  if (error || !data?.user?.email) return null;
  return String(data.user.email).trim();
}
