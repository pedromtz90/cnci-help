/**
 * Workflow Tools — typed, testable, auditable actions.
 * Each tool does ONE thing. Workflows compose them.
 */
import { z } from 'zod';
import { createTicket as dbCreateTicket, updateTicketStatus, getTicketById } from '@/lib/tickets/service';
import { trackEvent } from '@/lib/analytics/service';
import { escalateToNexus } from '@/lib/nexus/sync';
import { logAudit, getConfig } from '@/lib/settings/service';
import { recordGap } from '@/lib/knowledge/gaps';
import { getDb } from '@/lib/db/database';
import type { Ticket } from '@/types/content';

// ── Schemas ─────────────────────────────────────────────────────────

export const CaseInputSchema = z.object({
  studentName: z.string(),
  studentId: z.string().optional(),    // matrícula
  studentEmail: z.string().email().optional(),
  phone: z.string().optional(),
  subject: z.string(),
  description: z.string(),
  category: z.string().optional(),
  channel: z.enum(['chat', 'help', 'manual', 'email']).default('chat'),
  chatHistory: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
});

export type CaseInput = z.infer<typeof CaseInputSchema>;

export const ClassificationSchema = z.object({
  category: z.enum(['financiera', 'tecnica', 'academica', 'administrativa', 'inscripcion', 'otra']),
  urgency: z.enum(['critica', 'alta', 'media', 'baja']),
  summary: z.string(),
  riskOfDropout: z.boolean(),
  department: z.string(),
  isComplete: z.boolean(),
  missingFields: z.array(z.string()),
});

export type Classification = z.infer<typeof ClassificationSchema>;

// ── Tool: Validate Input ────────────────────────────────────────────

export function toolValidateInput(input: CaseInput): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!input.studentId) missing.push('matrícula');
  if (!input.studentEmail) missing.push('email');
  if (!input.studentName || input.studentName.length < 2) missing.push('nombre');
  return { valid: missing.length === 0, missing };
}

// ── Tool: Classify with Claude ──────────────────────────────────────

