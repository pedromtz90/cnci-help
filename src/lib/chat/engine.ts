import type { ChatRequest, ChatResponse, ContentItem, SuggestedAction } from '@/types/content';
import { exactFaqMatch, retrieveForRAG } from '@/lib/knowledge/search';
import { trackEvent } from '@/lib/analytics/service';
import { flowPaymentQuestion, flowEnrollmentIntent, flowLowConfidence } from '@/lib/workflows/flows';
import { getDepartmentEmail, getConfig } from '@/lib/settings/service';
import { recordGap } from '@/lib/knowledge/gaps';

/** System prompt — loaded from settings DB so staff can edit it from /admin/settings */
function getSystemPrompt(): string {
  try {
    const custom = getConfig('chatbot_prompt');
    if (custom && custom.length > 20) return custom;
  } catch {}
  return `Eres un Ejecutivo de Servicios Estudiantiles de la Universidad Virtual CNCI.
Responde en español, de forma clara, directa y amable.
Basa tus respuestas EXCLUSIVAMENTE en el contexto proporcionado.
NUNCA inventes información. Si no sabes, dilo y sugiere contactar al área correcta.`;
}

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

  // Record as knowledge gap for training
  recordGap(req.message, 'low', 'fallback');

  // Workflow triggers (non-blocking)
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
  // Use full content — most CNCI FAQs are under 1000 chars, send complete
  const stripped = stripMdx(faq.content);
  const content = stripped.length > 1500
    ? stripped.slice(0, 1500).replace(/\s+\S*$/, '') + '\n\nPuedes ver el artículo completo para más detalles.'
    : stripped;

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
  const stripped = stripMdx(best.content);
  // Send full content — only truncate if extremely long
  const content = stripped.length > 2000
    ? stripped.slice(0, 2000).replace(/[.!?]\s[^.!?]*$/, '.') + '\n\nConsulta el artículo completo para más información.'
    : stripped;

  const related = items.slice(1).map((item) => ({
    title: item.title,
    slug: item.slug,
    type: item.type,
    category: item.category,
  }));

  return {
    content,
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
  // Label each source clearly so LLM can cite them
  const contextText = context
    .map((item, i) => `[FUENTE ${i + 1}: ${item.title}]\n${stripMdx(item.content).slice(0, 1000)}`)
    .join('\n\n===\n\n');

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
        max_tokens: 300,
        system: `${getSystemPrompt()}

INSTRUCCIONES CRÍTICAS:
- Solo puedes usar información de las FUENTES proporcionadas abajo
- Si la respuesta NO está en las fuentes, di "No tengo esa información" y sugiere contactar a Servicios Estudiantiles
- NUNCA inventes datos, fechas, costos, correos o procesos
- Cita la fuente cuando respondas (ej: "Según nuestra información sobre [tema]...")
- Responde en máximo 2-3 oraciones claras

${contextText}`,
        messages: [
          ...(req.history || []).slice(-4).map((h) => ({
            role: h.role,
            content: h.content.slice(0, 500),
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
    .replace(/^---[\s\S]*?---/m, '')        // Remove frontmatter
    .replace(/^#{1,6}\s+/gm, '')            // Remove heading markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // Bold → plain
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')  // Links → text (URL preserved)
    .replace(/^[-*]\s+/gm, '• ')            // Bullets
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
