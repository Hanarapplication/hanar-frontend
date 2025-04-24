// File: /app/api/log-deleted-reply/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { replyId, deletedBy } = body;

  console.log('🔴 Deleted Reply Log:', {
    replyId,
    deletedBy,
    deletedAt: new Date().toISOString()
  });

  return NextResponse.json({ success: true });
}
