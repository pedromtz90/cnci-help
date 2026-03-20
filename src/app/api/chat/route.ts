import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processChat } from '@/lib/chat/engine';
import { loadPublishedContent } from '@/lib/knowledge/loader';
import { initSearchIndex } from '@/lib/knowledge/search';
import { getDb } from '@/lib/db/database';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  mode: z.enum(['help', 'enrollment', 'support']).default('help'),
  locale: z.string().max(5).default('es'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(20).optional(),
});

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

// Index state — refreshes when dynamic content changes
let indexedAt = 0;

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const bucket = rateLimits.get(ip);

  if (bucket && now < bucket.resetAt) {
    if (bucket.count >= RATE_LIMIT) {
      return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
    }
    bucket.count++;
  } else {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
  }

  // Clean old rate limit entries every 100 requests
  if (rateLimits.size > 1000) {
    for (const [key, val] of rateLimits) {
      if (now > val.resetAt) rateLimits.delete(key);
    }
  }

  // Validate
  let body: z.infer<typeof ChatRequestSchema>;
  try {
    body = ChatRequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  // Ensure search index is loaded and fresh (re-index every 5 minutes or on version bump)
  const shouldReindex = !indexedAt || (now - indexedAt > 5 * 60_000);
  if (shouldReindex) {
    try {
      getDb(); // ensure DB exists for dynamic content
      const content = await loadPublishedContent();
      initSearchIndex(content); // This also loads dynamic content from DB
      indexedAt = now;
    } catch (err) {
      console.error('Failed to load search index:', err);
    }
  }

  const response = await processChat(body);
  return NextResponse.json(response);
}
