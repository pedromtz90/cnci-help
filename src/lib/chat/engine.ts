import type { ChatRequest, ChatResponse, ContentItem, SuggestedAction } from '@/types/content';
import { exactFaqMatch, retrieveForRAG } from '@/lib/knowledge/search';
import { trackEvent } from '@/lib/analytics/service';
import { flowPaymentQuestion, flowEnrollmentIntent, flowLowConfidence } from '@/lib/workflows/flows';
import { getDepartmentEmail, getConfig } from '@/lib/settings/service';

const SYSTEM_PROMPT = `Eres el Asistente Virtual de Servicios Estudiantiles de la Universidad Virtual CNCI.

REGLAS ESTRICTAS:
- Responde SOLO en español.
- Sé claro, breve y con tono institucional amable.
- Basa tus respuestas EXCLUSIVAMENTE en el contexto proporcionado.
- Si la información no está en el contexto, dilo honestamente y sugiere contactar al área correspondiente.
- NUNCA inventes información sobre trámites, fechas, costos o requisitos.
- Cita la fuente cuando uses información de un artículo o FAQ específica.
- Mantén las respuestas concisas (máximo 3 párrafos).
- Si detectas intención de inscripción, incluye un mensaje de bienvenida.`;

// Department emails now come from settings (configurable via admin panel)

/**
 * Main chat processing pipeline.
 * Gate 1: Exact FAQ match (zero LLM cost)
 * Gate 2: Content retrieval + synthesis
 * Gate 3: LLM augmentation (if configured)
 * Gate 4: Fallback with department suggestion
 */
export async function processChat(req: ChatRequest): Promise<ChatResponse> {
  const start = Date.now();

  // ── Gate 1: Exact FAQ match ──
  const faqMatch = exactFaqMatch(req.message);
  if (faqMatch) {
    trackEvent({ type: 'chat', query: req.message, category: faqMatch.category, confidence: 'high', source: 'faq', resolved: true });
    return buildFaqResponse(faqMatch, start);
  }

  // ── Gate 2: Content retrieval ──
  const retrieved = retrieveForRAG(req.message, 3);
  if (retrieved.length > 0) {
    const aiKey = getConfig('ai_api_key') || process.env.AI_API_KEY;
    if (aiKey) {
      // Gate 3: LLM synthesis with retrieved context
      trackEvent({ type: 'chat', query: req.message, category: retrieved[0].category, confidence: 'medium', source: 'llm', resolved: true });
      return await buildLLMResponse(req, retrieved, start, aiKey);
    }
    // No LLM — return best match directly
    trackEvent({ type: 'chat', query: req.message, category: retrieved[0].category, confidence: 'medium', source: 'retrieval', resolved: true });
    return buildRetrievalResponse(retrieved, start);
  }

  // ── Gate 4: Fallback — offer ticket creation ──
  trackEvent({ type: 'chat', query: req.message, confidence: 'low', source: 'fallback', resolved: false });

  // ── Workflow triggers (non-blocking) ──
  triggerWorkflows(req);

  return buildFallbackResponse(req.message, start);
}

/** Fire-and-forget workflow triggers based on intent detection. */
function triggerWorkflows(req: ChatRequest): void {
  const msg = req.message.toLowerCase();
  const ctx = req.context || {};

  // Detect payment intent
  if (/pago|beca|factura|costo|mensualidad|descuento|cobro/.test(msg)) {
    flowPaymentQuestion({
      question: req.message,
      studentName: ctx.studentName,
      studentEmail: ctx.studentEmail,
    }).catch(() => {});
  }

  // Detect enrollment intent
  if (/inscri|registro|nuevo ingreso|quiero estudiar|me interesa|cómo entro/.test(msg)) {
    flowEnrollmentIntent({
      question: req.message,
      studentName: ctx.studentName,
      studentEmail: ctx.studentEmail,
    }).catch(() => {});
  }
}

