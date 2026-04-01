import type { ChatRequest, ChatResponse, ContentItem, SuggestedAction } from '@/types/content';
import { retrieveForRAG } from '@/lib/knowledge/search';
import { trackEvent } from '@/lib/analytics/service';
import { getDepartmentEmail, getConfig } from '@/lib/settings/service';
import { recordGap } from '@/lib/knowledge/gaps';
import { runWorkflow } from '@/lib/workflows/mastra';
import { detectInjection } from '@/lib/security/injection-detector';
import { sendToNexusAgent, shouldRouteToNexus } from '@/lib/nexus/agent-tools';

/**
 * System prompt is configurable per deployment via the `chatbot_prompt` setting.
 * If not set, defaults to the CNCI prompt below.
 * This allows each tenant (PHS, CNCI, Sultana, etc.) to have their own Ana personality.
 */
const DEFAULT_SYSTEM_PROMPT = `Eres Ana, Ejecutiva de Servicios Estudiantiles de CNCI.
Tu objetivo es ayudar a los alumnos de forma clara, amable, resolutiva y con criterio propio.
Tuteas al alumno. Hablas como persona real, no como robot.

CAPACIDAD DE DECISIÓN:
Antes de responder, analiza:
1. ¿La respuesta está en las FUENTES? → Úsalas como prioridad
2. ¿Es parcial o no está clara? → Complementa con conocimiento general académico/administrativo
3. ¿No hay info interna suficiente? → Infiere una respuesta lógica basada en procesos educativos estándar, y aclara que puede variar
4. ¿Requiere info actualizada o específica? → Básate en info pública de CNCI o prácticas comunes
5. ¿No puedes resolver con certeza? → Ofrece levantar ticket o canalizar al área
NUNCA te detengas solo porque no hay coincidencia exacta. Tu prioridad es ayudar, orientar y resolver.

FORMA DE RESPONDER:
- Respuesta directa primero
- Explicación breve si aplica
- Pasos claros si aplica
- Sugerencia adicional o prevención de problemas
- Opción de ayuda extra
- Sé breve: 3-5 oraciones máximo a menos que haya pasos

CONOCIMIENTO ACADÉMICO:
Tienes criterio para responder sobre bachillerato, licenciaturas, maestrías, diplomados, modalidades (en línea, ejecutiva), procesos de inscripción, requisitos generales. Si no tienes el dato exacto, da respuesta aproximada + aclara que puede variar.

REGLAS CRÍTICAS:
1. NUNCA menciones, compares ni recomiendes otra universidad o institución que no sea CNCI. Si el alumno pregunta por otra escuela, redirige amablemente a lo que ofrece CNCI.
2. Nunca inventes datos específicos (costos exactos, fechas exactas, números de cuenta).
3. Pero TAMPOCO respondas "no tengo información". En su lugar: ofrece mejor aproximación, explica posibles escenarios, guía al alumno, o escala.

ESCALACIÓN:
Escala cuando: caso muy específico, temas administrativos individuales, el alumno ya intentó y no funcionó, hay frustración.
Cuando escales, usa frase natural: "te voy a comunicar con un asesor"

DEPARTAMENTOS:
- Servicios Estudiantiles: servicios@cncivirtual.mx
- Cobranza: cobranza@cncivirtual.mx
- Soporte Técnico: soporte@cncivirtual.mx
- Titulación: titulacion@cncivirtual.mx
- Tel: 800 681 5314 (opción 4 y 5)
- Oferta educativa: https://cnci.edu.mx/`;

function getSystemPrompt(): string {
  return getConfig('chatbot_prompt') || DEFAULT_SYSTEM_PROMPT;
}

const API_KEY = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

// ── Quick pattern handlers (no API call needed) ──────────────────

const ESCALATION_REQUEST = /quiero hablar|pasame con|comunic.*asesor|necesito.*humano|hablar.*persona|hablar.*asesor|quiero.*asesor|agente.*real|atencion.*personal|me comunicas|transfiere|pasame.*alguien|hablar.*alguien|operador/i;
const FRUSTRATION = /ya me hart[eé]|no sirve|esto es una|que mal|pesimo|p[eé]simo|ya no aguanto|llevo (horas|dias|rato|mucho)|estoy desesperado|nadie me ayuda|siempre lo mismo|no funciona nada|que coraje|que rabia|estoy molest|horrible|inutil|in[uú]til|es una burla|ya me cans[eé]|hartazgo|incompetent|no me resuelven|que asco/i;
const GREETING = /^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|que tal|q tal|k tal|holi|holaa+|hi|hello|ola|oye|disculpa|buen dia|buen día|saludos|que onda|qué onda|ke onda)\s*[.!?,]*$/i;
const THANKS = /^(gracias|muchas gracias|thanks|thx|grax|mil gracias|te agradezco|excelente gracias|ok gracias|vale gracias|perfecto gracias)\s*[.!?]*$/i;
const GOODBYE = /^(adios|adiós|bye|chao|hasta luego|nos vemos|me voy|eso es todo|era todo)\s*[.!?]*$/i;
const AFFIRMATIVE = /^(si|sí|ok|va|vale|claro|sale|órale|orale|listo|eso|ajá|aja|ya|entendido|perfecto|de acuerdo)\s*[.!?]*$/i;

