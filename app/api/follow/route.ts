import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { follower_id, following_id } = await req.json();

    if (!follower_id || !following_id) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const { error } = await supabase.from('Follows').insert({ follower_id, following_id });

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
