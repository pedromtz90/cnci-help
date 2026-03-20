import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { trackEvent, getSummary, getRecentEvents } from '@/lib/analytics/service';
import { getDb } from '@/lib/db/database';

const TrackSchema = z.object({
  type: z.enum(['search', 'chat', 'article_view', 'faq_expand', 'ticket_create', 'escalation']),
  query: z.string().max(500).optional(),
  category: z.string().optional(),
  slug: z.string().optional(),
  confidence: z.string().optional(),
  source: z.string().optional(),
  resolved: z.boolean().optional(),
  sessionId: z.string().optional(),
});

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

export async function GET(req: NextRequest) {
  getDb();

  const view = req.nextUrl.searchParams.get('view') || 'summary';
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  if (view === 'summary') {
    return NextResponse.json(getSummary(days));
  }

  if (view === 'events') {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    return NextResponse.json({ events: getRecentEvents(limit) });
  }

  return NextResponse.json({ error: 'Invalid view.' }, { status: 400 });
}
