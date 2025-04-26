import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ available: false, error: 'No username provided' }, { status: 400 });
    }

    const { data, error } = await supabase.from('Profiles').select('id').eq('username', username).single();

    if (error || !data) {
      return NextResponse.json({ available: true }, { status: 200 });
    } else {
      return NextResponse.json({ available: false }, { status: 200 });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ available: false, error: 'Unexpected server error' }, { status: 500 });
  }
}
