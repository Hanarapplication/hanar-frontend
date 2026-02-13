import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { PROFILE_TEMPLATES, PROFILE_THEMES } from '@/components/business-profile/theme/tokens';
import type { ProfileTemplateId, ProfileThemeId } from '@/components/business-profile/theme/tokens';

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

/** PATCH: update profile_template, theme, accent_color. Premium only for non-defaults. */
export async function PATCH(req: Request) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const template = typeof body.profile_template === 'string' ? body.profile_template.trim().toLowerCase() : undefined;
    const theme = typeof body.theme === 'string' ? body.theme.trim().toLowerCase() : undefined;
    const accentColor = typeof body.accent_color === 'string' ? body.accent_color.trim() || null : undefined;

    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, plan')
      .eq('owner_id', userId)
      .maybeSingle();

    if (fetchError || !business?.id) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const isPremium = (business.plan ?? '').toString().toLowerCase() === 'premium';

    const updates: Record<string, unknown> = {};

    if (template !== undefined) {
      if (!PROFILE_TEMPLATES.includes(template as ProfileTemplateId)) {
        return NextResponse.json({ error: 'Invalid profile_template' }, { status: 400 });
      }
      if (!isPremium && template !== 'brand') {
        return NextResponse.json({ error: 'Profile template selection is for Premium only' }, { status: 403 });
      }
      updates.profile_template = template;
    }

    if (theme !== undefined) {
      if (!PROFILE_THEMES.includes(theme as ProfileThemeId)) {
        return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
      }
      if (!isPremium && theme !== 'classic') {
        return NextResponse.json({ error: 'Theme selection is for Premium only' }, { status: 403 });
      }
      updates.theme = theme;
    }

    if (accentColor !== undefined) {
      if (accentColor !== null && !/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
        return NextResponse.json({ error: 'accent_color must be a hex color or null' }, { status: 400 });
      }
      if (!isPremium && accentColor !== null && accentColor !== '') {
        return NextResponse.json({ error: 'Accent color is for Premium only' }, { status: 403 });
      }
      updates.accent_color = accentColor;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { error: updateError } = await supabaseAdmin
      .from('businesses')
      .update(updates)
      .eq('id', business.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...updates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
