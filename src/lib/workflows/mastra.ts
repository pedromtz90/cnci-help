/**
 * CNCI Student Services Workflow Engine
 *
 * HubSpot-inspired workflow with:
 * - Enrollment trigger (chat fallback, manual, form)
 * - Input validation
 * - AI classification (category, urgency, dropout risk)
 * - If/then branches by category
 * - Actions (ticket, email, escalation, assignment)
 * - Retry on failure
 * - Case closure with notification
 * - Full audit trail
 */
import {
  CaseInput, CaseInputSchema, Classification,
  toolValidateInput, toolClassifyCase, toolCreateTicket,
  toolAssignDepartment, toolUpdateCaseStatus, toolSendEmail,
  toolSaveAuditLog, toolEscalateToNexus, toolRecordGap, toolTrackEvent,
  escapeHtml,
} from './tools';

// ── Types ───────────────────────────────────────────────────────────

interface StepResult {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  data?: any;
  error?: string;
  durationMs: number;
}

interface WorkflowResult {
  success: boolean;
  workflow: string;
  ticketFolio?: string;
  ticketId?: string;
  nexusConversationId?: string;
  classification?: Classification;
  steps: StepResult[];
  totalMs: number;
  error?: string;
}

// ── Step executor with retry ────────────────────────────────────────

