import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createTicket, getTickets, getTicketsByStudent, getTicketByFolio } from '@/lib/tickets/service';
import { trackEvent } from '@/lib/analytics/service';
import { syncTicketToNexus } from '@/lib/nexus/sync';
import { getDb } from '@/lib/db/database';
import { requireAuth, AuthError } from '@/lib/auth/session';

const ticketRateLimit = new Map<string, number[]>();
const TICKET_LIMIT = 5; // 5 tickets per minute per IP
const TICKET_WINDOW = 60_000;

function checkTicketRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ticketRateLimit.get(ip) || [];
  const recent = timestamps.filter(t => now - t < TICKET_WINDOW);
  if (recent.length >= TICKET_LIMIT) return false;
  recent.push(now);
  ticketRateLimit.set(ip, recent);
  // Cleanup
  if (ticketRateLimit.size > 10000) {
    for (const [key, val] of ticketRateLimit) {
      if (val.every(t => now - t > TICKET_WINDOW)) ticketRateLimit.delete(key);
    }
  }
  return true;
}

const CreateTicketSchema = z.object({
  studentName: z.string().min(2).max(200),
  studentId: z.string().min(1).max(50),
  studentEmail: z.string().email(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  subject: z.string().min(3).max(300),
  description: z.string().min(10).max(5000),
  channel: z.enum(['chat', 'help', 'manual', 'email']).default('manual'),
  chatContext: z.string().max(2000).optional(),
  relatedArticles: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkTicketRateLimit(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }, { status: 429 });
  }

  let body: z.infer<typeof CreateTicketSchema>;
  try {
    body = CreateTicketSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  // Ensure DB is initialized
  getDb();

  const ticket = createTicket(body);

  // Track analytics
  trackEvent({
    type: 'ticket_create',
    category: body.category,
    query: body.subject,
    source: body.channel,
  });

  // Sync to Nexus (non-blocking)
  syncTicketToNexus(ticket).then((result) => {
    if (result.conversationId) {
      const db = getDb();
      db.prepare('UPDATE tickets SET nexus_case_id = ? WHERE id = ?').run(result.conversationId, ticket.id);
    }
  });

  return NextResponse.json({ ticket }, { status: 201 });
}

export async function GET(req: NextRequest) {
  getDb();

  const folio = req.nextUrl.searchParams.get('folio');
  const studentId = req.nextUrl.searchParams.get('studentId');
  const status = req.nextUrl.searchParams.get('status') as any;
  const category = req.nextUrl.searchParams.get('category') || undefined;

  // Folio lookup is public (student needs this to track their ticket)
  if (folio) {
    const ticket = getTicketByFolio(folio);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
    return NextResponse.json({ ticket });
  }

  // All other queries require authentication (protects PII)
  try { await requireAuth(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Inicia sesión para ver tickets.' }, { status: 401 });
  }

  if (studentId) {
    const tickets = getTicketsByStudent(studentId);
    return NextResponse.json({ tickets });
  }

  const result = getTickets({ status, category });
  return NextResponse.json(result);
}
