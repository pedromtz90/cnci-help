import type { ChatRequest, ChatResponse, ContentItem, SuggestedAction } from '@/types/content';
import { exactFaqMatch, retrieveForRAG, search } from '@/lib/knowledge/search';
import { trackEvent } from '@/lib/analytics/service';
import { flowPaymentQuestion, flowEnrollmentIntent, flowLowConfidence } from '@/lib/workflows/flows';
import { getDepartmentEmail, getConfig } from '@/lib/settings/service';
import { recordGap } from '@/lib/knowledge/gaps';

/** System prompt — loaded from settings DB so staff can edit it */
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
 * Main chat pipeline — 4 gates with LLM reranking.
 *
 * The key insight: TF-IDF is good at finding CANDIDATES but bad at picking
 * the RIGHT one. The LLM is good at understanding which FAQ actually answers
 * the question. So we use TF-IDF for retrieval and LLM for selection.
 *
 * Gate 1: Exact title match (0ms, free) — only for perfect matches
 * Gate 2: TF-IDF candidates → LLM rerank → return real FAQ content (300ms, cheap)
 * Gate 3: LLM synthesis when no good FAQ exists (500ms, normal cost)
 * Gate 4: Fallback with department suggestion
 */
export async function processChat(req: ChatRequest): Promise<ChatResponse> {
  const start = Date.now();
  const aiKey = getConfig('ai_api_key') || process.env.AI_API_KEY;

  // ── Gate 1: Exact title match (aliases + title contains) ──
  const faqMatch = exactFaqMatch(req.message);
  if (faqMatch) {
    // Verify it's a real match, not a false positive
    const titleWords = faqMatch.title.toLowerCase().split(/\s+/);
    const queryWords = req.message.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const overlap = queryWords.filter((qw) => titleWords.some((tw) => tw.includes(qw) || qw.includes(tw)));

    if (overlap.length >= Math.max(1, queryWords.length * 0.4)) {
      trackEvent({ type: 'chat', query: req.message, category: faqMatch.category, confidence: 'high', source: 'faq', resolved: true });
      return buildFaqResponse(faqMatch, start);
    }
    // Low overlap — don't trust the exact match, continue to Gate 2
  }

  // ── Gate 2: TF-IDF candidates + LLM reranking ──
  const candidates = retrieveForRAG(req.message, 5);

  if (candidates.length > 0 && aiKey) {
    // Use LLM to pick the BEST candidate (not to generate — to SELECT)
    const reranked = await rerankWithLLM(req.message, candidates, aiKey);

    if (reranked) {
      trackEvent({ type: 'chat', query: req.message, category: reranked.category, confidence: 'high', source: 'faq', resolved: true });
      return buildFaqResponse(reranked, start);
    }

    // LLM said none of the candidates match — go to synthesis
    const synthesized = await buildLLMResponse(req, candidates, start, aiKey);
    trackEvent({ type: 'chat', query: req.message, confidence: 'medium', source: 'llm', resolved: true });
    return synthesized;
  }

  // No AI key — return best TF-IDF result directly
  if (candidates.length > 0) {
    trackEvent({ type: 'chat', query: req.message, category: candidates[0].category, confidence: 'medium', source: 'retrieval', resolved: true });
    return buildFaqResponse(candidates[0], start);
  }

  // ── Gate 4: Fallback ──
  trackEvent({ type: 'chat', query: req.message, confidence: 'low', source: 'fallback', resolved: false });
  recordGap(req.message, 'low', 'fallback');
  triggerWorkflows(req);
  return buildFallbackResponse(req.message, start);
}

/**
 * LLM Reranker — asks the LLM which FAQ best answers the student's question.
 * Returns the selected FAQ (real content, no hallucination) or null if none match.
 *
 * This is the secret sauce: TF-IDF finds candidates, LLM picks the right one.
 * Cost: ~150 tokens input + ~20 tokens output = ~$0.00005 per query.
 */
