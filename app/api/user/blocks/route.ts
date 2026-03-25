import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserId } from '@/lib/authApi';
import { getMutuallyBlockedUserIds } from '@/lib/userBlocksServer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Enriched = {
  username: string | null;
  displayName: string | null;
  isOrganization: boolean;
  avatarUrl: string | null;
};

async function enrichUsers(userIds: string[]): Promise<Map<string, Enriched>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const map = new Map<string, Enriched>();
  if (ids.length === 0) return map;

  const [{ data: orgs }, { data: profiles }, { data: regs }] = await Promise.all([
    supabaseAdmin.from('organizations').select('user_id, username, full_name, logo_url').in('user_id', ids),
    supabaseAdmin.from('profiles').select('id, username, profile_pic_url').in('id', ids),
    supabaseAdmin.from('registeredaccounts').select('user_id, username, full_name').in('user_id', ids),
  ]);

  const orgByUser = new Map((orgs || []).map((o: { user_id: string; username: string | null; full_name: string | null; logo_url: string | null }) => [o.user_id, o]));

  for (const id of ids) {
    const org = orgByUser.get(id);
    if (org) {
      map.set(id, {
        username: org.username ?? null,
        displayName: org.full_name?.trim() || null,
        isOrganization: true,
        avatarUrl: org.logo_url ?? null,
      });
    }
  }

  const profileById = new Map(
    (profiles || []).map((p: { id: string; username: string | null; profile_pic_url: string | null }) => [p.id, p])
  );
  const regByUser = new Map(
    (regs || []).map((r: { user_id: string; username: string | null; full_name: string | null }) => [r.user_id, r])
  );

  for (const id of ids) {
    if (map.has(id)) continue;
    const prof = profileById.get(id);
    const reg = regByUser.get(id);
    map.set(id, {
      username: prof?.username ?? reg?.username ?? null,
      displayName: reg?.full_name?.trim() || null,
      isOrganization: false,
      avatarUrl: prof?.profile_pic_url ?? null,
    });
  }

  return map;
}

export async function GET(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('user_blocks')
      .select('blocker_id, blocked_id, created_at')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (error) {
      console.error('[user_blocks GET]', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const outgoingIds: string[] = [];
    const incomingIds: string[] = [];
    for (const r of rows || []) {
      const row = r as { blocker_id: string; blocked_id: string };
      if (row.blocker_id === userId) outgoingIds.push(row.blocked_id);
      else incomingIds.push(row.blocker_id);
    }

    const mutual = await getMutuallyBlockedUserIds(supabaseAdmin, userId);
    const mutualBlockedUserIds = [...mutual];

    const allForEnrich = [...new Set([...outgoingIds, ...incomingIds])];
    const enriched = await enrichUsers(allForEnrich);

    const outgoing = outgoingIds.map((id) => {
      const e = enriched.get(id) || {
        username: null,
        displayName: null,
        isOrganization: false,
        avatarUrl: null,
      };
      return { userId: id, ...e, direction: 'outgoing' as const };
    });

    const incoming = incomingIds.map((id) => {
      const e = enriched.get(id) || {
        username: null,
        displayName: null,
        isOrganization: false,
        avatarUrl: null,
      };
      return { userId: id, ...e, direction: 'incoming' as const };
    });

    return NextResponse.json({
      mutualBlockedUserIds,
      outgoing,
      incoming,
    });
  } catch (err) {
    console.error('[user_blocks GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const blockedUserId = typeof body.blockedUserId === 'string' ? body.blockedUserId.trim() : '';
    if (!blockedUserId || blockedUserId === userId) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('user_blocks').insert({
      blocker_id: userId,
      blocked_id: blockedUserId,
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already blocked' }, { status: 409 });
      }
      console.error('[user_blocks POST]', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[user_blocks POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const blockedUserId = searchParams.get('blockedUserId')?.trim();
    if (!blockedUserId) {
      return NextResponse.json({ error: 'Missing blockedUserId' }, { status: 400 });
    }

    const { data: deletedRows, error } = await supabaseAdmin
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', blockedUserId)
      .select('id');

    if (error) {
      console.error('[user_blocks DELETE]', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!deletedRows?.length) {
      return NextResponse.json({ error: 'Block not found or you cannot remove this block' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[user_blocks DELETE]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
