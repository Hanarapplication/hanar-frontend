import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = [
  'owner', 'ceo', 'topmanager', 'manager',
  'reviewer', 'moderator', 'support', 'editor', 'readonly', 'business',
];

async function verifyAdmin(req: Request): Promise<{ id: string; email: string } | null> {
  let user: { id: string; email?: string } | null = null;

  const supabaseServer = createRouteHandlerClient({ cookies });
  const { data: { user: cookieUser }, error } = await supabaseServer.auth.getUser();
  if (!error && cookieUser) user = cookieUser;

  if (!user && req && ANON_KEY) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      const supabaseAnon = createClient(SUPABASE_URL!, ANON_KEY, {
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

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const businessId = (id || '').trim();
    if (!businessId) {
      return NextResponse.json({ error: 'Missing business id' }, { status: 400 });
    }

    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, moderation_status')
      .eq('id', businessId)
      .single();

    if (fetchError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('businesses')
      .update({
        moderation_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      business_id: businessId,
      moderation_status: 'active',
    });
  } catch (err) {
    console.error('approve business error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
