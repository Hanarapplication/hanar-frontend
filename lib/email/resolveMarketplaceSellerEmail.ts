import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Loads the seller’s login email from Supabase Auth using the marketplace row’s `user_id`.
 */
export async function resolveMarketplaceSellerEmail(
  supabaseAdmin: SupabaseClient,
  userId: string | null | undefined
): Promise<string | null> {
  const id = (userId ?? '').trim();
  if (!id) return null;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error || !data?.user?.email) return null;
    const email = String(data.user.email).trim();
    return email || null;
  } catch {
    return null;
  }
}
