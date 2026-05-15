import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function collectDescendantIds(rows: { id: string; parent_id: string | null }[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let growing = true;
  while (growing) {
    growing = false;
    for (const row of rows) {
      const p = row.parent_id;
      if (p && ids.has(p) && !ids.has(row.id)) {
        ids.add(row.id);
        growing = true;
      }
    }
  }
  return ids;
}

export async function POST(req: Request) {
  try {
    const { comment_id, user_id } = await req.json();
    if (!comment_id || !user_id) {
      return NextResponse.json({ error: 'Missing comment_id or user_id' }, { status: 400 });
    }

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('community_comments')
      .select('id, user_id, post_id, deleted')
      .eq('id', comment_id)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (row.deleted) {
      return NextResponse.json({ success: true, removed: 0, post_id: row.post_id });
    }

    if (row.user_id !== user_id) {
      return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
    }

    const postId = row.post_id as string;

    const { data: allComments, error: allErr } = await supabaseAdmin
      .from('community_comments')
      .select('id, parent_id')
      .eq('post_id', postId);

    if (allErr) throw allErr;

    const rows = (allComments || []).map((r: { id: string; parent_id: string | null }) => ({
      id: r.id,
      parent_id: r.parent_id,
    }));

    const ids = collectDescendantIds(rows, comment_id);

    const { error: updateErr } = await supabaseAdmin.from('community_comments').update({ deleted: true }).in('id', [...ids]);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, removed: ids.size, post_id: postId });
  } catch (err) {
    console.error('[community/comment/delete]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
