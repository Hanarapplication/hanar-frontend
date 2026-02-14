import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

export type SearchUser = {
  user_id: string;
  label: string;
  email: string | null;
  phone: string | null;
  type: 'organization' | 'business' | 'individual';
};

export async function GET(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim().replace(/%/g, '');
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }
    const term = `%${q}%`;

    const results: SearchUser[] = [];
    const seenIds = new Set<string>();

    // Organizations: full_name, username, email
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('user_id, full_name, username, email, contact_info')
      .or(`full_name.ilike.${term},username.ilike.${term},email.ilike.${term}`)
      .not('user_id', 'is', null)
      .limit(20);
    for (const o of orgs ?? []) {
      if (o.user_id && !seenIds.has(o.user_id)) {
        seenIds.add(o.user_id);
        const phone = (o.contact_info as { phone?: string } | null)?.phone ?? null;
        results.push({
          user_id: o.user_id,
          label: o.full_name || o.username || o.email || 'Organization',
          email: o.email ?? null,
          phone,
          type: 'organization',
        });
      }
    }

    // Businesses: business_name, email, phone
    const { data: bizList } = await supabaseAdmin
      .from('businesses')
      .select('owner_id, business_name, email, phone')
      .or(`business_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
      .not('owner_id', 'is', null)
      .limit(20);
    for (const b of bizList ?? []) {
      if (b.owner_id && !seenIds.has(b.owner_id)) {
        seenIds.add(b.owner_id);
        results.push({
          user_id: b.owner_id,
          label: b.business_name || b.email || 'Business',
          email: b.email ?? null,
          phone: b.phone ?? null,
          type: 'business',
        });
      }
    }

    // Individuals: registeredaccounts (username, email if present) and profiles (username)
    const { data: raList } = await supabaseAdmin
      .from('registeredaccounts')
      .select('user_id, username')
      .eq('business', false)
      .eq('organization', false)
      .not('user_id', 'is', null)
      .or(`username.ilike.${term}`)
      .limit(30);
    const indUserIds = (raList ?? []).map((r) => r.user_id).filter(Boolean);
    if (indUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .in('id', indUserIds);
      const profileByUserId = new Map((profiles ?? []).map((p) => [p.id, p.username]));
      for (const r of raList ?? []) {
        if (!r.user_id || seenIds.has(r.user_id)) continue;
        const username = r.username || (profileByUserId.get(r.user_id) ?? null);
        if (!username?.toLowerCase().includes(q.toLowerCase())) continue;
        seenIds.add(r.user_id);
        results.push({
          user_id: r.user_id,
          label: username || 'User',
          email: null,
          phone: null,
          type: 'individual',
        });
      }
    }

    // If we have email in registeredaccounts, also search by it (optional - some schemas have it)
    try {
      const { data: raByEmail } = await supabaseAdmin
        .from('registeredaccounts')
        .select('user_id, username')
        .eq('business', false)
        .eq('organization', false)
        .not('user_id', 'is', null)
        .ilike('email', term)
        .limit(20);
      for (const r of raByEmail ?? []) {
        if (r.user_id && !seenIds.has(r.user_id)) {
          seenIds.add(r.user_id);
          results.push({
            user_id: r.user_id,
            label: (r as { username?: string }).username || 'User',
            email: q,
            phone: null,
            type: 'individual',
          });
        }
      }
    } catch {
      // email column may not exist on registeredaccounts
    }

    return NextResponse.json({ users: results.slice(0, 50) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
