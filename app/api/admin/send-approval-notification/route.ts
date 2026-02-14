import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  sendApprovalNotification,
  type ApprovalType,
} from '@/lib/sendApprovalNotification';

const allowedRoles = ['owner', 'ceo', 'topmanager', 'manager', 'reviewer', 'business'];

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const role = cookieStore.get('adminRole')?.value;
  return !!role && allowedRoles.includes(role);
}

/**
 * POST: send a pre-written approval notification to the business/owner
 * who was waiting for approval. Called after admin approves a business,
 * promotion, or area blast.
 * Body: { type: 'business' | 'promotion' | 'area_blast', id: string, sentCount?: number }
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.type !== 'string' || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: 'Body must include type and id (string)' },
        { status: 400 }
      );
    }

    const type = body.type as ApprovalType;
    if (!['business', 'promotion', 'area_blast'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be business, promotion, or area_blast' },
        { status: 400 }
      );
    }

    const id = String(body.id).trim();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const sentCount = typeof body.sentCount === 'number' ? body.sentCount : undefined;
    const result = await sendApprovalNotification(type, id, { sentCount });

    if (!result.sent && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Recipient or entity not found' ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, sent: result.sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
