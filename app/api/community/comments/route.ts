import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    const { data: comments, error } = await supabaseAdmin
      .from('community_comments')
      .select('id, post_id, user_id, username, author, text, created_at, likes_comment')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { post_id, text, user_id, username, author } = await req.json();

    if (!post_id || !text || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('community_comments')
      .insert([
        {
          post_id,
          user_id,
          username: username || null,
          author: author || username || 'User',
          identity: 'user',
          text: text.trim(),
          created_at: new Date().toISOString(),
          parent_id: null,
          likes_comment: 0,
        },
      ])
      .select('id, post_id, user_id, username, author, text, created_at, likes_comment')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ comment: inserted });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
