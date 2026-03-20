/**
 * Mastra Workflow Flows — Automated responses to chat/ticket events.
 *
 * These are pure orchestration functions.
 * They decide WHAT to do based on context, then call tools.
 * Mastra is used for the orchestration pattern, not as a data store.
 */

import { toolCreateTicket, toolSendEmail, toolEscalateToHuman, toolCreateLead, toolLogEvent } from './tools';
import type { ChatResponse } from '@/types/content';

// ── Flow 1: No Answer Found ────────────────────────────────────────
// Triggered when chatbot confidence is 'low' and source is 'fallback'

export async function flowNoAnswerFound(context: {
  question: string;
  studentName?: string;
  studentEmail?: string;
  chatHistory?: string;
}): Promise<{ action: string; ticketFolio?: string }> {
  // If we have student info, auto-create ticket
  if (context.studentName && context.studentEmail) {
    const { ticket } = await toolCreateTicket({
      studentName: context.studentName,
      studentId: '',
      studentEmail: context.studentEmail,
      category: 'soporte',
      subject: `Pregunta sin resolver: ${context.question.slice(0, 100)}`,
      description: `El chatbot no pudo resolver esta pregunta:\n\n"${context.question}"\n\n${context.chatHistory || ''}`,
      channel: 'chat',
      priority: 'medium',
    });

    return { action: 'ticket_created', ticketFolio: ticket.folio };
  }

  // Otherwise, just log the gap
  toolLogEvent({
    type: 'chat',
    query: context.question,
    confidence: 'low',
    source: 'fallback',
    resolved: false,
  });

  return { action: 'logged_gap' };
}

// ── Flow 2: Payment Question ───────────────────────────────────────
// Triggered when chat detects payment/billing intent

export async function flowPaymentQuestion(context: {
  question: string;
  studentName?: string;
  studentEmail?: string;
}): Promise<{ action: string }> {
  // Send payment info email if we have student email
  if (context.studentEmail) {
    await toolSendEmail({
      to: context.studentEmail,
      subject: 'Información de pagos — Universidad Virtual CNCI',
      body: `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #004aad, #002d69); padding: 24px; border-radius: 16px 16px 0 0;">
            <h2 style="color: white; margin: 0;">Información de Pagos CNCI</h2>
          </div>
          <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 16px 16px;">
            <p>Hola ${context.studentName || 'Alumno'},</p>
            <p>Aquí tienes la información de métodos de pago disponibles:</p>
            <ul>
              <li><strong>Transferencia bancaria</strong> — BBVA (solicita cuenta en portal de pagos)</li>
              <li><strong>Depósito en OXXO</strong> — Solicita ficha en portal de pagos</li>
              <li><strong>Tarjeta de crédito/débito</strong> — En el portal de pagos en línea</li>
              <li><strong>Ventanilla en plantel</strong> — Lunes a viernes 9:00-18:00</li>
            </ul>
            <p><strong>Fecha límite:</strong> Día 10 de cada mes</p>
            <p><strong>Envía tu comprobante a:</strong> cobranza@cncivirtual.mx</p>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
              Este correo fue enviado desde el Centro de Ayuda CNCI.
            </p>
          </div>
        </div>
      `,
    });

    toolLogEvent({ type: 'chat', query: context.question, category: 'pagos', source: 'workflow', resolved: true });
    return { action: 'email_sent' };
  }

  return { action: 'no_email' };
}

// ── Flow 3: Enrollment Intent ──────────────────────────────────────
// Triggered when chat detects inscription/enrollment intent

export async function flowEnrollmentIntent(context: {
  question: string;
  studentName?: string;
  studentEmail?: string;
  phone?: string;
}): Promise<{ action: string; leadId?: string }> {
  if (context.studentName && context.studentEmail) {
    const result = await toolCreateLead({
      name: context.studentName,
      email: context.studentEmail,
      phone: context.phone,
      source: 'cnci-help-chatbot',
      notes: `Pregunta original: "${context.question}"`,
    });

    // Send welcome email
    await toolSendEmail({
      to: context.studentEmail,
      subject: '¡Gracias por tu interés en CNCI! — Te contactaremos pronto',
      body: `
        <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #004aad, #002d69); padding: 24px; border-radius: 16px 16px 0 0;">
            <h2 style="color: white; margin: 0;">¡Bienvenido a CNCI!</h2>
          </div>
          <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 16px 16px;">
            <p>Hola ${context.studentName},</p>
            <p>Recibimos tu interés en estudiar con nosotros. Un asesor te contactará en las próximas <strong>24 horas</strong> para orientarte sobre:</p>
            <ul>
              <li>Programas disponibles</li>
              <li>Proceso de inscripción</li>
              <li>Becas y descuentos</li>
              <li>Modalidades de estudio</li>
            </ul>
            <p>Mientras tanto, puedes consultar nuestro <a href="https://ayuda.cncivirtual.mx/help/inscripcion" style="color: #2563eb;">Centro de Ayuda</a> para más información.</p>
          </div>
        </div>
      `,
    });

    // Notify admissions team
    await toolEscalateToHuman({
      studentName: context.studentName,
      studentEmail: context.studentEmail,
      reason: 'Intención de inscripción detectada por chatbot',
      department: 'Servicios Estudiantiles',
      context: `Pregunta: "${context.question}"\nTeléfono: ${context.phone || 'No proporcionado'}`,
    });

    return { action: 'lead_created', leadId: result.leadId };
  }

  return { action: 'no_student_info' };
}

