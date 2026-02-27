/**
 * Full community seed: profiles, posts, comments, and likes.
 * POST /api/seed-community-full
 *
 * Uses public/data/community_seed.json. Inserts in order:
 * 1. profiles (id, username) – seed authors for posts/comments
 * 2. community_posts (with user_id = profile id)
 * 3. community_comments (with post_id, user_id)
 * 4. community_post_likes + update likes_post on posts
 * 5. community_comment_likes + update likes on comments
 *
 * Creates real Auth users (email: username@seed.local) so profiles.id satisfies FK.
 * Re-running reuses existing seed users.
 *
 * Allow up to 5 min so seed works on Vercel (Pro: maxDuration up to 300s).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import seedData from '@/public/data/community_seed.json';
import immigrantPosts from '@/public/data/community_seed_immigrant_posts.json';

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEED_EMAIL_DOMAIN = 'seed.local';
const SEED_PASSWORD = 'SeedLocal1!';

type SeedProfile = { username: string; displayName: string };
type SeedPost = {
  title: string;
  body: string;
  authorIndex: number;
  language: string;
  tags: string[];
  comments: { body: string; authorIndex: number }[];
  likeCount: number;
};

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * DELETE: Remove all community seed content (posts, comments, likes by seed users).
 * Does not delete the seed Auth users/profiles so you can fix seed data and re-seed.
 */
