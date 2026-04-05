import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processChat } from '@/lib/chat/engine';
import { loadPublishedContent } from '@/lib/knowledge/loader';
import { initSearchIndex } from '@/lib/knowledge/search';
import { getDb } from '@/lib/db/database';

const OPENCLAW_API = process.env.OPENCLAW_API_URL || 'https://ana.phs.mx';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  mode: z.enum(['help', 'enrollment', 'support']).default('help'),
  locale: z.string().max(5).default('es'),
  stream: z.boolean().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(20).optional(),
});

const rateLimits = new Map<string, { count: number; resetAt: number }>();
let indexedAt = 0;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const bucket = rateLimits.get(ip);

  if (bucket && now < bucket.resetAt) {
    if (bucket.count >= 30) return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
    bucket.count++;
  } else {
    rateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  let body: z.infer<typeof ChatRequestSchema>;
  try {
    body = ChatRequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  // ── Streaming mode: proxy SSE from OpenClaw ──
  if (body.stream) {
    try {
      const openclawRes = await fetch(`${OPENCLAW_API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: body.message,
          history: body.history,
          agent: 'main',
          stream: true,
        }),
        signal: AbortSignal.timeout(18000),
      });

      if (!openclawRes.ok || !openclawRes.body) throw new Error('OpenClaw stream failed');

      return new Response(openclawRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch {
      // Fallback to non-streaming
    }
  }

  // ── Non-streaming: proxy to OpenClaw with local fallback ──
  try {
    const openclawRes = await fetch(`${OPENCLAW_API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body.message, history: body.history, agent: 'main' }),
      signal: AbortSignal.timeout(18000),
    });

    if (openclawRes.ok) {
      const data = await openclawRes.json();
      return NextResponse.json(data);
    }
  } catch {
    console.error('[chat] OpenClaw unavailable, falling back to local');
  }

  // ── Local fallback ──
  const shouldReindex = !indexedAt || (now - indexedAt > 5 * 60_000);
  if (shouldReindex) {
    try {
      getDb();
      const content = await loadPublishedContent();
      initSearchIndex(content);
      indexedAt = now;
    } catch {}
  }

  const response = await processChat(body);
  return NextResponse.json(response);
}
