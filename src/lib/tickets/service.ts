import { getDb } from '@/lib/db/database';
import type { Ticket, TicketMessage, TicketStatus, CreateTicketRequest } from '@/types/content';

function generateId(): string {
  return `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateFolio(): string {
  const date = new Date();
  const yy = date.getFullYear().toString().slice(2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `CNCI-${yy}${mm}-${seq}`;
}

function rowToTicket(row: any): Ticket {
  return {
    id: row.id,
    folio: row.folio,
    studentName: row.student_name,
    studentId: row.student_id,
    studentEmail: row.student_email,
    category: row.category,
    subcategory: row.subcategory || undefined,
    priority: row.priority,
    subject: row.subject,
    description: row.description,
    channel: row.channel,
    status: row.status,
    assignee: row.assignee || undefined,
    department: row.department || undefined,
    relatedArticles: row.related_articles ? JSON.parse(row.related_articles) : undefined,
    chatContext: row.chat_context || undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    nexusCaseId: row.nexus_case_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || undefined,
    messages: [],
  };
}

// ── Create ──────────────────────────────────────────────────────────

export function createTicket(req: CreateTicketRequest): Ticket {
  const db = getDb();
  const id = generateId();
  const folio = generateFolio();

  db.prepare(`
    INSERT INTO tickets (id, folio, student_name, student_id, student_email, category, subcategory, priority, subject, description, channel, related_articles, chat_context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, folio, req.studentName, req.studentId, req.studentEmail,
    req.category, req.subcategory || null, req.priority || 'medium',
    req.subject, req.description, req.channel,
    req.relatedArticles ? JSON.stringify(req.relatedArticles) : null,
    req.chatContext || null,
  );

  return getTicketById(id)!;
}

// ── Read ────────────────────────────────────────────────────────────

export function getTicketById(id: string): Ticket | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as any;
  if (!row) return null;

  const ticket = rowToTicket(row);
  ticket.messages = getTicketMessages(id);
  return ticket;
}

export function getTicketByFolio(folio: string): Ticket | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tickets WHERE folio = ?').get(folio) as any;
  if (!row) return null;

  const ticket = rowToTicket(row);
  ticket.messages = getTicketMessages(ticket.id);
  return ticket;
}

export function getTicketsByStudent(studentId: string): Ticket[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM tickets WHERE student_id = ? ORDER BY created_at DESC'
  ).all(studentId) as any[];

  return rows.map(rowToTicket);
}

export function getTickets(filters?: {
  status?: TicketStatus;
  category?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): { tickets: Ticket[]; total: number } {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (filters?.status) { where.push('status = ?'); params.push(filters.status); }
  if (filters?.category) { where.push('category = ?'); params.push(filters.category); }
  if (filters?.priority) { where.push('priority = ?'); params.push(filters.priority); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const total = (db.prepare(`SELECT COUNT(*) as count FROM tickets ${whereClause}`).get(...params) as any).count;

  const rows = db.prepare(
    `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as any[];

  return { tickets: rows.map(rowToTicket), total };
}

// ── Update ──────────────────────────────────────────────────────────

export function updateTicketStatus(id: string, status: TicketStatus): Ticket | null {
  const db = getDb();
  const resolvedAt = (status === 'resolved' || status === 'closed')
    ? new Date().toISOString()
    : null;

  db.prepare(`
    UPDATE tickets SET status = ?, updated_at = datetime('now'), resolved_at = COALESCE(?, resolved_at)
    WHERE id = ?
  `).run(status, resolvedAt, id);

  return getTicketById(id);
}

export function assignTicket(id: string, assignee: string): Ticket | null {
  const db = getDb();
  db.prepare(`
    UPDATE tickets SET assignee = ?, status = CASE WHEN status = 'open' THEN 'in_review' ELSE status END, updated_at = datetime('now')
    WHERE id = ?
  `).run(assignee, id);

  return getTicketById(id);
}

// ── Messages ────────────────────────────────────────────────────────

export function getTicketMessages(ticketId: string): TicketMessage[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC'
  ).all(ticketId) as any[];

  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticket_id,
    author: r.author,
    authorType: r.author_type,
    content: r.content,
    createdAt: r.created_at,
    attachments: r.attachments ? JSON.parse(r.attachments) : undefined,
  }));
}

export function addTicketMessage(ticketId: string, author: string, authorType: 'student' | 'staff' | 'system', content: string): TicketMessage {
  const db = getDb();
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  db.prepare(`
    INSERT INTO ticket_messages (id, ticket_id, author, author_type, content) VALUES (?, ?, ?, ?, ?)
  `).run(id, ticketId, author, authorType, content);

  // Update ticket timestamp and status
  const statusUpdate = authorType === 'staff' ? ", status = 'waiting_student'" : '';
  db.prepare(`UPDATE tickets SET updated_at = datetime('now')${statusUpdate} WHERE id = ?`).run(ticketId);

  return { id, ticketId, author, authorType, content, createdAt: new Date().toISOString() };
}

// ── Stats ───────────────────────────────────────────────────────────

export function getTicketStats(): Record<TicketStatus, number> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT status, COUNT(*) as count FROM tickets GROUP BY status'
  ).all() as any[];

  const stats: Record<string, number> = { open: 0, in_review: 0, waiting_student: 0, resolved: 0, closed: 0 };
  for (const r of rows) stats[r.status] = r.count;
  return stats as Record<TicketStatus, number>;
}
