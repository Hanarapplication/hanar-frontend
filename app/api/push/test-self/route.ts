import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient, type User } from '@supabase/supabase-js';

import { isPushConfigured, sendPushToTokensBuilt, type HanarPushBuilt } from '@/lib/firebaseAdmin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * POST /api/push/test-self
 *
 * Same auth as register-token: Bearer (native) preferred, else cookie session.
 * Sends one FCM test to `body.token` only if that token is already stored for this user
 * in `user_push_tokens`. Uses the same Firebase Admin path as production sends.
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
      console.warn('[push/test-self] unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { token?: string };
    try {
      body = (await req.json()) as { token?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const rawToken = (body.token || '').trim();
    if (!rawToken) {
      console.warn('[push/test-self] missing token', { userId: authedUser.id });
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const { data: row, error: selErr } = await supabaseAdmin
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', authedUser.id)
      .eq('token', rawToken)
      .maybeSingle();

    if (selErr) {
      console.error('[push/test-self] select failed', { message: selErr.message, userId: authedUser.id });
      return NextResponse.json({ error: 'Lookup failed', details: selErr.message }, { status: 500 });
    }

    if (!row?.token) {
      console.warn('[push/test-self] token not registered for this user', {
        userId: authedUser.id,
        tokenLength: rawToken.length,
      });
      return NextResponse.json(
        { error: 'Token not found for user', hint: 'Call POST /api/push/register-token first' },
        { status: 404 },
      );
    }

    if (!isPushConfigured()) {
      console.warn('[push/test-self] Firebase Admin not configured (set FIREBASE_SERVICE_ACCOUNT_JSON)');
      return NextResponse.json(
        {
          error: 'Push not configured on server',
          hint: 'Set FIREBASE_SERVICE_ACCOUNT_JSON to the same service account JSON used for production FCM sends.',
          configured: false,
        },
        { status: 503 },
      );
    }

    const push: HanarPushBuilt = {
      title: 'Hanar push test',
      body: 'If you see this, FCM delivery to this device works.',
      linkPath: '/?platform=app',
      type: 'hanar_debug',
    };

    console.log('[push/test-self] sending FCM', { userId: authedUser.id, tokenLength: rawToken.length });

    const fcmResult = await sendPushToTokensBuilt(push, [rawToken]);

    console.log('[push/test-self] FCM result', {
      userId: authedUser.id,
      successCount: fcmResult.successCount,
      failureCount: fcmResult.failureCount,
      invalidTokens: fcmResult.invalidTokens.length,
    });

    return NextResponse.json({
      success: fcmResult.successCount > 0,
      successCount: fcmResult.successCount,
      failureCount: fcmResult.failureCount,
      invalidTokens: fcmResult.invalidTokens,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    console.error('[push/test-self]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