async function rerankWithLLM(query: string, candidates: ContentItem[], apiKey: string): Promise<ContentItem | null> {
  const options = candidates.map((c, i) =>
    `${i + 1}. "${c.title}" — ${stripMdx(c.content).slice(0, 150)}`
  ).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: getConfig('ai_model') || process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        system: `Eres un clasificador. El alumno pregunta algo y tienes ${candidates.length} opciones de FAQ.
Responde SOLO con el número de la opción que MEJOR responde la pregunta del alumno.
Si NINGUNA opción es relevante, responde "0".
Solo responde el número, nada más.`,
        messages: [
          { role: 'user', content: `Pregunta del alumno: "${query}"\n\nOpciones:\n${options}` },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return candidates[0]; // Fallback to first candidate

    const data = await response.json();
    const text = (data.content?.[0]?.text || '').trim();
    const choice = parseInt(text);

    if (choice === 0 || isNaN(choice)) return null; // None match
    if (choice >= 1 && choice <= candidates.length) return candidates[choice - 1];
    return candidates[0]; // Invalid response, use first
  } catch {
    return candidates[0]; // On error, use first TF-IDF result
  }
}

// ── Response builders ───────────────────────────────────────────────

function buildFaqResponse(faq: ContentItem, start: number): ChatResponse {
  const stripped = stripMdx(faq.content);
  const content = stripped.length > 2000
    ? stripped.slice(0, 2000).replace(/[.!?]\s[^.!?]*$/, '.') + '\n\nConsulta el artículo completo para más información.'
    : stripped;

  return {
    content,
    sources: [{ title: faq.title, slug: faq.slug, type: faq.type, category: faq.category }],
    metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start },
    suggestedActions: faq.suggestedActions,
  };
}

async function buildLLMResponse(
  req: ChatRequest, context: ContentItem[], start: number, apiKey: string,
): Promise<ChatResponse> {
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
        model: getConfig('ai_model') || process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `${getSystemPrompt()}

INSTRUCCIONES CRÍTICAS:
- Solo puedes usar información de las FUENTES proporcionadas abajo
- Si la respuesta NO está en las fuentes, di "No tengo esa información" y sugiere contactar a Servicios Estudiantiles
- NUNCA inventes datos, fechas, costos, correos o procesos
- Responde en máximo 2-3 oraciones claras

${contextText}`,
        messages: [
          ...(req.history || []).slice(-4).map((h) => ({ role: h.role, content: h.content.slice(0, 500) })),
          { role: 'user', content: req.message },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return {
      content: text,
      sources: context.map((item) => ({ title: item.title, slug: item.slug, type: item.type, category: item.category })),
      metadata: { source: 'llm', confidence: 'medium', mode: req.mode, processingMs: Date.now() - start },
      suggestedActions: context[0]?.suggestedActions,
    };
  } catch {
    // LLM failed — return best candidate directly
    return buildFaqResponse(context[0], start);
  }
}

function buildFallbackResponse(message: string, start: number): ChatResponse {
  const dept = detectDepartment(message);
  return {
    content: `No encontré información sobre tu consulta en nuestra base de conocimientos.\n\nTe recomiendo contactar al área de ${dept.name} para orientación personalizada:\n📧 ${dept.email}`,
    sources: [],
    metadata: { source: 'fallback', confidence: 'low', mode: 'help', processingMs: Date.now() - start },
    suggestedActions: [
      { type: 'email', label: `Escribir a ${dept.name}`, href: `mailto:${dept.email}` },
      { type: 'ticket', label: 'Crear ticket de soporte' },
    ],
    escalationHint: dept.name,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function triggerWorkflows(req: ChatRequest): void {
  const msg = req.message.toLowerCase();
  const ctx = req.context || {};
  if (/pago|beca|factura|costo|mensualidad|descuento|cobro/.test(msg)) {
    flowPaymentQuestion({ question: req.message, studentName: ctx.studentName, studentEmail: ctx.studentEmail }).catch(() => {});
  }
  if (/inscri|registro|nuevo ingreso|quiero estudiar|me interesa|cómo entro/.test(msg)) {
    flowEnrollmentIntent({ question: req.message, studentName: ctx.studentName, studentEmail: ctx.studentEmail }).catch(() => {});
  }
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
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
