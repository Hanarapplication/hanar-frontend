import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { notifyBusinessModerationTransition } from '@/lib/email/businessModerationTransition';

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

type NoteEntry = { note: string; timestamp: string };

const ALLOWED_BUSINESS_UPDATE_KEYS = [
  'moderation_status',
  'lifecycle_status',
  'is_archived',
  'status',
  'verified_info',
  'admin_note',
  'note_history',
  'updated_at',
] as const;

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

/**
 * Admin: update business moderation-related fields (same whitelist as approvals UI).
 * Sends transactional email only when `moderation_status` actually changes.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const businessId = (id || '').trim();
    if (!businessId) {
      return NextResponse.json({ error: 'Missing business id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      updates?: Record<string, unknown>;
      noteToSave?: string;
    } | null;
    if (!body || typeof body.updates !== 'object' || body.updates === null) {
      return NextResponse.json({ error: 'Invalid body: updates object required' }, { status: 400 });
    }

    const updatesPayload = body.updates;
    const noteToSave = typeof body.noteToSave === 'string' ? body.noteToSave.trim() : '';

    const hasKeyedUpdates = ALLOWED_BUSINESS_UPDATE_KEYS.some(
      (key) => key !== 'updated_at' && key in updatesPayload && updatesPayload[key] !== undefined
    );
    if (!hasKeyedUpdates && !noteToSave) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, moderation_status, note_history, owner_id, email, business_name, slug')
      .eq('id', businessId)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const oldModeration = row.moderation_status;

    const finalUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of ALLOWED_BUSINESS_UPDATE_KEYS) {
      if (key === 'updated_at') continue;
      if (key in updatesPayload && updatesPayload[key] !== undefined) {
        finalUpdates[key] = updatesPayload[key];
      }
    }

    if (noteToSave) {
      finalUpdates.admin_note = noteToSave;
      const currentHistory = (Array.isArray(row.note_history) ? row.note_history : []) as NoteEntry[];
      const newEntry: NoteEntry = { note: noteToSave, timestamp: new Date().toISOString() };
      finalUpdates.note_history = [...currentHistory, newEntry];
    }

    const { error: updateError } = await supabaseAdmin.from('businesses').update(finalUpdates).eq('id', businessId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const moderationChanged =
      typeof finalUpdates.moderation_status === 'string' &&
      String(finalUpdates.moderation_status) !== String(oldModeration);

    if (moderationChanged) {
      const nextMod = String(finalUpdates.moderation_status);
      const reasonForEmail =
        nextMod === 'rejected' || nextMod === 'on_hold' ? (noteToSave || null) : null;

      try {
        await notifyBusinessModerationTransition(supabaseAdmin, {
          fromModeration: oldModeration,
          toModeration: nextMod,
          businessName: String(row.business_name || ''),
          slug: row.slug,
          ownerId: row.owner_id,
          rowEmail: row.email,
          reason: reasonForEmail,
        });
      } catch {
        console.warn('[admin/businesses/moderation] moderation email helper failed');
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('admin businesses moderation error:', err instanceof Error ? err.name : 'unknown');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
