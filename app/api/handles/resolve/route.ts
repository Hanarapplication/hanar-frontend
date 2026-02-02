import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');

    if (!handle) {
      return NextResponse.json({ error: 'Missing handle' }, { status: 400 });
    }

    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('username')
      .eq('username', handle)
      .single();

    if (orgData?.username) {
      return NextResponse.json({ type: 'organization', handle });
    }

    const { data: bizData } = await supabaseAdmin
      .from('businesses')
      .select('slug')
      .eq('slug', handle)
      .single();

    if (bizData?.slug) {
      return NextResponse.json({ type: 'business', handle });
    }

    return NextResponse.json({ type: 'user', handle });
  } catch (err) {
    console.error('[API Error]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
