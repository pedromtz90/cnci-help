import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createTicket, getTickets, getTicketsByStudent, getTicketByFolio } from '@/lib/tickets/service';
import { trackEvent } from '@/lib/analytics/service';
import { syncTicketToNexus } from '@/lib/nexus/sync';
import { getDb } from '@/lib/db/database';

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

  if (folio) {
    const ticket = getTicketByFolio(folio);
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado.' }, { status: 404 });
    return NextResponse.json({ ticket });
  }

  if (studentId) {
    const tickets = getTicketsByStudent(studentId);
    return NextResponse.json({ tickets });
  }

  const result = getTickets({ status, category });
  return NextResponse.json(result);
}