export async function DELETE() {
  try {
    const { data: seedProfiles } = await supabase
      .from('profiles')
      .select('id')
      .like('username', 'seed_%');
    const seedUserIds = (seedProfiles || []).map((p: { id: string }) => p.id);
    if (seedUserIds.length === 0) {
      return NextResponse.json({ message: 'No seed users found. Nothing to delete.', deleted: 0 });
    }

    const { data: seedPosts } = await supabase
      .from('community_posts')
      .select('id')
      .in('user_id', seedUserIds);
    const postIds = (seedPosts || []).map((p: { id: string }) => p.id);
    if (postIds.length === 0) {
      return NextResponse.json({ message: 'No seed posts found.', deleted: 0 });
    }

    const { data: seedComments } = await supabase
      .from('community_comments')
      .select('id')
      .in('post_id', postIds);
    const commentIds = (seedComments || []).map((c: { id: string }) => c.id);

    if (commentIds.length > 0) {
      await supabase.from('community_comment_likes').delete().in('comment_id', commentIds);
    }
    await supabase.from('community_comments').delete().in('post_id', postIds);
    await supabase.from('community_post_likes').delete().in('post_id', postIds);
    await supabase.from('community_posts').delete().in('user_id', seedUserIds);

    return NextResponse.json({
      message: 'All community seed content deleted (posts, comments, likes). Seed users remain; you can fix seed data and re-seed.',
      deleted: { posts: postIds.length, comments: commentIds.length },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete seed error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pastedPosts = Array.isArray(body?.posts) ? body.posts as SeedPost[] : null;

    const { profiles: seedProfiles, posts: basePosts } = seedData as {
      profiles: SeedProfile[];
      posts: SeedPost[];
    };
    const seedPosts: SeedPost[] = pastedPosts !== null
      ? pastedPosts
      : [...(basePosts || []), ...(Array.isArray(immigrantPosts) ? immigrantPosts : [])];

    if (!seedProfiles?.length) {
      return NextResponse.json(
        { error: 'Invalid seed data: need profiles in community_seed.json' },
        { status: 400 }
      );
    }
    if (!seedPosts?.length) {
      return NextResponse.json(
        { error: 'No posts to seed. Add posts to the JSON files or paste a posts array in the request body.' },
        { status: 400 }
      );
    }

    // 1) Create Auth users (so profiles.id satisfies FK), then ensure profiles have username
    const profileIds: string[] = [];
    let existingUsersByEmail: Map<string, string> | null = null; // cache for "already exists" lookups

    for (const p of seedProfiles) {
      const email = `${p.username}@${SEED_EMAIL_DOMAIN}`;
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName, seed: true },
      });

      let userId: string;
      if (authUser?.user?.id) {
        userId = authUser.user.id;
      } else if (
        createError?.message?.includes('already been registered') ||
        (createError?.message?.toLowerCase().includes('already exists') ?? false)
      ) {
        if (!existingUsersByEmail) {
          const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          existingUsersByEmail = new Map(
            (list?.users || []).map((u) => [(u.email ?? '').toLowerCase(), u.id])
          );
        }
        const existingId = existingUsersByEmail.get(email.toLowerCase());
        if (!existingId) {
          return NextResponse.json(
            { error: 'Seed user exists but could not be found', details: createError?.message },
            { status: 500 }
          );
        }
        userId = existingId;
      } else {
        return NextResponse.json(
          { error: 'Failed to create seed user', details: createError?.message },
          { status: 500 }
        );
      }

      profileIds.push(userId);

      const { error: profileError } = await supabase.from('profiles').upsert(
        { id: userId, username: p.username },
        { onConflict: 'id' }
      );
      if (profileError) {
        console.warn('Profile upsert warning:', profileError.message);
      }

      const { error: regError } = await supabase.from('registeredaccounts').upsert(
        {
          user_id: userId,
          username: p.username,
          email,
          full_name: p.displayName,
          business: false,
          organization: false,
        },
        { onConflict: 'user_id' }
      );
      if (regError) {
        console.warn('Registeredaccounts upsert warning (optional):', regError.message);
      }
    }

    // 2) Build set of existing (user_id, title, body) to avoid duplicates
    const { data: existingPosts } = await supabase
      .from('community_posts')
      .select('user_id, title, body')
      .in('user_id', profileIds);
    const existingKeys = new Set(
      (existingPosts || []).map((r: { user_id: string; title: string; body: string }) =>
        `${r.user_id}|${(r.title || '').trim()}|${(r.body || '').trim()}`
      )
    );

    // 3) Insert posts (skip duplicates)
    const postIds: (string | null)[] = [];
    const now = new Date().toISOString();
    for (let i = 0; i < seedPosts.length; i++) {
      const p = seedPosts[i];
      const authorId = profileIds[p.authorIndex >= 0 && p.authorIndex < profileIds.length ? p.authorIndex : 0];
      const authorProfile = seedProfiles[p.authorIndex >= 0 && p.authorIndex < seedProfiles.length ? p.authorIndex : 0];
      const title = p.title.trim();
      const body = p.body.trim();
      const dupKey = `${authorId}|${title}|${body}`;
      if (existingKeys.has(dupKey)) {
        postIds.push(null);
        continue;
      }
      existingKeys.add(dupKey);
      const id = randomUUID();
      postIds.push(id);
      const { error } = await supabase.from('community_posts').insert({
        id,
        title,
        body,
        author: authorProfile?.displayName ?? authorProfile?.username ?? 'User',
        username: authorProfile?.username ?? null,
        user_id: authorId,
        org_id: null,
        author_type: null,
        language: p.language || 'en',
        tags: Array.isArray(p.tags) ? p.tags : [],
        image: null,
        video: null,
        likes_post: 0,
        visibility: 'community',
        deleted: false,
        created_at: now,
      });
      if (error) {
        console.error('Post insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // 4) Insert comments and collect comment ids for likes (only for inserted posts)
    const commentIds: string[] = [];
    const commentIdToPostIndex: Record<string, number> = {};
    for (let postIdx = 0; postIdx < seedPosts.length; postIdx++) {
      const postId = postIds[postIdx];
      if (postId == null) continue;
      const post = seedPosts[postIdx];
      if (!post.comments?.length) continue;
      for (const c of post.comments) {
        const authorId =
          profileIds[c.authorIndex >= 0 && c.authorIndex < profileIds.length ? c.authorIndex : 0];
        const authorProfile =
          seedProfiles[c.authorIndex >= 0 && c.authorIndex < seedProfiles.length ? c.authorIndex : 0];
        const commentId = randomUUID();
        commentIds.push(commentId);
        commentIdToPostIndex[commentId] = postIdx;
        const { error } = await supabase.from('community_comments').insert({
          id: commentId,
          post_id: postId,
          user_id: authorId,
          username: authorProfile?.username ?? null,
          author: authorProfile?.displayName ?? authorProfile?.username ?? 'User',
          author_type: 'user',
          body: c.body.trim(),
          parent_id: null,
          likes: 0,
          dislikes: 0,
          deleted: false,
          created_at: now,
        });
        if (error) {
          console.error('Comment insert error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    // 5) Post likes: for each inserted post, add up to likeCount likes from random profiles
    const postLikePairs: { post_id: string; user_id: string }[] = [];
    for (let postIdx = 0; postIdx < seedPosts.length; postIdx++) {
      if (postIds[postIdx] == null) continue;
      const likeCount = Math.min(seedPosts[postIdx].likeCount ?? 0, profileIds.length);
      const used = new Set<number>();
      for (let L = 0; L < likeCount; L++) {
        let idx = Math.floor(Math.random() * profileIds.length);
        for (let t = 0; t < profileIds.length && used.has(idx); t++) idx = (idx + 1) % profileIds.length;
        if (used.has(idx)) continue;
        used.add(idx);
        postLikePairs.push({ post_id: postIds[postIdx]!, user_id: profileIds[idx] });
      }
    }
    if (postLikePairs.length > 0) {
      const { error: likeErr } = await supabase.from('community_post_likes').insert(postLikePairs);
      if (likeErr) console.warn('Some post likes failed:', likeErr.message);
      // Update likes_post on each post
      for (let postIdx = 0; postIdx < postIds.length; postIdx++) {
        const pid = postIds[postIdx];
        if (pid == null) continue;
        const count = postLikePairs.filter((x) => x.post_id === pid).length;
        if (count > 0) {
          await supabase.from('community_posts').update({ likes_post: count }).eq('id', pid);
        }
      }
    }

    // 6) Comment likes: add a few random likes per comment
    const commentLikePairs: { comment_id: string; user_id: string }[] = [];
    for (const commentId of commentIds) {
      const numLikes = Math.min(3, profileIds.length);
      const used = new Set<number>();
      for (let L = 0; L < numLikes; L++) {
        let idx = Math.floor(Math.random() * profileIds.length);
        for (let t = 0; t < profileIds.length && used.has(idx); t++) idx = (idx + 1) % profileIds.length;
        if (used.has(idx)) continue;
        used.add(idx);
        commentLikePairs.push({ comment_id: commentId, user_id: profileIds[idx] });
      }
    }
    if (commentLikePairs.length > 0) {
      const { error: clErr } = await supabase.from('community_comment_likes').insert(commentLikePairs);
      if (clErr) console.warn('Some comment likes failed:', clErr.message);
      const countByComment: Record<string, number> = {};
      for (const { comment_id } of commentLikePairs) {
        countByComment[comment_id] = (countByComment[comment_id] || 0) + 1;
      }
      for (const [commentId, count] of Object.entries(countByComment)) {
        await supabase.from('community_comments').update({ likes: count }).eq('id', commentId);
      }
    }

    const insertedPosts = postIds.filter((id): id is string => id != null);
    const skippedPosts = seedPosts.length - insertedPosts.length;
    return NextResponse.json({
      message: skippedPosts > 0
        ? `Community seed completed. ${insertedPosts.length} posts added, ${skippedPosts} duplicates skipped.`
        : 'Community seed completed.',
      profiles: profileIds.length,
      posts: insertedPosts.length,
      skipped: skippedPosts,
      comments: commentIds.length,
      postLikes: postLikePairs.length,
      commentLikes: commentLikePairs.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Seed error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