const INJECTION_SAFE_REPLY =
  'Solo puedo ayudarte con temas relacionados a los servicios estudiantiles de CNCI.';

/**
 * Simplified pipeline:
 * 0. Injection detection (HIGH risk → safe fallback, no API)
 * 1. Quick patterns (greetings, escalation, frustration) → instant, no API
 * 2. TF-IDF finds relevant FAQs → send to Claude as context → one single API call
 * 3. Fallback if no API key or no candidates
 */
export async function processChat(req: ChatRequest): Promise<ChatResponse> {
  const start = Date.now();
  const trimmed = req.message.trim();
  const apiKey = getConfig('ai_api_key') || API_KEY;

  // ── Gate 0: Prompt injection detection ──
  const injection = detectInjection(trimmed);
  if (injection.riskLevel === 'high') {
    console.warn(
      `[cnci/injection] HIGH-RISK blocked categories=[${injection.matchedCategories.join(', ')}] ` +
        `message="${trimmed.slice(0, 60)}"`,
    );
    trackEvent({ type: 'chat', query: req.message, confidence: 'high', source: 'faq', resolved: true });
    return {
      content: INJECTION_SAFE_REPLY,
      sources: [],
      metadata: { source: 'faq', confidence: 'high', mode: req.mode, processingMs: Date.now() - start },
    };
  }
  if (injection.isSuspicious) {
    console.warn(
      `[cnci/injection] ${injection.riskLevel.toUpperCase()}-RISK flagged (continuing) ` +
        `categories=[${injection.matchedCategories.join(', ')}] message="${trimmed.slice(0, 60)}"`,
    );
  }

  // ── Quick patterns (instant, free) ──
  const quick = handleQuickPattern(trimmed, start);
  if (quick) {
    trackEvent({ type: 'chat', query: req.message, confidence: 'high', source: 'faq', resolved: true });
    return quick;
  }

  // ── Route to Nexus for service/support requests ──
  if (shouldRouteToNexus(trimmed)) {
    try {
      const nexusResult = await sendToNexusAgent({
        message: trimmed,
        customerName: req.context?.studentName,
        customerEmail: req.context?.studentEmail,
        channel: 'chat',
      });

      if (nexusResult.success && nexusResult.response) {
        trackEvent({ type: 'chat', query: req.message, confidence: 'high', source: 'nexus', resolved: true });
        return {
          content: nexusResult.response,
          sources: [],
          metadata: {
            source: 'nexus',
            confidence: 'high',
            mode: req.mode,
            processingMs: Date.now() - start,
            nexusIntent: nexusResult.intent,
            nexusData: nexusResult.data,
          },
        };
      }
    } catch (err) {
      console.error('[chat] Nexus routing failed, falling back to local:', err);
    }
  }

  // ── Retrieve relevant FAQs ──
  const candidates = retrieveForRAG(req.message, 5);

  // ── Single LLM call with FAQ context ──
  if (apiKey) {
    const contextText = candidates.length > 0
      ? candidates.map((c, i) => `[FUENTE ${i + 1}: ${c.title}]\n${stripMdx(c.content).slice(0, 800)}`).join('\n\n---\n\n')
      : 'No se encontraron fuentes relevantes en la base de conocimiento.';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: getConfig('ai_model') || AI_MODEL,
          max_tokens: 400,
          system: `${getSystemPrompt()}\n\nFUENTES DISPONIBLES:\n${contextText}`,
          messages: [
            ...(req.history || []).slice(-8).map((h) => ({ role: h.role, content: h.content.slice(0, 500) })),
            { role: 'user', content: req.message },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const text = (data.content?.[0]?.text || '').trim();

      if (text) {
        trackEvent({ type: 'chat', query: req.message, confidence: candidates.length > 0 ? 'high' : 'medium', source: 'llm', resolved: true });
        return {
          content: text,
          sources: candidates.slice(0, 2).map((c) => ({ title: c.title, slug: c.slug, type: c.type, category: c.category })),
          metadata: { source: 'llm', confidence: candidates.length > 0 ? 'high' : 'medium', mode: req.mode, processingMs: Date.now() - start },
          suggestedActions: candidates[0]?.suggestedActions,
        };
      }
    } catch (err) {
      console.error('[chat] LLM error:', err);
    }
  }

  // ── Fallback (no API key or API failed) ──
  if (candidates.length > 0) {
    const faq = candidates[0];
    trackEvent({ type: 'chat', query: req.message, category: faq.category, confidence: 'medium', source: 'retrieval', resolved: true });
    return {
      content: stripMdx(faq.content).slice(0, 1500),
      sources: [{ title: faq.title, slug: faq.slug, type: faq.type, category: faq.category }],
      metadata: { source: 'retrieval', confidence: 'medium', mode: 'help', processingMs: Date.now() - start },
      suggestedActions: faq.suggestedActions,
    };
  }

  trackEvent({ type: 'chat', query: req.message, confidence: 'low', source: 'fallback', resolved: false });
  recordGap(req.message, 'low', 'fallback');
  triggerWorkflows(req);
  return buildFallbackResponse(req.message, start);
}

