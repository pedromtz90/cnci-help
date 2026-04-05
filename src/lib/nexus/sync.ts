/**
 * Nexus Integration — Escalate chatbot conversations to human advisors.
 *
 * Flow:
 * 1. Student asks chatbot → chatbot can't resolve
 * 2. Student clicks "Transferir a asesor" or "Crear ticket"
 * 3. CNCI creates contact + conversation in Nexus with full chat history
 * 4. Advisor sees it in Nexus inbox → can respond via WhatsApp, email, or web
 *
 * Nexus API:
 * - POST /conversations — create conversation with contact
 * - POST /conversations/:id/messages — add messages (chat history)
 * - Conversation has handlingMode: 'HUMAN_REQUIRED' for immediate human attention
 */
import type { Ticket } from '@/types/content';
import { getConfig } from '@/lib/settings/service';

interface NexusSyncResult {
  success: boolean;
  conversationId?: string;
  contactId?: string;
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Create a Nexus conversation from a chatbot escalation.
 * Sends the full chat history so the advisor has context.
 */
export async function escalateToNexus(params: {
  studentName: string;
  studentEmail: string;
  studentId?: string;
  phone?: string;
  subject: string;
  chatHistory: ChatMessage[];
  category: string;
  channel?: string;
}): Promise<NexusSyncResult> {
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  const nexusPass = getConfig('nexus_password') || process.env.NEXUS_PASSWORD;

  if (!nexusUrl || !nexusPass) {
    console.log('[nexus] Not configured — skipping escalation');
    return { success: false, error: 'Nexus not configured' };
  }

  try {
    // Step 1: Find or create contact
    const contactId = await findOrCreateContact(nexusUrl, "", params);

    // Step 2: Generate AI summary for the advisor
    const summary = generateSummary(params);

    // Step 3: Create conversation with HUMAN_REQUIRED mode + AI context
    const conversationId = await createConversation(nexusUrl, "", contactId, params, summary);

    // Step 4: Add chat history as messages
    if (params.chatHistory.length > 0) {
      await addChatHistory(nexusUrl, "", conversationId, params.chatHistory, summary);
    }

    // Step 5: Trigger auto-assignment (round-robin)
    try {
      await triggerAssignment(nexusUrl, "", conversationId);
    } catch (err) {
      console.warn('[nexus] Auto-assignment failed (will be unassigned):', (err as Error).message);
    }

    console.log(`[nexus] Escalated: contact=${contactId} conversation=${conversationId}`);
    return { success: true, conversationId, contactId };
  } catch (error: any) {
    console.error('[nexus] Escalation failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sync a ticket to Nexus (simpler — creates task, not conversation).
 */
export async function syncTicketToNexus(ticket: Ticket): Promise<NexusSyncResult> {
  return escalateToNexus({
    studentName: ticket.studentName,
    studentEmail: ticket.studentEmail,
    studentId: ticket.studentId,
    subject: `[${ticket.folio}] ${ticket.subject}`,
    chatHistory: ticket.chatContext
      ? [{ role: 'user', content: ticket.chatContext }]
      : [],
    category: ticket.category,
    channel: ticket.channel,
  });
}

/**
 * Update conversation status in Nexus when ticket changes.
 */
export async function updateNexusCase(conversationId: string, status: string): Promise<void> {
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  const nexusPass = getConfig('nexus_password') || process.env.NEXUS_PASSWORD;
  if (!nexusUrl || !nexusPass) return;

  try {
    await nexusFetch(nexusUrl, "", `/api/v1/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: status === 'resolved' || status === 'closed' ? 'RESOLVED' : 'OPEN',
      }),
    });
  } catch (error: any) {
    console.error('[nexus] Update failed:', error.message);
  }
}

// ── Internal ────────────────────────────────────────────────────────

async function findOrCreateContact(url: string, _key: string, params: any): Promise<string> {
  // Search by email
  const searchRes = await nexusFetch(url, '', `/api/v1/contacts?search=${encodeURIComponent(params.studentEmail)}`);
  const searchData = await searchRes.json();

  const items = searchData.data?.data || searchData.data?.items || searchData.data || [];
  if (Array.isArray(items) && items.length > 0) {
    return items[0].id;
  }

  // Create new
  const createRes = await nexusFetch(url, '', '/api/v1/contacts', {
    method: 'POST',
    body: JSON.stringify({
      firstName: params.studentName.split(' ')[0],
      lastName: params.studentName.split(' ').slice(1).join(' ') || '',
      email: params.studentEmail,
      phone: params.phone || '',
    }),
  });

  const createData = await createRes.json();
  return createData.data?.id;
}

async function createConversation(url: string, key: string, contactId: string, params: any, summary: string): Promise<string> {
  const channelId = getConfig('nexus_channel_id') || process.env.NEXUS_CHANNEL_ID || '4bf0bccb-3741-4957-aefc-81d8f9693bfa';

  const res = await nexusFetch(url, key, '/api/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({
      channelId,
      contactId,
      subject: params.subject,
      status: 'OPEN',
      priority: 'HIGH',
      handlingMode: 'HUMAN_REQUIRED',
      metadata: {
        source: 'openclaw-chatbot',
        category: params.category,
        studentId: params.studentId || '',
        channel: params.channel || 'web',
        escalationReason: 'ai_unable_to_resolve',
        messageCount: params.chatHistory?.length || 0,
        aiSummary: summary,
      },
    }),
  });

  const data = await res.json();
  const convId = data.data?.id;

  // Update AI fields via PATCH (not accepted in POST create)
  if (convId) {
    try {
      await nexusFetch(url, key, `/api/v1/conversations/${convId}`, {
        method: 'PATCH',
        body: JSON.stringify({ subject: params.subject }),
      });
    } catch {}
  }

  return convId;
}

async function addChatHistory(url: string, key: string, conversationId: string, history: ChatMessage[], summary: string): Promise<void> {
  for (const msg of history.slice(-20)) {
    await nexusFetch(url, key, `/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: msg.content,
        contentType: 'TEXT',
        source: msg.role === 'user' ? 'CUSTOMER' : 'AI_AUTO',
        direction: msg.role === 'user' ? 'INBOUND' : 'OUTBOUND',
        isInternal: false,
        metadata: { fromChatbot: true, originalRole: msg.role },
      }),
    });
  }

  // Internal note with structured summary for the advisor
  await nexusFetch(url, key, `/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: `📋 RESUMEN DE ESCALACIÓN\n\n${summary}\n\n💬 ${history.length} mensajes previos con la IA (arriba).\nEl alumno necesita atención personalizada.`,
      contentType: 'TEXT',
      source: 'SYSTEM',
      direction: 'OUTBOUND',
      isInternal: true,
    }),
  });
}

/**
 * Generate a structured summary from the chat history.
 * This populates aiSummary in Nexus so the advisor gets instant context.
 */
function generateSummary(params: { studentName: string; subject: string; category: string; chatHistory: ChatMessage[] }): string {
  const userMsgs = params.chatHistory.filter(m => m.role === 'user').map(m => m.content);
  const lastUserMsg = userMsgs[userMsgs.length - 1] || params.subject;
  const issue = lastUserMsg.length > 100 ? lastUserMsg.slice(0, 100) + '...' : lastUserMsg;

  return `Alumno: ${params.studentName}\nCategoria: ${params.category}\nProblema: ${issue}\nMensajes con IA: ${params.chatHistory.length}\nMotivo: La IA no pudo resolver el caso.`;
}

/**
 * Trigger round-robin assignment for a conversation.
 * Queries available advisors and picks one using the pool.
 */
async function triggerAssignment(url: string, key: string, conversationId: string): Promise<void> {
  // Get available advisors from the pool
  const poolsRes = await nexusFetch(url, key, '/api/v1/routing/pools');
  const poolsData = await poolsRes.json();
  const pools = poolsData.data || [];

  if (!Array.isArray(pools) || pools.length === 0) return;

  // Find default pool or first active pool
  const pool = pools.find((p: any) => p.isDefault) || pools[0];
  if (!pool) return;

  // Get pool details with members
  const poolDetailRes = await nexusFetch(url, key, `/api/v1/routing/pools/${pool.id}`);
  const poolDetail = await poolDetailRes.json();
  const members = poolDetail.data?.members || [];

  // Filter available members
  const available = members.filter((m: any) => m.isAvailable);
  if (available.length === 0) return;

  // Simple round-robin: pick random available member
  const selected = available[Math.floor(Math.random() * available.length)];
  const assigneeId = selected.userId;

  // Assign the conversation
  await nexusFetch(url, key, `/api/v1/conversations/${conversationId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeId }),
  });

  console.log(`[nexus] Auto-assigned conversation ${conversationId} to ${assigneeId}`);
}

// ── Nexus Auth — auto-login with JWT refresh ─────────────────────

let nexusToken: string | null = null;
let nexusTokenExpiry = 0;

async function getNexusToken(baseUrl: string): Promise<string> {
  // Return cached token if still valid (with 2 min buffer)
  if (nexusToken && Date.now() < nexusTokenExpiry - 120_000) {
    return nexusToken;
  }

  const email = getConfig('nexus_email') || process.env.NEXUS_EMAIL || 'admin@nexus.mx';
  const password = getConfig('nexus_password') || process.env.NEXUS_PASSWORD || '';

  if (!password) {
    throw new Error('Nexus password not configured');
  }

  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Nexus login failed: ${res.status}`);

  const data = await res.json();
  nexusToken = data.data?.accessToken;
  nexusTokenExpiry = Date.now() + 14 * 60_000; // JWT lasts 15 min, refresh at 14

  if (!nexusToken) throw new Error('No token in Nexus login response');
  return nexusToken;
}

async function nexusFetch(baseUrl: string, _apiKey: string, path: string, options?: RequestInit): Promise<Response> {
  const token = await getNexusToken(baseUrl);

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options?.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`Nexus API ${res.status}: ${text.slice(0, 100)}`);
  }

  return res;
}