// ── Flow 4: Unresolved Technical Issue ─────────────────────────────
// Triggered when a technical support question isn't resolved after 2 attempts

export async function flowUnresolvedTechnical(context: {
  question: string;
  attempts: number;
  studentName?: string;
  studentEmail?: string;
  chatHistory?: string;
}): Promise<{ action: string; ticketFolio?: string }> {
  if (context.attempts >= 2 && context.studentName && context.studentEmail) {
    // Auto-create ticket and escalate
    const { ticket } = await toolCreateTicket({
      studentName: context.studentName,
      studentId: '',
      studentEmail: context.studentEmail,
      category: 'soporte',
      subject: `Problema técnico sin resolver: ${context.question.slice(0, 80)}`,
      description: `El alumno intentó resolver por chatbot ${context.attempts} veces sin éxito.\n\nPregunta: "${context.question}"\n\n${context.chatHistory || ''}`,
      channel: 'chat',
      priority: 'high',
    });

    await toolEscalateToHuman({
      ticketId: ticket.id,
      studentName: context.studentName,
      studentEmail: context.studentEmail,
      reason: 'Problema técnico no resuelto tras múltiples intentos',
      department: 'Soporte Técnico',
      context: context.chatHistory || context.question,
    });

    return { action: 'escalated', ticketFolio: ticket.folio };
  }

  return { action: 'suggest_retry' };
}

// ── Flow 5: Low Confidence Response ────────────────────────────────
// Triggered when chatbot responds but with low/medium confidence

export async function flowLowConfidence(context: {
  response: ChatResponse;
  question: string;
}): Promise<{ action: string }> {
  if (context.response.metadata.confidence === 'low') {
    toolLogEvent({
      type: 'chat',
      query: context.question,
      confidence: 'low',
      source: context.response.metadata.source,
      resolved: false,
    });

    return { action: 'suggest_ticket_or_contact' };
  }

  return { action: 'none' };
}

// ── Flow 6: Satisfaction Survey ────────────────────────────────────
// Triggered after a ticket is resolved

export async function flowSatisfactionSurvey(context: {
  ticketFolio: string;
  studentEmail: string;
  studentName: string;
}): Promise<{ action: string }> {
  await toolSendEmail({
    to: context.studentEmail,
    subject: `¿Te ayudamos bien? — Ticket ${context.ticketFolio}`,
    body: `
      <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #004aad, #002d69); padding: 24px; border-radius: 16px 16px 0 0;">
          <h2 style="color: white; margin: 0;">Tu opinión nos importa</h2>
        </div>
        <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 16px 16px; text-align: center;">
          <p>Hola ${context.studentName},</p>
          <p>Tu solicitud <strong>${context.ticketFolio}</strong> ha sido resuelta.</p>
          <p>¿Cómo calificarías tu experiencia?</p>
          <div style="margin: 24px 0;">
            <a href="${process.env.NEXTAUTH_URL || ''}/api/analytics?action=satisfaction&folio=${context.ticketFolio}&score=5" style="font-size: 32px; text-decoration: none; margin: 0 8px;">😄</a>
            <a href="${process.env.NEXTAUTH_URL || ''}/api/analytics?action=satisfaction&folio=${context.ticketFolio}&score=4" style="font-size: 32px; text-decoration: none; margin: 0 8px;">🙂</a>
            <a href="${process.env.NEXTAUTH_URL || ''}/api/analytics?action=satisfaction&folio=${context.ticketFolio}&score=3" style="font-size: 32px; text-decoration: none; margin: 0 8px;">😐</a>
            <a href="${process.env.NEXTAUTH_URL || ''}/api/analytics?action=satisfaction&folio=${context.ticketFolio}&score=2" style="font-size: 32px; text-decoration: none; margin: 0 8px;">😕</a>
            <a href="${process.env.NEXTAUTH_URL || ''}/api/analytics?action=satisfaction&folio=${context.ticketFolio}&score=1" style="font-size: 32px; text-decoration: none; margin: 0 8px;">😞</a>
          </div>
          <p style="color: #64748b; font-size: 12px;">Haz clic en la carita que mejor represente tu experiencia.</p>
        </div>
      </div>
    `,
  });

  return { action: 'survey_sent' };
}
