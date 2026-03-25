import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/authApi';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get('otherUserId')?.trim();
    if (!otherUserId || otherUserId === userId) {
      return NextResponse.json({
        mutuallyBlocked: false,
        iBlockedThem: false,
        theyBlockedMe: false,
      });
    }

    const { data: iBlocked } = await supabaseAdmin
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', otherUserId)
      .maybeSingle();

    const { data: theyBlocked } = await supabaseAdmin
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', otherUserId)
      .eq('blocked_id', userId)
      .maybeSingle();

    const mutuallyBlocked = !!(iBlocked || theyBlocked);

    return NextResponse.json({
      mutuallyBlocked,
      iBlockedThem: !!iBlocked,
      theyBlockedMe: !!theyBlocked,
    });
  } catch (err) {
    console.error('[block-status]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
