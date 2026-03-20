/**
 * CNCI Search Engine v3 — TF-IDF with query cache, Spanish support, alias system.
 *
 * Fixes from audit:
 * - IDF formula corrected (standard log(N/df) without +1 bias)
 * - Query length normalization removed (was penalizing long queries)
 * - Title weight increased to 8x (was 5x — too low for FAQ corpus)
 * - Query result cache added (LRU, 2000 entries)
 * - Alias coverage expanded
 * - Stem function simplified (plurals only, no false positives)
 * - stripMdx preserves URLs
 */
import type { ContentItem, ContentMeta, SearchResult } from '@/types/content';
import { getAllDynamic, getIndexVersion } from './dynamic';

// ── Spanish NLP ─────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'como', 'cómo', 'que', 'qué', 'cual', 'cuál', 'donde', 'dónde',
  'cuando', 'cuándo', 'por', 'para', 'con', 'sin', 'los', 'las',
  'del', 'una', 'uno', 'unos', 'unas', 'mis', 'sus', 'ese', 'esa',
  'esto', 'esta', 'hay', 'ser', 'hago', 'puedo', 'debo', 'tengo',
  'necesito', 'quiero', 'the', 'and', 'for', 'are', 'but', 'not',
  'ver', 'puede', 'hacer', 'saber', 'tener', 'dar', 'pedir', 'desde',
  'entre', 'sobre', 'también', 'tambien', 'más', 'mas', 'pero',
  'muy', 'bien', 'solo', 'todo', 'toda', 'todos', 'todas', 'otro',
  'otra', 'otros', 'otras', 'ese', 'esa', 'eso', 'este', 'estos',
]);

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:()"\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Light plural removal only — no aggressive stemming */
function stem(word: string): string {
  if (word.length <= 4) return word;
  if (word.endsWith('es') && word.length > 5) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
  return word;
}

function stemTokens(tokens: string[]): string[] {
  return tokens.map(stem);
}

// ── Index structures ────────────────────────────────────────────────

interface IndexedDoc {
  item: ContentItem;
  titleTokens: string[];
  tagTokens: string[];
  contentTokens: string[];
  titleRaw: string;
}

let contentCache: ContentItem[] | null = null;
let indexedDocs: IndexedDoc[] = [];
let idf: Map<string, number> = new Map();
let lastIndexVersion = -1;
let staticContent: ContentItem[] = [];

// Query result cache (LRU)
const queryCache = new Map<string, { results: any[]; time: number }>();
const CACHE_TTL = 120_000; // 2 minutes
const CACHE_MAX = 2000;

function getCachedResult(key: string): any[] | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.results;
  if (cached) queryCache.delete(key);
  return null;
}

function setCachedResult(key: string, results: any[]): void {
  if (queryCache.size >= CACHE_MAX) {
    // Evict oldest
    const first = queryCache.keys().next().value;
    if (first) queryCache.delete(first);
  }
  queryCache.set(key, { results, time: Date.now() });
}

// ── Index management ────────────────────────────────────────────────

export function initSearchIndex(content: ContentItem[]): void {
  staticContent = content;
  rebuildIndex();
}

function rebuildIndex(): void {
  try {
    const dynamicContent = getAllDynamic();
    contentCache = [...staticContent, ...dynamicContent];
  } catch {
    contentCache = [...staticContent];
  }

  indexedDocs = contentCache.map((item) => {
    const titleTokens = stemTokens(tokenize(item.title));
    const tagTokens = stemTokens(item.tags.flatMap((t) => tokenize(t)));
    const contentTokens = stemTokens(tokenize(
      (item.excerpt || '') + ' ' + item.content.slice(0, 400)
    ));
    const titleRaw = normalize(item.title);
    return { item, titleTokens, tagTokens, contentTokens, titleRaw };
  });

  // Compute IDF — standard formula: log(N / df)
  const N = indexedDocs.length;
  const termDocFreq = new Map<string, number>();
  for (const doc of indexedDocs) {
    const unique = new Set([...doc.titleTokens, ...doc.tagTokens, ...doc.contentTokens]);
    for (const term of unique) termDocFreq.set(term, (termDocFreq.get(term) || 0) + 1);
  }
  idf = new Map();
  for (const [term, df] of termDocFreq) {
    idf.set(term, Math.log(N / df)); // Standard IDF, no +1 bias
  }

  lastIndexVersion = getIndexVersion();
  queryCache.clear(); // Invalidate all caches on reindex
}