async function executeStep(
  name: string,
  fn: () => Promise<any> | any,
  retries = 1,
): Promise<StepResult> {
  const start = Date.now();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fn();
      return { step: name, status: 'success', data, durationMs: Date.now() - start };
    } catch (e: any) {
      if (attempt === retries) {
        return { step: name, status: 'failed', error: e.message, durationMs: Date.now() - start };
      }
      console.log(`[workflow] Step "${name}" failed (attempt ${attempt + 1}/${retries + 1}), retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { step: name, status: 'failed', error: 'Max retries exceeded', durationMs: Date.now() - start };
}

// ── Main Workflow: Student Service Case ─────────────────────────────

export async function runStudentServiceWorkflow(rawInput: any): Promise<WorkflowResult> {
  const wfStart = Date.now();
  const result: WorkflowResult = { success: true, workflow: 'student-service', steps: [], totalMs: 0 };

  // ─── Step 1: VALIDATE INPUT ───────────────────────────────────
  const validateResult = await executeStep('validate-input', () => {
    const parsed = CaseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { valid: false, missing: parsed.error.issues.map((i) => i.path.join('.')) };
    }
    const validation = toolValidateInput(parsed.data);
    return { valid: validation.valid, missing: validation.missing, input: parsed.data };
  });
  result.steps.push(validateResult);

  const input = validateResult.data?.input as CaseInput | undefined;
  if (!input) {
    result.success = false;
    result.error = 'Input inválido';
    result.totalMs = Date.now() - wfStart;
    return result;
  }

  const isIncomplete = !validateResult.data.valid;

  // ─── Step 2: CLASSIFY with Claude ─────────────────────────────
  const classifyResult = await executeStep('classify-case', () => toolClassifyCase(input), 2);
  result.steps.push(classifyResult);

  const classification: Classification = classifyResult.data || {
    category: 'otra', urgency: 'media', summary: input.subject,
    riskOfDropout: false, department: 'Servicios Estudiantiles',
    isComplete: !isIncomplete, missingFields: validateResult.data.missing,
  };
  result.classification = classification;

  // Override urgency if dropout risk
  if (classification.riskOfDropout) {
    classification.urgency = 'alta';
  }

  // Mark incomplete if validation failed
  if (isIncomplete) {
    classification.isComplete = false;
    classification.missingFields = validateResult.data.missing;
  }

  // ─── Step 3: CREATE TICKET ────────────────────────────────────
  const ticketResult = await executeStep('create-ticket', () => {
    const ticket = toolCreateTicket(input, classification);
    return { folio: ticket.folio, id: ticket.id };
  }, 1);
  result.steps.push(ticketResult);

  if (ticketResult.status === 'success') {
    result.ticketFolio = ticketResult.data.folio;
    result.ticketId = ticketResult.data.id;
  }

  // ─── Step 4: ASSIGN DEPARTMENT (if/then branch) ───────────────
  if (result.ticketId) {
    let department = classification.department;

    // Branch by category
    if (classification.category === 'financiera') department = 'Cobranza';
    else if (classification.category === 'tecnica') department = 'Soporte Técnico';
    else if (classification.category === 'inscripcion') department = 'Servicios Estudiantiles';
    else if (classification.category === 'academica') department = 'Servicios Estudiantiles';
    else if (classification.category === 'administrativa') department = 'Escolar';

    const assignResult = await executeStep('assign-department', () => {
      toolAssignDepartment(result.ticketId!, department);
      return { department };
    });
    result.steps.push(assignResult);
  }

  // ─── Step 5: INCOMPLETE CASE HANDLING ─────────────────────────
  if (isIncomplete && result.ticketId) {
    const incompleteResult = await executeStep('mark-incomplete', () => {
      toolUpdateCaseStatus(result.ticketId!, 'waiting_student');
      return { status: 'waiting_student', missing: validateResult.data.missing };
    });
    result.steps.push(incompleteResult);
  }

  // ─── Step 6: HIGH PRIORITY / DROPOUT RISK ─────────────────────
  if (classification.riskOfDropout || classification.urgency === 'critica') {
    // Escalate to Nexus for immediate human attention
    const escalateResult = await executeStep('escalate-urgent', async () => {
      const convId = await toolEscalateToNexus(input, classification);
      return { nexusConversationId: convId, reason: classification.riskOfDropout ? 'Riesgo de baja' : 'Urgencia crítica' };
    }, 2);
    result.steps.push(escalateResult);
    result.nexusConversationId = escalateResult.data?.nexusConversationId;
  }

  // ─── Step 7: DEPARTMENT-SPECIFIC EMAIL ────────────────────────
  if (input.studentEmail && result.ticketFolio) {
    const emailResult = await executeStep('send-confirmation', async () => {
      const sent = await toolSendEmail(
        input.studentEmail!,
        `Tu solicitud ${result.ticketFolio} ha sido recibida — CNCI`,
        `<div style="font-family:Poppins,Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#004aad,#002d69);padding:24px;border-radius:16px 16px 0 0">
            <h2 style="color:white;margin:0">Tu solicitud ha sido recibida</h2>
          </div>
          <div style="padding:24px;background:#f8fafc;border-radius:0 0 16px 16px">
            <p>Hola ${escapeHtml(input.studentName)},</p>
            <p>Recibimos tu solicitud con folio <strong>${escapeHtml(result.ticketFolio!)}</strong>.</p>
            <p><strong>Categoría:</strong> ${escapeHtml(classification.category)}</p>
            <p><strong>Departamento asignado:</strong> ${escapeHtml(classification.department)}</p>
            <p><strong>Resumen:</strong> ${escapeHtml(classification.summary)}</p>
            ${classification.riskOfDropout ? '<p style="color:#dc2626"><strong>Tu caso ha sido marcado como prioritario.</strong> Un asesor te contactará a la brevedad.</p>' : ''}
            <p>Puedes dar seguimiento en <a href="https://cncifaq.com/tickets" style="color:#2563eb">cncifaq.com/tickets</a> con tu folio.</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">Universidad Virtual CNCI — Centro de Ayuda</p>
          </div>
        </div>`,
      );
      return { sent };
    });
    result.steps.push(emailResult);
  }

  // ─── Step 8: RECORD KNOWLEDGE GAP ─────────────────────────────
  const gapResult = await executeStep('record-gap', () => {
    toolRecordGap(input.subject);
    return { recorded: true };
  });
  result.steps.push(gapResult);

  // ─── Step 9: TRACK ANALYTICS ──────────────────────────────────
  const analyticsResult = await executeStep('track-analytics', () => {
    toolTrackEvent('ticket_create', classification.category, input.subject);
    if (classification.riskOfDropout) toolTrackEvent('escalation', 'riesgo_baja', input.subject);
    return { tracked: true };
  });
  result.steps.push(analyticsResult);

  // ─── Step 10: AUDIT LOG ───────────────────────────────────────
  const auditResult = await executeStep('audit-log', () => {
    toolSaveAuditLog(
      'workflow:student-service',
      'case_created',
      'ticket',
      result.ticketId,
      JSON.stringify({ classification, folio: result.ticketFolio }),
    );
    return { logged: true };
  });
  result.steps.push(auditResult);

  // Check if any critical step failed
  const criticalFails = result.steps.filter((s) =>
    ['create-ticket', 'classify-case'].includes(s.step) && s.status === 'failed'
  );
  if (criticalFails.length > 0) {
    result.success = false;
    result.error = `Steps failed: ${criticalFails.map((s) => s.step).join(', ')}`;
  }

  result.totalMs = Date.now() - wfStart;
  return result;
}

// ── Case Resolution Workflow ────────────────────────────────────────

export async function runCaseResolutionWorkflow(input: {
  ticketId: string;
  resolvedBy: string;
  resolutionNote?: string;
}): Promise<WorkflowResult> {
  const wfStart = Date.now();
  const result: WorkflowResult = { success: true, workflow: 'case-resolution', steps: [], totalMs: 0 };

  // Step 1: Update status
  const statusResult = await executeStep('update-status', () => {
    const ticket = toolUpdateCaseStatus(input.ticketId, 'resolved');
    return { folio: ticket?.folio, studentEmail: ticket?.studentEmail, studentName: ticket?.studentName };
  });
  result.steps.push(statusResult);

  // Step 2: Send resolution email
  if (statusResult.data?.studentEmail) {
    const emailResult = await executeStep('send-resolution-email', async () => {
      await toolSendEmail(
        statusResult.data.studentEmail,
        `Tu solicitud ${statusResult.data.folio} ha sido resuelta — CNCI`,
        `<div style="font-family:Poppins,Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#004aad,#002d69);padding:24px;border-radius:16px 16px 0 0">
            <h2 style="color:white;margin:0">Tu solicitud fue resuelta</h2>
          </div>
          <div style="padding:24px;background:#f8fafc;border-radius:0 0 16px 16px">
            <p>Hola ${escapeHtml(statusResult.data.studentName)},</p>
            <p>Tu solicitud <strong>${escapeHtml(statusResult.data.folio)}</strong> ha sido resuelta.</p>
            ${input.resolutionNote ? `<p><strong>Nota:</strong> ${escapeHtml(input.resolutionNote)}</p>` : ''}
            <p>¿Te ayudamos bien? Cuéntanos tu experiencia:</p>
            <div style="text-align:center;margin:20px 0">
              <a href="https://cncifaq.com/api/analytics?action=satisfaction&folio=${statusResult.data.folio}&score=5" style="font-size:32px;text-decoration:none;margin:0 8px">😄</a>
              <a href="https://cncifaq.com/api/analytics?action=satisfaction&folio=${statusResult.data.folio}&score=3" style="font-size:32px;text-decoration:none;margin:0 8px">😐</a>
              <a href="https://cncifaq.com/api/analytics?action=satisfaction&folio=${statusResult.data.folio}&score=1" style="font-size:32px;text-decoration:none;margin:0 8px">😞</a>
            </div>
            <p style="color:#94a3b8;font-size:12px">Universidad Virtual CNCI — Centro de Ayuda</p>
          </div>
        </div>`,
      );
      return { sent: true };
    });
    result.steps.push(emailResult);
  }

  // Step 3: Audit
  const auditResult = await executeStep('audit-log', () => {
    toolSaveAuditLog(input.resolvedBy, 'case_resolved', 'ticket', input.ticketId, input.resolutionNote);
    return { logged: true };
  });
  result.steps.push(auditResult);

  result.totalMs = Date.now() - wfStart;
  return result;
}

// ── Legacy adapter (for existing runWorkflow calls) ─────────────────

export async function runWorkflow(workflowId: string, input: any): Promise<WorkflowResult> {
  switch (workflowId) {
    case 'student-service':
    case 'no-answer':
      return runStudentServiceWorkflow(input);
    case 'case-resolution':
      return runCaseResolutionWorkflow(input);
    case 'payment':
      return runSimpleWorkflow('payment', input, () => {
        toolTrackEvent('chat', 'pagos', input.question);
      });
    case 'enrollment':
      return runSimpleWorkflow('enrollment', input, async () => {
        toolTrackEvent('chat', 'inscripcion', input.question);
        if (input.studentEmail) await toolEscalateToNexus(input, { category: 'inscripcion', urgency: 'media', summary: input.question, riskOfDropout: false, department: 'Servicios Estudiantiles', isComplete: true, missingFields: [] });
      });
    case 'repeated-failure':
      if ((input.failureCount || 0) < 2) {
        return { success: true, workflow: 'repeated-failure', steps: [{ step: 'check-threshold', status: 'skipped', data: { count: input.failureCount }, durationMs: 0 }], totalMs: 0 };
      }
      return runStudentServiceWorkflow({ ...input, subject: `[Auto-escalación] ${input.failureCount} intentos`, description: `Chatbot falló ${input.failureCount} veces. Última: "${input.question}"` });
    default:
      return { success: false, workflow: workflowId, steps: [], totalMs: 0, error: `Unknown workflow: ${workflowId}` };
  }
}

async function runSimpleWorkflow(id: string, input: any, fn: () => Promise<void> | void): Promise<WorkflowResult> {
  const start = Date.now();
  const step = await executeStep('execute', fn);
  return { success: step.status === 'success', workflow: id, steps: [step], totalMs: Date.now() - start };
}
