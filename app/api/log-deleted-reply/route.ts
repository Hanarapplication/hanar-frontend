// File: /app/api/log-deleted-reply/route.ts
// Logs deleted replies to a local file (simulated backend logging)

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  const body = await req.json();
  const { replyId, deletedBy } = body;

  const logPath = path.join(process.cwd(), 'logs', 'deleted-replies.json');
  const logEntry = {
    replyId,
    deletedBy,
    deletedAt: new Date().toISOString()
  };

  try {
    // Ensure logs folder exists
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logs = fs.existsSync(logPath)
      ? JSON.parse(fs.readFileSync(logPath, 'utf-8'))
      : [];

    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log deletion' }, { status: 500 });
  }
}
