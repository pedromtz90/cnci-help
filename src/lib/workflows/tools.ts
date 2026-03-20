/**
 * Workflow Tools — Actions that Mastra workflows can invoke.
 * Each tool is a pure function: typed input → typed output.
 * Tools are auditable, testable, and reusable.
 */

import { createTicket as dbCreateTicket } from '@/lib/tickets/service';
import { trackEvent } from '@/lib/analytics/service';
import { syncTicketToNexus } from '@/lib/nexus/sync';
import { getDb } from '@/lib/db/database';
import type { CreateTicketRequest, Ticket } from '@/types/content';

// ── Tool: Create Ticket ─────────────────────────────────────────────

export interface CreateTicketInput {
  studentName: string;
  studentId: string;
  studentEmail: string;
  category: string;
  subject: string;
  description: string;
  channel: 'chat' | 'help' | 'manual' | 'email';
  chatContext?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export async function toolCreateTicket(input: CreateTicketInput): Promise<{ ticket: Ticket; synced: boolean }> {
  getDb();
  const ticket = dbCreateTicket(input as CreateTicketRequest);

  trackEvent({
    type: 'ticket_create',
    category: input.category,
    query: input.subject,
    source: input.channel,
  });

  const syncResult = await syncTicketToNexus(ticket);
  if (syncResult.nexusCaseId) {
    const db = getDb();
    db.prepare('UPDATE tickets SET nexus_case_id = ? WHERE id = ?').run(syncResult.nexusCaseId, ticket.id);
  }

  return { ticket, synced: syncResult.success };
}

// ── Tool: Send Support Email ────────────────────────────────────────

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export async function toolSendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  try {
    const nodemailer = await import('nodemailer');

    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      console.log('[workflow:email] SMTP not configured, logging instead:', input.to, input.subject);
      return { sent: false, error: 'SMTP not configured' };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'soporte@cncivirtual.mx',
      to: input.to,
      subject: input.subject,
      html: input.body,
      replyTo: input.replyTo,
    });

    return { sent: true };
  } catch (error: any) {
    console.error('[workflow:email] Failed:', error.message);
    return { sent: false, error: error.message };
  }
}

// ── Tool: Escalate to Human ─────────────────────────────────────────

export interface EscalateInput {
  ticketId?: string;
  studentName: string;
  studentEmail: string;
  reason: string;
  department: string;
  context: string;
}

export async function toolEscalateToHuman(input: EscalateInput): Promise<{ escalated: boolean }> {
  // Notify staff via email
  const departmentEmails: Record<string, string> = {
    'Soporte Técnico': 'soporte@cncivirtual.mx',
    'Cobranza': 'cobranza@cncivirtual.mx',
    'Servicios Estudiantiles': 'servicios@cncivirtual.mx',
    'Titulación': 'titulacion@cncivirtual.mx',
  };

  const staffEmail = departmentEmails[input.department] || 'servicios@cncivirtual.mx';

  await toolSendEmail({
    to: staffEmail,
    subject: `[Escalación] ${input.reason} — ${input.studentName}`,
    body: `
      <h3>Escalación de Centro de Ayuda CNCI</h3>
      <p><strong>Alumno:</strong> ${input.studentName} (${input.studentEmail})</p>
      <p><strong>Motivo:</strong> ${input.reason}</p>
      <p><strong>Departamento:</strong> ${input.department}</p>
      <p><strong>Contexto:</strong></p>
      <pre>${input.context}</pre>
      ${input.ticketId ? `<p><a href="${process.env.NEXTAUTH_URL || 'https://ayuda.cncivirtual.mx'}/api/tickets/${input.ticketId}">Ver ticket</a></p>` : ''}
    `,
    replyTo: input.studentEmail,
  });

  trackEvent({
    type: 'escalation',
    category: input.department,
    query: input.reason,
  });

  return { escalated: true };
}

// ── Tool: Create Lead (enrollment intent) ───────────────────────────

export interface CreateLeadInput {
  name: string;
  email: string;
  phone?: string;
  program?: string;
  source: string;
  notes?: string;
}

export async function toolCreateLead(input: CreateLeadInput): Promise<{ leadId?: string; synced: boolean }> {
  // Sync to Nexus as a lead/contact
  const nexusUrl = process.env.NEXUS_API_URL;
  const nexusKey = process.env.NEXUS_API_KEY;

  if (!nexusUrl || !nexusKey) {
    console.log('[workflow:lead] Nexus not configured, logging lead:', input.name, input.email);
    trackEvent({ type: 'chat', query: `Lead: ${input.name}`, category: 'inscripcion', source: 'workflow' });
    return { synced: false };
  }

  try {
    const res = await fetch(`${nexusUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nexusKey}`,
      },
      body: JSON.stringify({
        firstName: input.name.split(' ')[0],
        lastName: input.name.split(' ').slice(1).join(' ') || '',
        email: input.email,
        phone: input.phone,
        source: 'cnci-help-chatbot',
        tags: ['cnci-lead', 'enrollment-intent'],
        notes: `Intención de inscripción detectada desde Centro de Ayuda.\n${input.notes || ''}`,
      }),
    });

    const data = await res.json();
    trackEvent({ type: 'chat', query: `Lead created: ${input.name}`, category: 'inscripcion', source: 'workflow' });
    return { leadId: data.data?.id, synced: true };
  } catch (error: any) {
    console.error('[workflow:lead] Failed:', error.message);
    return { synced: false };
  }
}

// ── Tool: Log Conversation Event ────────────────────────────────────

export interface LogEventInput {
  type: 'search' | 'chat' | 'article_view' | 'faq_expand' | 'ticket_create' | 'escalation';
  query?: string;
  category?: string;
  confidence?: string;
  source?: string;
  resolved?: boolean;
}

export function toolLogEvent(input: LogEventInput): void {
  trackEvent(input);
}
