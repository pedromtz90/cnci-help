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

    // Step 2: Create conversation with HUMAN_REQUIRED mode
    const conversationId = await createConversation(nexusUrl, "", contactId, params);

    // Step 3: Add chat history as messages
    if (params.chatHistory.length > 0) {
      await addChatHistory(nexusUrl, "", conversationId, params.chatHistory);
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

  const items = searchData.data?.items || searchData.data || [];
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

async function createConversation(url: string, key: string, contactId: string, params: any): Promise<string> {
  // Get channelId from settings or use default WEB_WIDGET
  const channelId = getConfig('nexus_channel_id') || '4bf0bccb-3741-4957-aefc-81d8f9693bfa';

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
        source: 'cnci-help-chatbot',
        category: params.category,
        studentId: params.studentId || '',
      },
    }),
  });

  const data = await res.json();
  return data.data?.id;
}

async function addChatHistory(url: string, key: string, conversationId: string, history: ChatMessage[]): Promise<void> {
  // Add each message to the conversation
  for (const msg of history.slice(-20)) { // Last 20 messages max
    await nexusFetch(url, key, `/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: msg.content,
        contentType: 'TEXT',
        source: msg.role === 'user' ? 'CUSTOMER' : 'AI_AUTO',
        direction: msg.role === 'user' ? 'INBOUND' : 'OUTBOUND',
        isInternal: false,
        metadata: {
          fromChatbot: true,
          originalRole: msg.role,
        },
      }),
    });
  }

  // Add internal note for the advisor
  await nexusFetch(url, key, `/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: `Escalación desde Centro de Ayuda CNCI.\nEl alumno no pudo resolver su duda por chatbot.\nCategoría: ${history.length} mensajes de contexto arriba.`,
      contentType: 'TEXT',
      source: 'HUMAN',
      direction: 'OUTBOUND',
      isInternal: true,
    }),
  });
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
