import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/database';

export async function GET() {
  let dbOk = false;
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as c FROM knowledge_items").get() as any;
    dbOk = row?.c >= 0;
  } catch (err) {
    console.error('[health] Database check failed:', err);
  }

  return NextResponse.json({
    status: dbOk ? 'ok' : 'degraded',
    version: '3.0.0',
    db: dbOk,
    timestamp: new Date().toISOString(),
  }, { status: dbOk ? 200 : 503 });
}