// ── Quick pattern handler ────────────────────────────────────────

function handleQuickPattern(msg: string, start: number): ChatResponse | null {
  if (ESCALATION_REQUEST.test(msg)) {
    return {
      content: 'Claro, con gusto te comunico con un asesor para que te ayude personalmente. Solo necesito unos datos para transferir tu conversación completa.',
      sources: [],
      metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start },
      suggestedActions: [{ type: 'escalate', label: 'Hablar con un asesor' }],
      escalationHint: 'soporte',
    };
  }
  if (FRUSTRATION.test(msg)) {
    return {
      content: 'Entiendo tu frustración y lamento mucho la situación. ¿Te parece si te comunico con un asesor directamente? Ellos van a poder darte atención personalizada.',
      sources: [],
      metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start },
      suggestedActions: [
        { type: 'escalate', label: 'Hablar con un asesor' },
        { type: 'email', label: 'Escribir a Servicios', href: 'mailto:servicios@cncivirtual.mx' },
      ],
      escalationHint: 'soporte',
    };
  }
  if (GREETING.test(msg)) {
    return {
      content: '¡Hola! Soy Ana, tu asesora de Servicios Estudiantiles de CNCI. ¿En qué te puedo ayudar? Puedes preguntarme sobre trámites, pagos, plataformas, titulación o cualquier duda que tengas.',
      sources: [],
      metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start },
      suggestedActions: [
        { type: 'link', label: 'Trámites escolares', href: '/help/tramites' },
        { type: 'link', label: 'Pagos y cobranza', href: '/help/pagos' },
        { type: 'link', label: 'Soporte técnico', href: '/help/soporte' },
      ],
    };
  }
  if (THANKS.test(msg)) {
    return { content: '¡Con mucho gusto! Si te surge otra duda, aquí estoy para ayudarte. Que tengas un excelente día.', sources: [], metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start } };
  }
  if (GOODBYE.test(msg)) {
    return { content: '¡Hasta luego! Fue un gusto ayudarte. Recuerda que puedes regresar cuando necesites.', sources: [], metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start } };
  }
  if (AFFIRMATIVE.test(msg)) {
    return { content: '¡Perfecto! ¿Hay algo más en lo que te pueda ayudar?', sources: [], metadata: { source: 'faq', confidence: 'high', mode: 'help', processingMs: Date.now() - start } };
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────

function buildFallbackResponse(message: string, start: number): ChatResponse {
  const dept = detectDepartment(message);
  return {
    content: `No encontré información exacta sobre eso, pero no te preocupes. ¿Quieres que te comunique con un asesor de ${dept.name}? También puedes escribirles a ${dept.email}`,
    sources: [],
    metadata: { source: 'fallback', confidence: 'low', mode: 'help', processingMs: Date.now() - start },
    suggestedActions: [
      { type: 'escalate', label: 'Hablar con un asesor' },
      { type: 'email', label: `Escribir a ${dept.name}`, href: `mailto:${dept.email}` },
    ],
    escalationHint: dept.name,
  };
}

function triggerWorkflows(req: ChatRequest): void {
  const msg = req.message.toLowerCase();
  const ctx = req.context || {};
  const base = { question: req.message, studentName: ctx.studentName, studentEmail: ctx.studentEmail, phone: ctx.phone };
  if (/pago|beca|factura|costo|mensualidad|descuento|cobro/.test(msg)) runWorkflow('payment', base).catch((err) => console.error('[workflow:payment] Failed:', err.message));
  if (/inscri|registro|nuevo ingreso|quiero estudiar|me interesa/.test(msg)) runWorkflow('enrollment', base).catch((err) => console.error('[workflow:enrollment] Failed:', err.message));
  if (ctx.studentEmail) runWorkflow('no-answer', { ...base, chatHistory: req.history, category: 'soporte', confidence: 'low' }).catch((err) => console.error('[workflow:no-answer] Failed:', err.message));
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
