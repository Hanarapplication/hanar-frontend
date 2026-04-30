// Like/unlike a comment; uses community_comment_likes and community_comments.likes

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { usersAreMutuallyBlocked } from '@/lib/userBlocksServer';
import { resolveNotificationActorLabel } from '@/lib/notificationActorLabel';
import { sendPushToUserIds } from '@/lib/pushForUsers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { comment_id, user_id } = await req.json();

    if (!comment_id || !user_id) {
      return NextResponse.json({ error: 'Missing comment_id or user_id' }, { status: 400 });
    }

    const { data: commentRow } = await supabaseAdmin
      .from('community_comments')
      .select('user_id, post_id')
      .eq('id', comment_id)
      .maybeSingle();
    const commentMeta = (commentRow as { user_id?: string | null; post_id?: string | null } | null) || null;
    const commentAuthorId = commentMeta?.user_id;
    const postId = commentMeta?.post_id || null;
    if (commentAuthorId && (await usersAreMutuallyBlocked(supabaseAdmin, user_id, commentAuthorId))) {
      return NextResponse.json({ error: 'Blocked' }, { status: 403 });
    }

    const { data: existing } = await supabaseAdmin
      .from('community_comment_likes')
      .select('id')
      .eq('comment_id', comment_id)
      .eq('user_id', user_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already liked' }, { status: 409 });
    }

    const { error: insertError } = await supabaseAdmin
      .from('community_comment_likes')
      .insert([{ comment_id, user_id }]);

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to like comment' }, { status: 500 });
    }

    const { data: comment } = await supabaseAdmin
      .from('community_comments')
      .select('likes')
      .eq('id', comment_id)
      .single();

    const currentCount = comment?.likes ?? 0;
    await supabaseAdmin
      .from('community_comments')
      .update({ likes: currentCount + 1 })
      .eq('id', comment_id);

    if (commentAuthorId && commentAuthorId !== user_id) {
      const actor = await resolveNotificationActorLabel(supabaseAdmin, user_id);
      const nTitle = `${actor.mention} liked your comment`;
      const nBody = `${actor.mention} liked your comment. Tap to view.`;
      const nUrl = postId ? `/community/post/${postId}` : '/notifications';
      await supabaseAdmin.from('notifications').insert({
        user_id: commentAuthorId,
        type: 'comment_liked',
        title: nTitle,
        body: nBody,
        url: nUrl,
        data: { comment_id, post_id: postId, liked_by: user_id, liker_name: actor.display },
      });
      try {
        await sendPushToUserIds([commentAuthorId], nTitle, nBody, nUrl);
      } catch (pushErr) {
        console.warn('[comment/like] FCM push:', pushErr);
      }
    }

    return NextResponse.json({ success: true, likes: currentCount + 1 }, { status: 200 });
  } catch (err) {
    console.error('Comment like API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const comment_id = searchParams.get('comment_id');
    const user_id = searchParams.get('user_id');

    if (!comment_id || !user_id) {
      return NextResponse.json({ error: 'Missing comment_id or user_id' }, { status: 400 });
    }

    const { data: commentRow } = await supabaseAdmin
      .from('community_comments')
      .select('user_id')
      .eq('id', comment_id)
      .maybeSingle();
    const commentAuthorId = (commentRow as { user_id?: string | null } | null)?.user_id;
    if (commentAuthorId && (await usersAreMutuallyBlocked(supabaseAdmin, user_id, commentAuthorId))) {
      return NextResponse.json({ error: 'Blocked' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('community_comment_likes')
      .delete()
      .eq('comment_id', comment_id)
      .eq('user_id', user_id);

    if (deleteError) {
      console.error('Delete error:', deleteError.message);
      return NextResponse.json({ error: 'Failed to unlike comment' }, { status: 500 });
    }

    const { data: comment } = await supabaseAdmin
      .from('community_comments')
      .select('likes')
      .eq('id', comment_id)
      .single();

    const currentCount = comment?.likes ?? 0;
    await supabaseAdmin
      .from('community_comments')
      .update({ likes: Math.max(0, currentCount - 1) })
      .eq('id', comment_id);

    return NextResponse.json({ success: true, likes: Math.max(0, currentCount - 1) }, { status: 200 });
  } catch (err) {
    console.error('Comment unlike API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
