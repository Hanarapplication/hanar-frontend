import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAccount } from '@/lib/admin/verifyAdminAccount';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED = new Set(['pending', 'reviewed', 'closed']);

/** POST: update inbox submission status. Body: { status: 'pending' | 'reviewed' | 'closed' } */
export async function POST(req: Request, context: RouteContext) {
  try {
    const admin = await verifyAdminAccount(req, supabaseAdmin);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const submissionId = (id || '').trim();
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submission id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { status?: string } | null;
    const status = body?.status;
    if (!status || !ALLOWED.has(status)) {
      return NextResponse.json({ error: 'status must be pending, reviewed, or closed' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .update({ status })
      .eq('id', submissionId)
      .select('id, status')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, submission: data });
  } catch (err) {
    console.error('admin business-claims inbox update:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
