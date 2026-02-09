// Create a comment/reply under a community post (uses body, author_type)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { post_id, parent_id, author, author_type, text, user_id, username } = await req.json();
    const body = typeof text === 'string' ? text.trim() : '';

    if (!post_id || !author || !body || !user_id || body.length < 3) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('community_comments')
      .insert([
        {
          post_id,
          parent_id: parent_id || null,
          author,
          author_type: author_type || 'user',
          username: username || null,
          body,
          user_id,
          likes: 0,
          dislikes: 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    console.error('Comment reply error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
