/**
 * Nexus Agent Tools — Let Ana interact with Nexus CRM.
 *
 * Each tenant gets isolated access. Ana can:
 * - Create work orders (service requests)
 * - Check status of existing work orders/tickets
 * - Search the service catalog
 * - Answer basic support questions using Nexus knowledge
 *
 * IMPORTANT: All calls are scoped to a single tenant via JWT auth.
 * Ana NEVER accesses data from other tenants.
 */
import { getConfig } from '@/lib/settings/service';

interface NexusAgentResponse {
  success: boolean;
  intent?: string;
  response?: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Get auth token for Nexus API.
 * Uses stored credentials — each deployment has its own tenant credentials.
 */
async function getNexusAuth(): Promise<{ token: string; tenantId: string } | null> {
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  const email = getConfig('nexus_email') || process.env.NEXUS_EMAIL;
  const password = getConfig('nexus_password') || process.env.NEXUS_PASSWORD;

  if (!nexusUrl || !email || !password) {
    console.log('[nexus-agent] Not configured — skipping');
    return null;
  }

  try {
    const res = await fetch(`${nexusUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const payload = data.data || data;
    return {
      token: payload.accessToken,
      tenantId: payload.user?.currentTenant?.id || '',
    };
  } catch (err) {
    console.error('[nexus-agent] Auth failed:', err);
    return null;
  }
}

/**
 * Send a customer message to Nexus Agent Gateway.
 * The gateway uses AI to understand intent and take appropriate action
 * (create WO, check status, search catalog, or answer support question).
 *
 * All responses are tenant-scoped — Ana never leaks cross-tenant data.
 */
export async function sendToNexusAgent(params: {
  message: string;
  customerName?: string;
  customerEmail?: string;
  channel?: string;
}): Promise<NexusAgentResponse> {
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  const auth = await getNexusAuth();

  if (!auth || !nexusUrl) {
    return { success: false, error: 'Nexus not configured' };
  }

  try {
    const res = await fetch(`${nexusUrl}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
        'X-Tenant-ID': auth.tenantId,
      },
      body: JSON.stringify({
        message: params.message,
        context: {
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          channel: params.channel || 'chatbot',
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Nexus API error: ${res.status}` };
    }

    const data = await res.json();
    const payload = data.data || data;

    return {
      success: true,
      intent: payload.intent,
      response: payload.response,
      data: payload.data,
    };
  } catch (err: any) {
    console.error('[nexus-agent] Chat failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Create a work order directly in Nexus.
 * Used when Ana has already determined a service visit is needed.
 */
export async function createNexusWorkOrder(params: {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  contactEmail?: string;
  companyName?: string;
  address?: string;
  scheduledStart?: string;
}): Promise<NexusAgentResponse> {
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  const auth = await getNexusAuth();

  if (!auth || !nexusUrl) {
    return { success: false, error: 'Nexus not configured' };
  }

  try {
    const res = await fetch(`${nexusUrl}/agent/actions/create-work-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
        'X-Tenant-ID': auth.tenantId,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, error: `Failed to create WO: ${res.status}` };
    }

    const data = await res.json();
    const payload = data.data || data;

    return {
      success: true,
      response: payload.message,
      data: payload,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Check status of a work order or ticket in Nexus.
 */
export async function checkNexusStatus(params: {
  type: 'work-order' | 'ticket';
  number?: string;
  customerEmail?: string;
}): Promise<NexusAgentResponse> {
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  const auth = await getNexusAuth();

  if (!auth || !nexusUrl) {
    return { success: false, error: 'Nexus not configured' };
  }

  try {
    const res = await fetch(`${nexusUrl}/agent/actions/check-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
        'X-Tenant-ID': auth.tenantId,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, error: `Status check failed: ${res.status}` };
    }

    const data = await res.json();
    const payload = data.data || data;

    return {
      success: true,
      response: payload.message,
      data: payload,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Detect if a message should be handled by Nexus agent tools.
 * Returns true for messages about: service requests, status checks,
 * pricing, technical support, scheduling.
 */
export function shouldRouteToNexus(message: string): boolean {
  const lower = message.toLowerCase();

  // Don't route CNCI-specific queries to Nexus
  const cnciKeywords = [
    'inscripción', 'inscripcion', 'matrícula', 'matricula', 'calificaciones',
    'titulación', 'titulacion', 'beca', 'mensualidad', 'blackboard', 'campus',
    'carrera', 'licenciatura', 'maestría', 'maestria', 'bachillerato',
    'certificado', 'constancia', 'historial académico', 'semestre',
  ];
  if (cnciKeywords.some(kw => lower.includes(kw))) return false;

  // Don't route if Nexus is not configured
  const nexusUrl = getConfig('nexus_api_url') || process.env.NEXUS_API_URL;
  if (!nexusUrl) return false;

  const nexusKeywords = [
    // Service requests
    'necesito', 'instalar', 'reparar', 'mantenimiento', 'visita', 'técnico',
    'cámara', 'cctv', 'pos', 'punto de venta', 'red', 'wifi', 'cable',
    'equipo', 'computadora', 'impresora', 'servidor',
    // Status
    'estado', 'estatus', 'cómo va', 'como va', 'avance', 'orden de trabajo',
    'mi servicio', 'mi ticket', 'cuándo viene', 'cuando viene',
    // Pricing
    'precio', 'costo', 'cuánto cuesta', 'cuanto cuesta', 'cotización', 'cotizar',
    // Support
    'no funciona', 'se cayó', 'no enciende', 'no imprime', 'lento', 'error',
    'falla', 'problema', 'ayuda con', 'no puedo',
    // Scheduling
    'agendar', 'programar', 'cita', 'disponibilidad',
  ];

  return nexusKeywords.some(kw => lower.includes(kw));
}
