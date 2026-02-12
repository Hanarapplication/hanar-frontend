import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Only individual users can follow; businesses and organizations cannot. */
async function isIndividualUser(userId: string): Promise<boolean> {
  const [biz, org] = await Promise.all([
    supabaseAdmin.from('businesses').select('id').eq('owner_id', userId).maybeSingle(),
    supabaseAdmin.from('organizations').select('id').eq('user_id', userId).maybeSingle(),
  ]);
  return !biz.data && !org.data;
}

export async function POST(req: Request) {
  try {
    const { follower_id, following_id } = await req.json();

    if (!follower_id || !following_id) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    if (follower_id === following_id) {
      return NextResponse.json({ success: false, error: 'Cannot follow yourself' }, { status: 400 });
    }

    const canFollow = await isIndividualUser(follower_id);
    if (!canFollow) {
      return NextResponse.json({ success: false, error: 'Only individual accounts can follow other users' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('follows').insert({ follower_id, following_id });

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
