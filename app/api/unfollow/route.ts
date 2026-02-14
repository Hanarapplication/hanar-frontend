import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Individuals and organizations can unfollow (same rule as follow). */
async function canUnfollow(userId: string): Promise<boolean> {
  const { data: biz } = await supabaseAdmin.from('businesses').select('id').eq('owner_id', userId).maybeSingle();
  return !biz;
}

export async function POST(req: Request) {
  try {
    const { follower_id, following_id } = await req.json();

    if (!follower_id || !following_id) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const allowed = await canUnfollow(follower_id);
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Only individual and organization accounts can unfollow' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('follows')
      .delete()
      .match({ follower_id, following_id });

    if (error) {
      console.error(error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Unexpected server error' }, { status: 500 });
  }
}
