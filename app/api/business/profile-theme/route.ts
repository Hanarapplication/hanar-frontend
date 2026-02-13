import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { PROFILE_THEMES, canUseProfileTheme, type ProfileThemeId } from '@/lib/profileThemes';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function getAuthUserId(req: Request): Promise<string | null> {
  const supabaseAuth = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (user?.id) return user.id;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

/** PATCH: set business profile theme (allowed themes depend on plan). */
export async function PATCH(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const theme = typeof body.theme === 'string' ? body.theme.trim().toLowerCase() : '';
    if (!theme || !PROFILE_THEMES.includes(theme as ProfileThemeId)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, plan')
      .eq('owner_id', userId)
      .maybeSingle();

    if (fetchError || !business?.id) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const plan = business.plan ? String(business.plan).toLowerCase() : 'free';
    if (!canUseProfileTheme(plan, theme as ProfileThemeId)) {
      return NextResponse.json({ error: 'This design is not available on your plan' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('businesses')
      .update({ profile_theme: theme })
      .eq('id', business.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ theme });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