export async function toolClassifyCase(input: CaseInput): Promise<Classification> {
  const aiKey = getConfig('ai_api_key') || process.env.AI_API_KEY;

  if (!aiKey) {
    // Fallback: keyword-based classification
    return classifyByKeywords(input);
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': aiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: getConfig('ai_model') || 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `Clasificas solicitudes de alumnos universitarios. Responde SOLO en JSON con este formato exacto:
{"category":"financiera|tecnica|academica|administrativa|inscripcion|otra","urgency":"critica|alta|media|baja","summary":"resumen en 1 oración","riskOfDropout":true|false,"department":"nombre del departamento"}
Reglas: si menciona pago/beca/factura→financiera. Si error/plataforma/blackboard→tecnica. Si calificación/materia/tutor→academica. Si constancia/credencial/tramite→administrativa. Si inscripción/baja→inscripcion. Si dice quiere dejar de estudiar o darse de baja→riskOfDropout:true.`,
        messages: [{ role: 'user', content: `Alumno: ${input.studentName}\nAsunto: ${input.subject}\nDescripción: ${input.description}` }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return classifyByKeywords(input);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const json = JSON.parse(text);

    return {
      category: json.category || 'otra',
      urgency: json.urgency || 'media',
      summary: json.summary || input.subject,
      riskOfDropout: !!json.riskOfDropout,
      department: json.department || 'Servicios Estudiantiles',
      isComplete: !!input.studentId && !!input.studentEmail,
      missingFields: toolValidateInput(input).missing,
    };
  } catch {
    return classifyByKeywords(input);
  }
}

function classifyByKeywords(input: CaseInput): Classification {
  const text = `${input.subject} ${input.description}`.toLowerCase();
  let category: Classification['category'] = 'otra';
  let department = 'Servicios Estudiantiles';
  let urgency: Classification['urgency'] = 'media';

  if (/pago|beca|factura|costo|mensualidad|cobro|recibo/.test(text)) { category = 'financiera'; department = 'Cobranza'; }
  else if (/blackboard|office|error|plataforma|acceso|contraseña|no puedo entrar/.test(text)) { category = 'tecnica'; department = 'Soporte Técnico'; }
  else if (/calificación|materia|tutor|examen|extraordinario|kardex/.test(text)) { category = 'academica'; department = 'Servicios Estudiantiles'; }
  else if (/constancia|certificado|credencial|tramite|documento/.test(text)) { category = 'administrativa'; department = 'Servicios Estudiantiles'; }
  else if (/inscri|baja|cambio.*carrera|registro/.test(text)) { category = 'inscripcion'; department = 'Servicios Estudiantiles'; }

  const riskOfDropout = /baja|dejar de estudiar|ya no quiero|cancelar inscripción/.test(text);
  if (riskOfDropout) urgency = 'alta';

  const validation = toolValidateInput(input);

  return { category, urgency, summary: input.subject, riskOfDropout, department, isComplete: validation.valid, missingFields: validation.missing };
}

// ── Tool: Create Ticket ─────────────────────────────────────────────

export function toolCreateTicket(input: CaseInput, classification: Classification): Ticket {
  getDb();
  return dbCreateTicket({
    studentName: input.studentName,
    studentId: input.studentId || '',
    studentEmail: input.studentEmail || '',
    category: classification.category,
    priority: classification.urgency === 'critica' ? 'critical' : classification.urgency === 'alta' ? 'high' : 'medium',
    subject: classification.summary || input.subject,
    description: input.description,
    channel: input.channel,
    chatContext: input.chatHistory?.map((m) => `${m.role}: ${m.content}`).join('\n'),
  });
}

// ── Tool: Assign Department ─────────────────────────────────────────

export function toolAssignDepartment(ticketId: string, department: string): void {
  getDb();
  const db = getDb();
  db.prepare("UPDATE tickets SET department = ?, updated_at = datetime('now') WHERE id = ?").run(department, ticketId);
}

// ── Tool: Update Case Status ────────────────────────────────────────

export function toolUpdateCaseStatus(ticketId: string, status: 'open' | 'in_review' | 'waiting_student' | 'resolved' | 'closed'): Ticket | null {
  getDb();
  return updateTicketStatus(ticketId, status);
}

// ── Tool: Send Email ────────────────────────────────────────────────

export async function toolSendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    const nodemailer = await import('nodemailer');
    const host = getConfig('smtp_host') || process.env.SMTP_HOST;
    if (!host) { console.log(`[tool:email] SMTP not configured — would send to ${to}: ${subject}`); return false; }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(getConfig('smtp_port') || process.env.SMTP_PORT || '587'),
      secure: (getConfig('smtp_port') || process.env.SMTP_PORT) === '465',
      auth: { user: getConfig('smtp_user') || process.env.SMTP_USER, pass: getConfig('smtp_pass') || process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: getConfig('smtp_from') || process.env.SMTP_FROM || 'soporte@cncivirtual.mx',
      to, subject, html: body,
    });
    return true;
  } catch (e: any) {
    console.error(`[tool:email] Failed:`, e.message);
    return false;
  }
}

// ── Tool: Save Audit Log ────────────────────────────────────────────

export function toolSaveAuditLog(actor: string, action: string, entityType: string, entityId?: string, details?: string): void {
  logAudit(actor, action, entityType, entityId, undefined, details);
}

// ── Tool: Escalate to Nexus ─────────────────────────────────────────

export async function toolEscalateToNexus(input: CaseInput, classification: Classification): Promise<string | null> {
  if (!input.studentEmail) return null;
  const result = await escalateToNexus({
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    studentId: input.studentId,
    phone: input.phone,
    subject: `[${classification.urgency.toUpperCase()}] ${classification.summary}`,
    chatHistory: (input.chatHistory || [{ role: 'user', content: input.description }]) as any,
    category: classification.category,
  });
  return result.conversationId || null;
}

// ── Tool: Record Knowledge Gap ──────────────────────────────────────

export function toolRecordGap(question: string): void {
  getDb();
  recordGap(question, 'low', 'workflow');
}

// ── Tool: Track Analytics Event ─────────────────────────────────────

export function toolTrackEvent(type: string, category: string, query?: string): void {
  getDb();
  trackEvent({ type: type as any, category, query, source: 'workflow' });
}
