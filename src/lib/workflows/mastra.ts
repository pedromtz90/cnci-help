/**
 * CNCI Workflow Engine — Automated actions triggered by chat outcomes.
 *
 * Each workflow is a sequence of steps with error isolation.
 * Steps run in order. If one fails, the rest continue.
 * All steps are logged for traceability.
 *
 * Workflows:
 * 1. no-answer — record gap + create ticket + escalate to Nexus
 * 2. payment — track payment intent for analytics
 * 3. enrollment — capture lead in Nexus + notify admissions
 * 4. repeated-failure — auto-escalate after 2+ failures
 */
import { createTicket } from '@/lib/tickets/service';
import { escalateToNexus } from '@/lib/nexus/sync';
import { trackEvent } from '@/lib/analytics/service';
import { recordGap } from '@/lib/knowledge/gaps';
import { getDb } from '@/lib/db/database';

interface WorkflowInput {
  question: string;
  studentName?: string;
  studentEmail?: string;
  studentId?: string;
  phone?: string;
  chatHistory?: Array<{ role: string; content: string }>;
  category?: string;
  confidence?: string;
  failureCount?: number;
}

interface WorkflowResult {
  success: boolean;
  workflow: string;
  steps: Array<{ step: string; result: any }>;
  error?: string;
}

export async function runWorkflow(workflowId: string, input: WorkflowInput): Promise<WorkflowResult> {
  const result: WorkflowResult = { success: true, workflow: workflowId, steps: [] };

  try {
    switch (workflowId) {
      case 'no-answer': await executeNoAnswer(input, result); break;
      case 'payment': await executePayment(input, result); break;
      case 'enrollment': await executeEnrollment(input, result); break;
      case 'repeated-failure': await executeRepeatedFailure(input, result); break;
      default: result.success = false; result.error = `Unknown workflow: ${workflowId}`;
    }
  } catch (error: any) {
    result.success = false;
    result.error = error.message;
  }

  console.log(`[workflow:${workflowId}] ${result.steps.length} steps, success=${result.success}`);
  return result;
}

async function executeNoAnswer(input: WorkflowInput, result: WorkflowResult) {
  try { getDb(); recordGap(input.question, input.confidence || 'low', 'workflow'); trackEvent({ type: 'chat', query: input.question, confidence: 'low', source: 'workflow', resolved: false }); result.steps.push({ step: 'record-gap', result: 'ok' }); } catch (e: any) { result.steps.push({ step: 'record-gap', result: e.message }); }

  if (input.studentName && input.studentEmail) {
    try { getDb(); const ticket = createTicket({ studentName: input.studentName, studentId: input.studentId || '', studentEmail: input.studentEmail, category: input.category || 'soporte', subject: `Pregunta sin resolver: ${input.question.slice(0, 100)}`, description: `El chatbot no pudo resolver.\n\n"${input.question}"`, channel: 'chat', chatContext: input.chatHistory?.map((m) => `${m.role}: ${m.content}`).join('\n') }); result.steps.push({ step: 'create-ticket', result: { folio: ticket.folio } }); } catch (e: any) { result.steps.push({ step: 'create-ticket', result: e.message }); }

    try { const r = await escalateToNexus({ studentName: input.studentName, studentEmail: input.studentEmail, studentId: input.studentId, phone: input.phone, subject: `[Auto] ${input.question.slice(0, 80)}`, chatHistory: (input.chatHistory || [{ role: 'user', content: input.question }]) as any, category: input.category || 'soporte' }); result.steps.push({ step: 'escalate-nexus', result: { conversationId: r.conversationId } }); } catch (e: any) { result.steps.push({ step: 'escalate-nexus', result: e.message }); }
  }
}

async function executePayment(input: WorkflowInput, result: WorkflowResult) {
  try { getDb(); trackEvent({ type: 'chat', query: input.question, category: 'pagos', source: 'workflow', resolved: true }); result.steps.push({ step: 'track-intent', result: 'ok' }); } catch (e: any) { result.steps.push({ step: 'track-intent', result: e.message }); }
}

async function executeEnrollment(input: WorkflowInput, result: WorkflowResult) {
  try { getDb(); trackEvent({ type: 'chat', query: input.question, category: 'inscripcion', source: 'workflow' }); result.steps.push({ step: 'track-intent', result: 'ok' }); } catch (e: any) { result.steps.push({ step: 'track-intent', result: e.message }); }

  if (input.studentName && input.studentEmail) {
    try { const r = await escalateToNexus({ studentName: input.studentName, studentEmail: input.studentEmail, phone: input.phone, subject: '[Inscripción] Interés detectado por chatbot', chatHistory: [{ role: 'user' as const, content: input.question }], category: 'inscripcion' }); result.steps.push({ step: 'create-lead', result: { contactId: r.contactId } }); } catch (e: any) { result.steps.push({ step: 'create-lead', result: e.message }); }
  }
}

async function executeRepeatedFailure(input: WorkflowInput, result: WorkflowResult) {
  const count = input.failureCount || 0;
  if (count < 2) { result.steps.push({ step: 'check-threshold', result: { escalate: false, count } }); return; }

  result.steps.push({ step: 'check-threshold', result: { escalate: true, count } });

  if (input.studentName && input.studentEmail) {
    try { getDb(); const ticket = createTicket({ studentName: input.studentName, studentId: input.studentId || '', studentEmail: input.studentEmail, category: 'soporte', priority: 'high', subject: `[Auto-escalación] ${count} intentos sin resolver`, description: `Chatbot falló ${count} veces.\n\nÚltima: "${input.question}"`, channel: 'chat', chatContext: input.chatHistory?.map((m) => `${m.role}: ${m.content}`).join('\n') }); result.steps.push({ step: 'create-ticket', result: { folio: ticket.folio } }); } catch (e: any) { result.steps.push({ step: 'create-ticket', result: e.message }); }

    try { const r = await escalateToNexus({ studentName: input.studentName, studentEmail: input.studentEmail, subject: `[Urgente] ${count} intentos sin resolver`, chatHistory: (input.chatHistory || [{ role: 'user', content: input.question }]) as any, category: 'soporte' }); result.steps.push({ step: 'escalate-nexus', result: { conversationId: r.conversationId } }); } catch (e: any) { result.steps.push({ step: 'escalate-nexus', result: e.message }); }
  }
}
