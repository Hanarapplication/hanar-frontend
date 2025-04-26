import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get('id') as string;
    const username = formData.get('username') as string;
    const bio = formData.get('bio') as string;
    const profile_picture = formData.get('profile_picture') as string | null;

    if (!id || !username) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    // Check if username already exists (but allow if it's the same user)
    const { data: exists, error: checkError } = await supabase
      .from('Profiles')
      .select('id')
      .eq('username', username)
      .neq('id', id)
      .single();

    if (exists) {
      return NextResponse.json({ success: false, error: 'Username already taken' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('Profiles')
      .upsert({ id, username, bio, profile_picture });

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Unexpected server error' }, { status: 500 });
  }
}
