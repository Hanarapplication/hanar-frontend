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
 * Re-running reuses existing seed users. Supports up to 200 profiles (seed_001–seed_200).
 *
 * maxDuration 60s (Vercel Hobby limit). For large seeds, run from local or upgrade to Pro (up to 300s).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import seedData from '@/public/data/community_seed.json';
import immigrantPosts from '@/public/data/community_seed_immigrant_posts.json';
import langIndicesByLanguage from '@/public/data/seed_author_indices_by_language.json';

export const maxDuration = 60;

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

function collectAuthorIndices(posts: SeedPost[]): Set<number> {
  const needed = new Set<number>();
  for (const post of posts) {
    needed.add(post.authorIndex);
    for (const c of post.comments ?? []) needed.add(c.authorIndex);
  }
  return needed;
}

async function loadAuthUsersByEmail(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);
    for (const u of list?.users ?? []) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (!list?.users?.length || list.users.length < perPage) break;
    page += 1;
  }
  return map;
}

async function ensureSeedUser(
  profile: SeedProfile,
  existingUsersByEmail: Map<string, string>
): Promise<string> {
  const email = `${profile.username}@${SEED_EMAIL_DOMAIN}`;
  const cached = existingUsersByEmail.get(email.toLowerCase());
  if (cached) return cached;

  const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: profile.displayName, seed: true },
  });

  let userId: string;
  if (authUser?.user?.id) {
    userId = authUser.user.id;
  } else if (
    createError?.message?.includes('already been registered') ||
    (createError?.message?.toLowerCase().includes('already exists') ?? false)
  ) {
    const refreshed = await loadAuthUsersByEmail();
    for (const [k, v] of refreshed.entries()) existingUsersByEmail.set(k, v);
    const existingId = existingUsersByEmail.get(email.toLowerCase());
    if (!existingId) {
      throw new Error(`Seed user ${profile.username} exists but could not be found: ${createError?.message ?? 'unknown'}`);
    }
    userId = existingId;
  } else {
    throw new Error(`Failed to create seed user ${profile.username}: ${createError?.message ?? 'unknown'}`);
  }

  existingUsersByEmail.set(email.toLowerCase(), userId);

  const { error: profileError } = await supabase.from('profiles').upsert(
    { id: userId, username: profile.username },
    { onConflict: 'id' }
  );
  if (profileError) {
    console.warn('Profile upsert warning:', profileError.message);
  }

  const { error: regError } = await supabase.from('registeredaccounts').upsert(
    {
      user_id: userId,
      username: profile.username,
      email,
      full_name: profile.displayName,
      business: false,
      organization: false,
    },
    { onConflict: 'user_id' }
  );
  if (regError) {
    console.warn('Registeredaccounts upsert warning (optional):', regError.message);
  }

  return userId;
}

async function resolveProfileIds(
  seedProfiles: SeedProfile[],
  neededIndices: Set<number>,
  createAllProfiles: boolean
): Promise<string[]> {
  const profileIds: string[] = new Array(seedProfiles.length);
  const { data: rows, error: loadError } = await supabase
    .from('profiles')
    .select('id, username')
    .like('username', 'seed_%');
  if (loadError) {
    throw new Error(`Failed to load seed profiles: ${loadError.message}`);
  }

  for (const row of rows ?? []) {
    const match = row.username?.match(/^seed_(\d+)$/);
    if (!match) continue;
    const idx = Number(match[1]) - 1;
    if (idx >= 0 && idx < seedProfiles.length) profileIds[idx] = row.id;
  }

  const indicesToEnsure = createAllProfiles
    ? seedProfiles.map((_, i) => i)
    : [...neededIndices];

  for (const idx of indicesToEnsure) {
    if (idx < 0 || idx >= seedProfiles.length) {
      throw new Error(
        `Invalid authorIndex ${idx}. Profiles support indices 0–${seedProfiles.length - 1}. Run Seed from files if seed_101+ are missing.`
      );
    }
    if (profileIds[idx]) continue;
  }

  const missing = indicesToEnsure.filter((idx) => !profileIds[idx]);
  if (missing.length === 0) return profileIds;

  const existingUsersByEmail = await loadAuthUsersByEmail();
  for (const idx of missing) {
    profileIds[idx] = await ensureSeedUser(seedProfiles[idx], existingUsersByEmail);
  }

  return profileIds;
}

