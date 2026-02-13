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

    const authorTrimmed = typeof author === 'string' ? author.trim() : '';
    if (authorTrimmed.toLowerCase() === 'anonymous') {
      return NextResponse.json({ error: 'Anonymous commenting is not allowed. Please comment with your profile.' }, { status: 400 });
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

    // Notify post author about the new comment/reply (do not notify self)
    if (data?.post_id && data?.user_id) {
      const { data: post } = await supabaseAdmin
        .from('community_posts')
        .select('user_id')
        .eq('id', data.post_id)
        .maybeSingle();
      const postAuthorId = (post as { user_id?: string } | null)?.user_id;
      if (postAuthorId && postAuthorId !== data.user_id) {
        const commenterName = data.author || data.username || 'Someone';
        const bodySnippet = body.length > 80 ? `${body.slice(0, 80)}…` : body;
        await supabaseAdmin.from('notifications').insert({
          user_id: postAuthorId,
          type: 'comment_on_post',
          title: 'Your post received a comment',
          body: `${commenterName}: ${bodySnippet}. Tap to view.`,
          url: `/community/post/${data.post_id}`,
          data: { post_id: data.post_id, comment_id: data.id, commenter_name: commenterName },
        });
      }
    }

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    console.error('Comment reply error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