function buildFaqResponse(faq: ContentItem, start: number): ChatResponse {
  // Use excerpt for chat, with link to full article
  const content = faq.excerpt || stripMdx(faq.content).slice(0, 500);

  return {
    content,
    sources: [{
      title: faq.title,
      slug: faq.slug,
      type: faq.type,
      category: faq.category,
    }],
    metadata: {
      source: 'faq',
      confidence: 'high',
      mode: 'help',
      processingMs: Date.now() - start,
    },
    suggestedActions: faq.suggestedActions,
  };
}

function buildRetrievalResponse(items: ContentItem[], start: number): ChatResponse {
  const best = items[0];
  const content = best.excerpt || stripMdx(best.content).slice(0, 500);

  const related = items.slice(1).map((item) => ({
    title: item.title,
    slug: item.slug,
    type: item.type,
    category: item.category,
  }));

  return {
    content: `${content}\n\nPuedes ver más detalles en el artículo completo.`,
    sources: [
      { title: best.title, slug: best.slug, type: best.type, category: best.category },
      ...related,
    ],
    metadata: {
      source: 'retrieval',
      confidence: 'medium',
      mode: 'help',
      processingMs: Date.now() - start,
    },
    suggestedActions: best.suggestedActions,
  };
}

async function buildLLMResponse(
  req: ChatRequest,
  context: ContentItem[],
  start: number,
  apiKey: string,
): Promise<ChatResponse> {
  const contextText = context
    .map((item) => `[${item.title}]\n${stripMdx(item.content).slice(0, 800)}`)
    .join('\n\n---\n\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: `${SYSTEM_PROMPT}\n\nCONTEXTO DISPONIBLE:\n${contextText}`,
        messages: [
          ...(req.history || []).slice(-6).map((h) => ({
            role: h.role,
            content: h.content,
          })),
          { role: 'user', content: req.message },
        ],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return {
      content: text,
      sources: context.map((item) => ({
        title: item.title,
        slug: item.slug,
        type: item.type,
        category: item.category,
      })),
      metadata: {
        source: 'llm',
        confidence: 'medium',
        mode: req.mode,
        processingMs: Date.now() - start,
      },
      suggestedActions: context[0]?.suggestedActions,
    };
  } catch (error) {
    console.error('LLM call failed:', error);
    return buildRetrievalResponse(context, start);
  }
}

function buildFallbackResponse(message: string, start: number): ChatResponse {
  const dept = detectDepartment(message);

  return {
    content: `No encontré información específica sobre tu consulta en nuestra base de conocimientos.\n\nTe recomiendo contactar al área de **${dept.name}** para recibir orientación personalizada:\n📧 ${dept.email}`,
    sources: [],
    metadata: {
      source: 'fallback',
      confidence: 'low',
      mode: 'help',
      processingMs: Date.now() - start,
    },
    suggestedActions: [
      { type: 'email', label: `Escribir a ${dept.name}`, href: `mailto:${dept.email}` },
      { type: 'ticket', label: 'Crear ticket de soporte' },
    ],
    escalationHint: dept.name,
  };
}

function detectDepartment(msg: string): { name: string; email: string } {
  const m = msg.toLowerCase();
  if (/pago|beca|factura|costo|mensualidad/.test(m)) return getDepartmentEmail('pagos');
  if (/inscri|registro|nuevo ingreso/.test(m)) return getDepartmentEmail('inscripcion');
  if (/titulo|titulaci|tesis|egreso/.test(m)) return getDepartmentEmail('titulacion');
  if (/blackboard|office|contrase|acceso|error|técnico|plataforma/.test(m)) return getDepartmentEmail('soporte');
  if (/constancia|certificado|credencial|tramite/.test(m)) return getDepartmentEmail('tramites');
  if (/calificaci|materia|horario|historial/.test(m)) return getDepartmentEmail('academico');
  return getDepartmentEmail('contacto');
}

function stripMdx(mdx: string): string {
  return mdx
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