function resolveAuthorId(profileIds: string[], authorIndex: number): string {
  if (authorIndex < 0 || authorIndex >= profileIds.length || !profileIds[authorIndex]) {
    throw new Error(
      `Missing seed profile for authorIndex ${authorIndex}. Run Admin → Seed Community → Seed from files first to create seed_101–seed_200.`
    );
  }
  return profileIds[authorIndex];
}

function definedProfileIds(profileIds: string[]): string[] {
  return profileIds.filter((id): id is string => Boolean(id));
}

function validateSeedPosts(posts: SeedPost[]): string | null {
  for (let pi = 0; pi < posts.length; pi++) {
    const post = posts[pi];
    const allowed = (langIndicesByLanguage as Record<string, number[]>)[post.language];
    if (!allowed?.length) {
      return `Post #${pi + 1}: unknown language "${post.language}"`;
    }
    if (!allowed.includes(post.authorIndex)) {
      return `Post #${pi + 1} (${post.language}): authorIndex ${post.authorIndex} does not match a ${post.language} profile. See seed_author_indices_by_language.json.`;
    }
    for (let ci = 0; ci < (post.comments ?? []).length; ci++) {
      const comment = post.comments[ci];
      if (!allowed.includes(comment.authorIndex)) {
        return `Post #${pi + 1} (${post.language}), comment #${ci + 1}: authorIndex ${comment.authorIndex} is not a ${post.language} profile.`;
      }
      if (comment.authorIndex === post.authorIndex) {
        return `Post #${pi + 1} (${post.language}), comment #${ci + 1}: commenter cannot be the same as the post author (authorIndex ${post.authorIndex}).`;
      }
    }
  }
  return null;
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

    const validationError = validateSeedPosts(seedPosts);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // 1) Ensure seed Auth users + profiles exist
    const postsOnlyMode = pastedPosts !== null;
    const neededIndices = collectAuthorIndices(seedPosts);
    let profileIds: string[];
    try {
      profileIds = await resolveProfileIds(seedProfiles, neededIndices, !postsOnlyMode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve seed profiles';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const likeProfileIds = definedProfileIds(profileIds);

    // 2) Build set of existing (user_id, title, body) to avoid duplicates
    const { data: existingPosts } = await supabase
      .from('community_posts')
      .select('user_id, title, body')
      .in('user_id', likeProfileIds.length ? likeProfileIds : ['00000000-0000-0000-0000-000000000000']);
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
      let authorId: string;
      let authorProfile: SeedProfile;
      try {
        authorId = resolveAuthorId(profileIds, p.authorIndex);
        authorProfile = seedProfiles[p.authorIndex];
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid authorIndex';
        return NextResponse.json({ error: message, details: `Post #${i + 1} (${p.language})` }, { status: 400 });
      }
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
        let authorId: string;
        let authorProfile: SeedProfile;
        try {
          authorId = resolveAuthorId(profileIds, c.authorIndex);
          authorProfile = seedProfiles[c.authorIndex];
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Invalid authorIndex';
          return NextResponse.json(
            { error: message, details: `Comment on post #${postIdx + 1} (${post.language})` },
            { status: 400 }
          );
        }
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
      const likeCount = Math.min(seedPosts[postIdx].likeCount ?? 0, likeProfileIds.length);
      const used = new Set<number>();
      for (let L = 0; L < likeCount; L++) {
        let idx = Math.floor(Math.random() * profileIds.length);
        for (let t = 0; t < profileIds.length && (used.has(idx) || !profileIds[idx]); t++) {
          idx = (idx + 1) % profileIds.length;
        }
        if (used.has(idx) || !profileIds[idx]) continue;
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
      const numLikes = Math.min(3, likeProfileIds.length);
      const used = new Set<number>();
      for (let L = 0; L < numLikes; L++) {
        let idx = Math.floor(Math.random() * profileIds.length);
        for (let t = 0; t < profileIds.length && (used.has(idx) || !profileIds[idx]); t++) {
          idx = (idx + 1) % profileIds.length;
        }
        if (used.has(idx) || !profileIds[idx]) continue;
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
      profiles: definedProfileIds(profileIds).length,
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
