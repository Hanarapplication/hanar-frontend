// this is api is for creating a comment under community post

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const { post_id, parent_id, author, identity, text, user_id } = await req.json();

    if (!post_id || !author || !identity || !text || !user_id || text.trim().length < 3) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('community_comments')
      .insert([
        {
          post_id,
          parent_id: parent_id || null,
          author,
          identity,
          text: text.trim(),
          user_id,
        },
      ])
      .select();

    if (error) throw error;
    return NextResponse.json({ comment: data?.[0] }, { status: 201 });
  } catch (err) {
    console.error('Comment reply error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
