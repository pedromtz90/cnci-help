import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTicketById, updateTicketStatus, assignTicket, addTicketMessage } from '@/lib/tickets/service';
import { updateNexusCase } from '@/lib/nexus/sync';
import { getDb } from '@/lib/db/database';

interface RouteParams {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  getDb();
  const ticket = getTicketById(params.id);
  if (!ticket) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ ticket });
}

const UpdateSchema = z.object({
  action: z.enum(['status', 'assign', 'message']),
  status: z.enum(['open', 'in_review', 'waiting_student', 'resolved', 'closed']).optional(),
  assignee: z.string().optional(),
  message: z.string().max(5000).optional(),
  author: z.string().optional(),
  authorType: z.enum(['student', 'staff', 'system']).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  getDb();

  let body: z.infer<typeof UpdateSchema>;
  try {
    body = UpdateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const existing = getTicketById(params.id);
  if (!existing) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  let ticket = existing;

  switch (body.action) {
    case 'status':
      if (!body.status) return NextResponse.json({ error: 'Status requerido.' }, { status: 400 });
      ticket = updateTicketStatus(params.id, body.status) || existing;
      // Sync status to Nexus
      if (existing.nexusCaseId) {
        updateNexusCase(existing.nexusCaseId, body.status);
      }
      break;

    case 'assign':
      if (!body.assignee) return NextResponse.json({ error: 'Assignee requerido.' }, { status: 400 });
      ticket = assignTicket(params.id, body.assignee) || existing;
      break;

    case 'message':
      if (!body.message || !body.author) return NextResponse.json({ error: 'Message y author requeridos.' }, { status: 400 });
      const msg = addTicketMessage(params.id, body.author, body.authorType || 'student', body.message);
      ticket = getTicketById(params.id) || existing;
      return NextResponse.json({ ticket, newMessage: msg });
  }

  return NextResponse.json({ ticket });
}
