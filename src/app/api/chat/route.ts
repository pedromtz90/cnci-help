import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processChat } from '@/lib/chat/engine';
import { loadPublishedContent } from '@/lib/knowledge/loader';
import { initSearchIndex } from '@/lib/knowledge/search';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  mode: z.enum(['help', 'enrollment', 'support']).default('help'),
  locale: z.string().default('es'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(20).optional(),
});

// Rate limiting (simple in-memory)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // per minute
const RATE_WINDOW = 60_000;

let indexed = false;

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const bucket = rateLimits.get(ip);

  if (bucket && now < bucket.resetAt) {
    if (bucket.count >= RATE_LIMIT) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.' },
        { status: 429 },
      );
    }
    bucket.count++;
  } else {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
  }

  // Parse and validate request
  let body: z.infer<typeof ChatRequestSchema>;
  try {
    const raw = await req.json();
    body = ChatRequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  // Ensure search index is loaded
  if (!indexed) {
    const content = await loadPublishedContent();
    initSearchIndex(content);
    indexed = true;
  }

  // Process chat
  const response = await processChat(body);

  return NextResponse.json(response);
}
