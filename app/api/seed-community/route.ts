import { NextResponse } from 'next/server';

/**
 * Legacy seed endpoint. Use POST /api/seed-community-full instead.
 * That route uses public/data/community_seed.json and community_seed_immigrant_posts.json
 * to create profiles, posts, comments, and likes (with duplicate detection).
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Use POST /api/seed-community-full instead. This endpoint is deprecated.',
      redirect: '/api/seed-community-full',
    },
    { status: 410 }
  );
}
