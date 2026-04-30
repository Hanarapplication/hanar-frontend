import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMutuallyBlockedUserIds, usersAreMutuallyBlocked } from '@/lib/userBlocksServer';
import { resolveNotificationActorLabel } from '@/lib/notificationActorLabel';
import { sendPushToUserIds } from '@/lib/pushForUsers';

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

    let list = comments || [];
    if (userId) {
      const blocked = await getMutuallyBlockedUserIds(supabaseAdmin, userId);
      list = list.filter((c: { user_id: string | null }) => !c.user_id || !blocked.has(c.user_id));
    }
    const commentIds = list.map((c: { id: string }) => c.id);
    const userIds = [...new Set(list.map((c: { user_id: string | null }) => c.user_id).filter(Boolean))] as string[];
    const usernames = [
      ...new Set(
        list
          .map((c: { username?: string | null }) => (typeof c.username === 'string' ? c.username.trim().toLowerCase() : ''))
          .filter(Boolean)
      ),
    ] as string[];

    let profileMap: Record<string, { profile_pic_url: string | null }> = {};
    let orgLogoMap: Record<string, string | null> = {};
    let businessLogoMap: Record<string, string | null> = {};
    let businessSlugMap: Record<string, string | null> = {};
    if (userIds.length > 0 || usernames.length > 0) {
      const [{ data: profiles }, { data: organizations }, { data: businesses }, { data: businessesBySlug }] = await Promise.all([
        userIds.length > 0
          ? supabaseAdmin
              .from('profiles')
              .select('id, profile_pic_url')
              .in('id', userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabaseAdmin
              .from('organizations')
              .select('user_id, logo_url')
              .in('user_id', userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabaseAdmin
              .from('businesses')
              .select('owner_id, logo_url, created_at')
              .in('owner_id', userIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        usernames.length > 0
          ? supabaseAdmin
              .from('businesses')
              .select('slug, logo_url')
              .in('slug', usernames)
          : Promise.resolve({ data: [] }),
      ]);
      profileMap = (profiles || []).reduce(
        (acc, p: { id: string; profile_pic_url: string | null }) => {
          acc[p.id] = { profile_pic_url: p.profile_pic_url ?? null };
          return acc;
        },
        {} as Record<string, { profile_pic_url: string | null }>
      );
      orgLogoMap = (organizations || []).reduce(
        (acc, o: { user_id: string; logo_url: string | null }) => {
          if (!(o.user_id in acc)) acc[o.user_id] = o.logo_url ?? null;
          return acc;
        },
        {} as Record<string, string | null>
      );
      businessLogoMap = (businesses || []).reduce(
        (acc, b: { owner_id: string; logo_url: string | null }) => {
          if (!(b.owner_id in acc)) acc[b.owner_id] = b.logo_url ?? null;
          return acc;
        },
        {} as Record<string, string | null>
      );
      businessSlugMap = (businessesBySlug || []).reduce(
        (acc, b: { slug: string; logo_url: string | null }) => {
          const key = String(b.slug || '').trim().toLowerCase();
          if (key && !(key in acc)) acc[key] = b.logo_url ?? null;
          return acc;
        },
        {} as Record<string, string | null>
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

    const commentsWithProfiles = list.map((c: { id: string; user_id: string | null; author_type?: string | null; username?: string | null }) => {
      const usernameKey = typeof c.username === 'string' ? c.username.trim().toLowerCase() : '';
      const slugLogo = usernameKey ? businessSlugMap[usernameKey] ?? null : null;
      const ownerLogo = c.user_id ? businessLogoMap[c.user_id] ?? null : null;
      const orgLogo = c.user_id ? orgLogoMap[c.user_id] ?? null : null;
      const profilePic = c.user_id ? profileMap[c.user_id]?.profile_pic_url ?? null : null;

      return {
        ...c,
        profiles: c.user_id ? profileMap[c.user_id] ?? null : null,
        logo_url:
          c.user_id && c.author_type === 'organization'
            ? orgLogo
            : c.user_id && c.author_type === 'business'
              ? slugLogo ?? ownerLogo
              : slugLogo,
        avatar_url:
          c.user_id && c.author_type === 'organization'
            ? orgLogo
            : c.user_id && c.author_type === 'business'
              ? slugLogo ?? ownerLogo ?? profilePic
              : slugLogo ?? (c.user_id ? profilePic ?? orgLogo ?? ownerLogo : null),
        user_liked: likedCommentIds.has(c.id),
      };
    });

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
      return NextResponse.json({ error: 'Missing required fields. You must be logged in to comment.' }, { status: 400 });
    }

    const authorVal = typeof author === 'string' ? author.trim() : '';
    if (authorVal && authorVal.toLowerCase() === 'anonymous') {
      return NextResponse.json({ error: 'Anonymous commenting is not allowed. Please comment with your profile.' }, { status: 400 });
    }

    const normalizedUsername = typeof username === 'string' ? username.trim() : '';

    const [{ data: org }, { data: businessBySlug }, { data: latestBusiness }] = await Promise.all([
      supabaseAdmin
        .from('organizations')
        .select('id, logo_url')
        .eq('user_id', user_id)
        .maybeSingle(),
      supabaseAdmin
        .from('businesses')
        .select('id, logo_url, business_name, slug')
        .eq('owner_id', user_id)
        .eq('slug', normalizedUsername)
        .maybeSingle(),
      supabaseAdmin
        .from('businesses')
        .select('id, logo_url, business_name, slug, created_at')
        .eq('owner_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const business = businessBySlug || latestBusiness || null;
    const inferredAuthorType: 'organization' | 'business' | 'user' =
      business?.id ? 'business' : org?.id ? 'organization' : 'user';
    const usernameForRow =
      inferredAuthorType === 'business'
        ? (business?.slug ? business.slug : normalizedUsername || null)
        : (normalizedUsername || null);
    const displayAuthor =
      inferredAuthorType === 'business'
        ? (business?.business_name?.trim() || authorVal || usernameForRow || 'User')
        : authorVal || usernameForRow || 'User';

    const { data: postRow } = await supabaseAdmin
      .from('community_posts')
      .select('user_id')
      .eq('id', post_id)
      .maybeSingle();
    const postAuthorId = (postRow as { user_id?: string } | null)?.user_id;
    if (postAuthorId && (await usersAreMutuallyBlocked(supabaseAdmin, user_id, postAuthorId))) {
      return NextResponse.json({ error: 'You cannot comment on this post' }, { status: 403 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('community_comments')
      .insert([
        {
          post_id,
          user_id,
          username: usernameForRow,
          author: displayAuthor,
          author_type: inferredAuthorType,
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
        const actor = await resolveNotificationActorLabel(supabaseAdmin, inserted.user_id);
        const bodySnippet = body.length > 80 ? `${body.slice(0, 80)}…` : body;
        const nTitle = `${actor.mention} commented on your post`;
        const nBody = `${actor.mention}: ${bodySnippet}. Tap to view.`;
        const nUrl = `/community/post/${inserted.post_id}`;
        await supabaseAdmin.from('notifications').insert({
          user_id: postAuthorId,
          type: 'comment_on_post',
          title: nTitle,
          body: nBody,
          url: nUrl,
          data: { post_id: inserted.post_id, comment_id: inserted.id, commenter_name: actor.display },
        });
        try {
          await sendPushToUserIds([postAuthorId], nTitle, nBody, nUrl);
        } catch (pushErr) {
          console.warn('[community/comments] FCM push:', pushErr);
        }
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

    const avatarUrl =
      inferredAuthorType === 'organization'
        ? org?.logo_url ?? null
        : inferredAuthorType === 'business'
          ? business?.logo_url ?? profiles?.profile_pic_url ?? null
          : profiles?.profile_pic_url ?? org?.logo_url ?? business?.logo_url ?? null;
    const logoUrl = inferredAuthorType === 'organization' ? org?.logo_url ?? null : inferredAuthorType === 'business' ? business?.logo_url ?? null : null;

    return NextResponse.json({
      comment: { ...inserted, profiles, logo_url: logoUrl, avatar_url: avatarUrl, likes: inserted?.likes ?? 0 },
    });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
