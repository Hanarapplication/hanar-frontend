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
    const userId = searchParams.get('userId');

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    const { data: comments, error } = await supabaseAdmin
      .from('community_comments')
      .select('id, post_id, user_id, username, author, body, created_at, likes, parent_id, author_type, deleted')
      .eq('post_id', postId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const list = comments || [];
    const commentIds = list.map((c: { id: string }) => c.id);
    const userIds = [...new Set(list.map((c: { user_id: string | null }) => c.user_id).filter(Boolean))] as string[];

    let profileMap: Record<string, { profile_pic_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, profile_pic_url')
        .in('id', userIds);
      profileMap = (profiles || []).reduce(
        (acc, p: { id: string; profile_pic_url: string | null }) => {
          acc[p.id] = { profile_pic_url: p.profile_pic_url ?? null };
          return acc;
        },
        {} as Record<string, { profile_pic_url: string | null }>
      );
    }

    let likedCommentIds = new Set<string>();
    if (userId && commentIds.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from('community_comment_likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds);
      likedCommentIds = new Set((likes || []).map((r: { comment_id: string }) => r.comment_id));
    }

    const commentsWithProfiles = list.map((c: { id: string; user_id: string | null }) => ({
      ...c,
      profiles: c.user_id ? profileMap[c.user_id] ?? null : null,
      user_liked: likedCommentIds.has(c.id),
    }));

    return NextResponse.json({ comments: commentsWithProfiles });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { post_id, text, user_id, username, author } = await req.json();
    const body = typeof text === 'string' ? text.trim() : '';

    if (!post_id || !body || !user_id) {
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
          author_type: 'user',
          body,
          parent_id: null,
          likes: 0,
          dislikes: 0,
        },
      ])
      .select('id, post_id, user_id, username, author, body, created_at, likes, parent_id, author_type')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Notify post author about the new comment (do not notify self)
    if (inserted?.post_id && inserted?.user_id) {
      const { data: post } = await supabaseAdmin
        .from('community_posts')
        .select('user_id')
        .eq('id', inserted.post_id)
        .maybeSingle();
      const postAuthorId = (post as { user_id?: string } | null)?.user_id;
      if (postAuthorId && postAuthorId !== inserted.user_id) {
        const commenterName = inserted.author || inserted.username || 'Someone';
        const bodySnippet = body.length > 80 ? `${body.slice(0, 80)}…` : body;
        await supabaseAdmin.from('notifications').insert({
          user_id: postAuthorId,
          type: 'comment_on_post',
          title: 'Your post received a comment',
          body: `${commenterName}: ${bodySnippet}. Tap to view.`,
          url: `/community/post/${inserted.post_id}`,
          data: { post_id: inserted.post_id, comment_id: inserted.id, commenter_name: commenterName },
        });
      }
    }

    let profiles: { profile_pic_url: string | null } | null = null;
    if (inserted?.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('profile_pic_url')
        .eq('id', inserted.user_id)
        .maybeSingle();
      if (profile) profiles = { profile_pic_url: profile.profile_pic_url ?? null };
    }

    return NextResponse.json({
      comment: { ...inserted, profiles, likes: inserted?.likes ?? 0 },
    });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
