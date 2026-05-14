import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly', 'business',
];

/**
 * Resolves an admin user from session cookie or Bearer token + adminaccounts role.
 * Used by admin APIs that need the acting admin id (e.g. marketplace notes).
 */
export async function verifyAdminAccount(
  req: Request,
  supabaseAdmin: SupabaseClient
): Promise<{ id: string; email: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  let user: { id: string; email?: string } | null = null;

  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user: cookieUser }, error } = await supabaseServer.auth.getUser();
  if (!error && cookieUser) user = cookieUser;

  if (!user && ANON_KEY) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user: tokenUser } } = await supabaseAnon.auth.getUser();
      if (tokenUser) user = tokenUser;
    }
  }

  if (!user?.id || !user?.email) return null;

  const { data: adminData } = await supabaseAdmin
    .from('adminaccounts')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const roleData =
    adminData ??
    (await supabaseAdmin.from('adminaccounts').select('role').eq('email', user.email!.toLowerCase()).maybeSingle())
      .data;

  if (!roleData?.role || !allowedRoles.includes(roleData.role)) return null;
  return { id: user.id, email: user.email };
}
