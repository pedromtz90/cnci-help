import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { escalateToNexus } from '@/lib/nexus/sync';
import { trackEvent } from '@/lib/analytics/service';
import { recordGap } from '@/lib/knowledge/gaps';
import { getDb } from '@/lib/db/database';

const EscalateSchema = z.object({
  studentName: z.string().min(2).max(200),
  studentEmail: z.string().email(),
  studentId: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  subject: z.string().min(3).max(300),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(30),
  category: z.string().default('soporte'),
});

// BUG-01 FIX: Add rate limiting to prevent abuse on unauthenticated endpoint
const escalateRateLimits = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  // Rate limit: 5 escalations per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const bucket = escalateRateLimits.get(ip);
  if (bucket && now < bucket.resetAt) {
    if (bucket.count >= 5) {
      return NextResponse.json({ error: 'Demasiadas solicitudes de escalación.' }, { status: 429 });
    }
    bucket.count++;
  } else {
    escalateRateLimits.set(ip, { count: 1, resetAt: now + 60_000 });
  }
  // Periodic cleanup
  if (escalateRateLimits.size > 5000) {
    for (const [key, val] of escalateRateLimits) {
      if (now >= val.resetAt) escalateRateLimits.delete(key);
    }
  }

  let body: z.infer<typeof EscalateSchema>;
  try {
    body = EscalateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  getDb();

  // Track escalation
  trackEvent({
    type: 'escalation',
    query: body.subject,
    category: body.category,
    source: 'chatbot',
  });

  // Record the original question as a gap for training
  const firstUserMsg = body.chatHistory.find((m) => m.role === 'user');
  if (firstUserMsg) {
    recordGap(firstUserMsg.content, 'low', 'escalation');
  }

  // Escalate to Nexus (creates conversation with chat history)
  const result = await escalateToNexus(body);

  if (result.success) {
    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      message: 'Tu conversación fue transferida a un asesor de Servicios Estudiantiles. Te contactarán pronto.',
    });
  }

  // Fallback: if Nexus is not configured, return guidance
  return NextResponse.json({
    success: false,
    message: 'En este momento no podemos transferirte automáticamente. Contacta a Servicios Estudiantiles al 800 681 5314 (opción 4 y 5) o escribe a servicios@cncivirtual.mx',
    fallbackEmail: 'servicios@cncivirtual.mx',
    fallbackPhone: '800 681 5314',
  });
}
