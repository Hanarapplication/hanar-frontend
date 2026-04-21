import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/authApi';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Soft-delete own community post (author must match session user). */
export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const post_id = typeof body?.post_id === 'string' ? body.post_id.trim() : '';
    if (!post_id) {
      return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
    }

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('community_posts')
      .select('id, user_id')
      .eq('id', post_id)
      .maybeSingle();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const authorId = (post as { user_id?: string }).user_id;
    if (!authorId || authorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('community_posts')
      .update({ deleted: true })
      .eq('id', post_id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[community post delete]', updateError.message);
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[community post delete]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
