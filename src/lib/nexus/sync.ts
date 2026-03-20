import type { Ticket } from '@/types/content';

/**
 * Nexus Integration — Sync CNCI tickets to Nexus CRM
 *
 * Strategy:
 * 1. When a ticket is created in CNCI, sync it as a Contact + Task/Note in Nexus
 * 2. When a ticket status changes, update the Nexus task
 * 3. The Nexus API is at the production server (configured via env)
 *
 * This is a one-way push: CNCI → Nexus.
 * Staff uses Nexus to see the full picture and respond.
 */

const NEXUS_API_URL = process.env.NEXUS_API_URL || '';
const NEXUS_API_KEY = process.env.NEXUS_API_KEY || '';

interface NexusSyncResult {
  success: boolean;
  nexusCaseId?: string;
  error?: string;
}

/**
 * Sync a new ticket to Nexus as a task/case.
 */
export async function syncTicketToNexus(ticket: Ticket): Promise<NexusSyncResult> {
  if (!NEXUS_API_URL || !NEXUS_API_KEY) {
    console.log('[nexus-sync] Skipped — NEXUS_API_URL not configured');
    return { success: false, error: 'Nexus not configured' };
  }

  try {
    // Step 1: Find or create contact in Nexus
    const contactId = await findOrCreateContact(ticket);

    // Step 2: Create a task/note linked to the contact
    const taskId = await createCase(ticket, contactId);

    console.log(`[nexus-sync] Ticket ${ticket.folio} → Nexus case ${taskId}`);
    return { success: true, nexusCaseId: taskId };
  } catch (error: any) {
    console.error('[nexus-sync] Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update ticket status in Nexus.
 */
export async function updateNexusCase(nexusCaseId: string, status: string): Promise<void> {
  if (!NEXUS_API_URL || !NEXUS_API_KEY) return;

  try {
    await nexusFetch(`/api/v1/tasks/${nexusCaseId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: mapStatusToNexus(status),
        updatedAt: new Date().toISOString(),
      }),
    });
  } catch (error: any) {
    console.error('[nexus-sync] Update failed:', error.message);
  }
}

// ── Internal helpers ────────────────────────────────────────────────

async function findOrCreateContact(ticket: Ticket): Promise<string> {
  // Search by email first
  const searchRes = await nexusFetch(`/api/v1/contacts?email=${encodeURIComponent(ticket.studentEmail)}`);
  const searchData = await searchRes.json();

  if (searchData.data?.length > 0) {
    return searchData.data[0].id;
  }

  // Create new contact
  const createRes = await nexusFetch('/api/v1/contacts', {
    method: 'POST',
    body: JSON.stringify({
      firstName: ticket.studentName.split(' ')[0],
      lastName: ticket.studentName.split(' ').slice(1).join(' ') || '',
      email: ticket.studentEmail,
      source: 'cnci-help',
      tags: ['alumno-cnci', ticket.category],
      customFields: {
        matricula: ticket.studentId,
      },
    }),
  });

  const createData = await createRes.json();
  return createData.data?.id;
}

async function createCase(ticket: Ticket, contactId: string): Promise<string> {
  const res = await nexusFetch('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: `[CNCI ${ticket.folio}] ${ticket.subject}`,
      description: buildCaseDescription(ticket),
      contactId,
      status: 'todo',
      priority: mapPriorityToNexus(ticket.priority),
      tags: ['cnci-ticket', ticket.category, ...(ticket.tags || [])],
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h SLA
      metadata: {
        cnciFolio: ticket.folio,
        cnciTicketId: ticket.id,
        channel: ticket.channel,
        department: ticket.department,
      },
    }),
  });

  const data = await res.json();
  return data.data?.id;
}

function buildCaseDescription(ticket: Ticket): string {
  let desc = `**Alumno:** ${ticket.studentName}\n`;
  desc += `**Matrícula:** ${ticket.studentId}\n`;
  desc += `**Email:** ${ticket.studentEmail}\n`;
  desc += `**Categoría:** ${ticket.category}\n`;
  desc += `**Canal:** ${ticket.channel}\n`;
  desc += `**Prioridad:** ${ticket.priority}\n\n`;
  desc += `**Descripción:**\n${ticket.description}\n`;
  if (ticket.chatContext) {
    desc += `\n**Contexto del chat:**\n${ticket.chatContext}\n`;
  }
  return desc;
}

function mapStatusToNexus(status: string): string {
  const map: Record<string, string> = {
    open: 'todo',
    in_review: 'in_progress',
    waiting_student: 'in_progress',
    resolved: 'done',
    closed: 'done',
  };
  return map[status] || 'todo';
}

function mapPriorityToNexus(priority: string): string {
  const map: Record<string, string> = {
    critical: 'urgent',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };
  return map[priority] || 'medium';
}

async function nexusFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${NEXUS_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NEXUS_API_KEY}`,
      ...(options?.headers || {}),
    },
  });
}
