import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { trackEvent, getSummary, getRecentEvents } from '@/lib/analytics/service';
import { getDb } from '@/lib/db/database';
import { requireStaff, AuthError } from '@/lib/auth/session';

const TrackSchema = z.object({
  type: z.enum(['search', 'chat', 'article_view', 'faq_expand', 'ticket_create', 'escalation']),
  query: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  slug: z.string().max(100).optional(),
  confidence: z.string().max(20).optional(),
  source: z.string().max(50).optional(),
  resolved: z.boolean().optional(),
  sessionId: z.string().max(100).optional(),
});

// POST is public — chatbot and frontend track events
export async function POST(req: NextRequest) {
  let body: z.infer<typeof TrackSchema>;
  try {
    body = TrackSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
  }
  getDb();
  trackEvent(body);
  return NextResponse.json({ ok: true });
}

// GET requires staff — dashboard data
export async function GET(req: NextRequest) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  getDb();
  const view = req.nextUrl.searchParams.get('view') || 'summary';
  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') || '30'), 365);

  if (view === 'summary') return NextResponse.json(getSummary(days));
  if (view === 'events') {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 500);
    const offset = Math.max(parseInt(req.nextUrl.searchParams.get('offset') || '0'), 0);
    return NextResponse.json(getRecentEvents(limit, offset));
  }
  return NextResponse.json({ error: 'Invalid view.' }, { status: 400 });
}
