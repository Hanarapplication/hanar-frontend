import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient, type User } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * POST /api/push/register-token
 *
 * Native WebView contract (Hanar Flutter shell):
 * - After login the site redirects to `hanar://auth?access_token=...` when the shell is detected
 *   (User-Agent `HanarNativeApp` and/or query `from=app`, `platform=app`, etc. — see `lib/hanarAppAuthRedirect.ts`).
 * - The app stores the Supabase JWT and calls this route with `Authorization: Bearer <jwt>`.
 * - Outbound FCM uses `lib/firebaseAdmin.ts` + `sendPushToUserIds` / `user_push_tokens`; tray delivery
 *   requires a `notification` block + Android channel `hanar_high_importance_channel`.
 *
 * Auth: prefer Bearer when present (native), else cookie session (browser).
 * Body: `{ "token": string, "platform"?: "android" | "ios" }` — platform defaults to `android`.
 * Persists to `user_push_tokens`; deletes any prior row with the same `token` then upserts so one
 * token maps to one user.
 */
export async function POST(req: Request) {
  try {
    let authedUser: User | null = null;

    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (bearer) {
      const { data, error } = await supabaseAdmin.auth.getUser(bearer);
      if (!error && data.user) authedUser = data.user;
    }

    if (!authedUser) {
      const supabaseServer = createRouteHandlerClient({ cookies });
      const {
        data: { user },
      } = await supabaseServer.auth.getUser();
      authedUser = user ?? null;
    }

    if (!authedUser) {
      console.warn('[push/register-token] unauthorized (no valid Bearer or cookie session)');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { token?: string; platform?: string };
    try {
      body = (await req.json()) as { token?: string; platform?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const rawToken = (body.token || '').trim();
    if (!rawToken) {
      console.warn('[push/register-token] missing FCM token body', { userId: authedUser.id });
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const platform: 'android' | 'ios' =
      body.platform === 'ios' || body.platform === 'android' ? body.platform : 'android';
    const now = new Date().toISOString();

    const { error: deleteErr } = await supabaseAdmin
      .from('user_push_tokens')
      .delete({ count: 'exact' })
      .eq('token', rawToken);

    if (deleteErr) {
      console.error('[push/register-token] save result', {
        userId: authedUser.id,
        tokenLength: rawToken.length,
        platform,
        saved: false,
        message: deleteErr.message,
        code: deleteErr.code,
      });
      return NextResponse.json(
        { error: 'Failed to clear previous token row', details: deleteErr.message },
        { status: 500 },
      );
    }

    const { error: upsertErr } = await supabaseAdmin.from('user_push_tokens').upsert(
      {
        user_id: authedUser.id,
        token: rawToken,
        platform,
        updated_at: now,
      },
      { onConflict: 'token' },
    );

    if (upsertErr) {
      console.error('[push/register-token] save result', {
        userId: authedUser.id,
        tokenLength: rawToken.length,
        platform,
        saved: false,
        message: upsertErr.message,
        code: upsertErr.code,
      });
      return NextResponse.json({ error: 'Failed to save token', details: upsertErr.message }, { status: 500 });
    }

    console.log('[push/register-token] save result', {
      userId: authedUser.id,
      tokenLength: rawToken.length,
      platform,
      saved: true,
    });

    return NextResponse.json({ success: true, userId: authedUser.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[push/register-token] save result', { saved: false, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
