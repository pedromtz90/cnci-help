import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTicketById, updateTicketStatus, assignTicket, addTicketMessage } from '@/lib/tickets/service';
import { updateNexusCase } from '@/lib/nexus/sync';
import { getDb } from '@/lib/db/database';
import { requireAuth, requireStaff, getSession, AuthError } from '@/lib/auth/session';

interface RouteParams { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try { await requireAuth(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();
  const ticket = getTicketById(params.id);
  if (!ticket) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ ticket });
}

const UpdateSchema = z.object({
  action: z.enum(['status', 'assign', 'message']),
  status: z.enum(['open', 'in_review', 'waiting_student', 'resolved', 'closed']).optional(),
  assignee: z.string().max(200).optional(),
  message: z.string().min(1).max(5000).optional(),
  author: z.string().max(200).optional(),
  authorType: z.enum(['student', 'staff', 'system']).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 });

  getDb();

  let body: z.infer<typeof UpdateSchema>;
  try { body = UpdateSchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }); }

  const existing = getTicketById(params.id);
  if (!existing) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  let ticket = existing;

  switch (body.action) {
    case 'status':
      // Only staff can change status
      if (session.role !== 'staff' && session.role !== 'director') {
        return NextResponse.json({ error: 'Solo staff puede cambiar el estado.' }, { status: 403 });
      }
      if (!body.status) return NextResponse.json({ error: 'Status requerido.' }, { status: 400 });
      ticket = updateTicketStatus(params.id, body.status) || existing;
      if (existing.nexusCaseId) updateNexusCase(existing.nexusCaseId, body.status);
      break;

    case 'assign':
      if (session.role !== 'staff' && session.role !== 'director') {
        return NextResponse.json({ error: 'Solo staff puede asignar tickets.' }, { status: 403 });
      }
      if (!body.assignee) return NextResponse.json({ error: 'Assignee requerido.' }, { status: 400 });
      ticket = assignTicket(params.id, body.assignee) || existing;
      break;

    case 'message':
      if (!body.message) return NextResponse.json({ error: 'Mensaje requerido.' }, { status: 400 });
      // Enforce real identity — students can only post as student, staff as staff
      const authorType = (session.role === 'staff' || session.role === 'director') ? 'staff' : 'student';
      const author = session.name || session.email;
      const msg = addTicketMessage(params.id, author, authorType, body.message);
      ticket = getTicketById(params.id) || existing;
      return NextResponse.json({ ticket, newMessage: msg });
  }

  return NextResponse.json({ ticket });
}