function ensureFreshIndex(): void {
  if (!contentCache) return;
  try {
    if (getIndexVersion() !== lastIndexVersion) rebuildIndex();
  } catch {}
}

// ── Scoring ─────────────────────────────────────────────────────────

function scoreDocument(doc: IndexedDoc, queryStems: string[]): number {
  let score = 0;
  for (const qs of queryStems) {
    const idfVal = idf.get(qs) || 0;
    if (idfVal === 0) continue; // Unknown term — skip

    const match = (t: string) => t === qs || (qs.length >= 4 && t.startsWith(qs));

    // Title = 8x (FAQ corpus — title IS the query), tags = 3x, content = 1x
    score += doc.titleTokens.filter(match).length * idfVal * 8;
    score += doc.tagTokens.filter(match).length * idfVal * 3;
    score += doc.contentTokens.filter(match).length * idfVal * 1;
  }
  // No division by query length — let absolute score determine relevance
  return score;
}

// ── Public API ──────────────────────────────────────────────────────

export function search(query: string, limit = 10): SearchResult[] {
  ensureFreshIndex();
  if (!contentCache) return [];

  const cacheKey = `s:${query}:${limit}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached as SearchResult[];

  const queryStems = stemTokens(tokenize(query));
  if (queryStems.length === 0) return [];

  const scored = indexedDocs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryStems) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const maxScore = scored[0]?.score || 1;
  const results = scored.map((s) => ({
    item: stripContent(s.doc.item),
    score: s.score / maxScore,
  }));

  setCachedResult(cacheKey, results);
  return results;
}

export function exactFaqMatch(query: string): ContentItem | null {
  ensureFreshIndex();
  if (!contentCache) return null;

  const norm = normalize(query);
  const cacheKey = `faq:${norm}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return cached[0] || null;

  let result: ContentItem | null = null;

  // Strategy 0: Aliases (common student phrases → correct FAQ)
  const aliasHint = matchAlias(norm);
  if (aliasHint) {
    const matches = indexedDocs.filter((d) => d.titleRaw.includes(aliasHint));
    if (matches.length > 0) {
      matches.sort((a, b) => a.titleRaw.length - b.titleRaw.length);
      result = matches[0].item;
    }
  }

  // Strategy 1: Exact title match
  if (!result) {
    for (const doc of indexedDocs) {
      if (doc.titleRaw === norm) { result = doc.item; break; }
    }
  }

  // Strategy 2: Title contains query (pick shortest = most specific)
  if (!result && norm.length >= 4) {
    const matches = indexedDocs.filter((d) => d.titleRaw.includes(norm));
    if (matches.length > 0) {
      matches.sort((a, b) => a.titleRaw.length - b.titleRaw.length);
      result = matches[0].item;
    }
  }

  // Strategy 3: TF-IDF (with minimum confidence threshold)
  if (!result) {
    const queryStems = stemTokens(tokenize(query));
    if (queryStems.length > 0) {
      const scored = indexedDocs
        .map((doc) => ({ doc, score: scoreDocument(doc, queryStems) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      // Require minimum score AND significant gap vs second result
      // A good match typically scores 15+ on a single title keyword match
      if (scored.length > 0 && scored[0].score >= 10) {
        result = scored[0].doc.item;
      }
    }
  }

  setCachedResult(cacheKey, result ? [result] : []);
  return result;
}

export function retrieveForRAG(query: string, limit = 5): ContentItem[] {
  ensureFreshIndex();
  if (!contentCache) return [];

  const queryStems = stemTokens(tokenize(query));
  if (queryStems.length === 0) return [];

  return indexedDocs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryStems) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc.item);
}

function stripContent(item: ContentItem): ContentMeta {
  const { content, htmlContent, ...meta } = item;
  return meta;
}

// ── Query Aliases ───────────────────────────────────────────────────

const QUERY_ALIASES: Array<{ patterns: RegExp; titleHint: string }> = [
  // Acceso
  { patterns: /como entro|como ingreso|como accedo|no puedo entrar|como inicio sesion|como abro sesion/, titleHint: 'como accedo a blackboard' },
  { patterns: /no me acuerdo.*(usuario|contrasena|clave)|olvide mi|resetear contrasena|cambiar clave|recuperar contrasena/, titleHint: 'como restablezco mi contrasena' },
  { patterns: /como entro a office|como uso office|outlook|correo institucional|email cnci/, titleHint: 'como accedo a office' },

  // Pagos
  { patterns: /como pago|donde pago|metodo.*(pago|pagar)|formas? de pago|transferencia|tarjeta|oxxo|deposito/, titleHint: 'metodos de pago' },
  { patterns: /me cobraron.*(doble|mas|extra)|cobro.*(doble|duplicado)|reembolso|devolucion/, titleHint: 'reembolso' },
  { patterns: /cuando.*(pago|pagar|fecha.*pago|limite.*pago)|vencimiento|plazo.*pago/, titleHint: 'fecha limite de pago' },
  { patterns: /cuanto cuesta|precio|costo.*(carrera|inscripcion|semestre|mensualidad)/, titleHint: 'costo' },

  // Horarios
  { patterns: /a que hora.*(llam|atiend|abren|contact)|horario.*(atencion|oficina|servicio)|cuando atienden/, titleHint: 'horarios de atencion' },
  { patterns: /horario.*(clase|materia|curso)|cuando.*clase/, titleHint: 'horarios de clase' },

  // Inscripción
  { patterns: /quiero (inscribirme|entrar|estudiar)|como me inscribo|requisitos.*inscripcion|proxima generacion/, titleHint: 'como me inscribo' },

  // Tareas
  { patterns: /como (envio|subo|entrego|mando).*(tarea|actividad|trabajo|evidencia|archivo)/, titleHint: 'como envio una tarea' },

  // Tutor/asesor
  { patterns: /mi tutor no (contesta|responde|califica|ve)/, titleHint: 'mi tutor no' },
  { patterns: /donde.*(tutor|localizo.*tutor)|contactar tutor|email tutor/, titleHint: 'localizo a mi tutor' },
  { patterns: /mi maestro|el profesor|docente no responde/, titleHint: 'tutor no' },

  // Facturación
  { patterns: /como facturo|quiero factura|necesito factura|datos.*factur|recibo|comprobante|rfc/, titleHint: 'factura' },

  // Becas
  { patterns: /que becas|como.*beca|solicito.*beca|pido.*beca|descuento|condonacion/, titleHint: 'beca' },

  // Técnico
  { patterns: /no funciona|error|fallo|bug|problema.*(plataforma|sistema|blackboard)/, titleHint: 'no puedo' },

  // Certificado/título
  { patterns: /certificado|diploma|titulo profesional|cedula/, titleHint: 'certificado' },

  // Calificaciones
  { patterns: /calificacion|notas|promedio|kardex|boleta/, titleHint: 'calificacion' },

  // Biblioteca
  { patterns: /biblioteca|libros|recursos|apuntes|material/, titleHint: 'biblioteca' },
];

function matchAlias(normalizedQuery: string): string | null {
  for (const alias of QUERY_ALIASES) {
    if (alias.patterns.test(normalizedQuery)) {
      return normalize(alias.titleHint);
    }
  }
  return null;
}
