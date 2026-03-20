/**
 * CNCI Search Engine — TF-IDF based search with Spanish language support.
 *
 * Why not Fuse.js: Fuse is fuzzy string matching, not information retrieval.
 * With 481+ FAQs, it returns wrong results because it matches character patterns
 * instead of semantic relevance. TF-IDF ranks by how important a word is
 * to a specific document vs the entire corpus — which is what we need.
 */
import type { ContentItem, ContentMeta, SearchResult } from '@/types/content';
import { getAllDynamic, getIndexVersion } from './dynamic';

// ── Spanish NLP helpers ─────────────────────────────────────────────

const STOPWORDS = new Set([
  'como', 'cómo', 'que', 'qué', 'cual', 'cuál', 'donde', 'dónde',
  'cuando', 'cuándo', 'por', 'para', 'con', 'sin', 'los', 'las',
  'del', 'una', 'uno', 'unos', 'unas', 'mis', 'sus', 'ese', 'esa',
  'esto', 'esta', 'hay', 'ser', 'hago', 'puedo', 'debo', 'tengo',
  'necesito', 'quiero', 'and', 'for', 'are', 'but', 'not', 'the',
  'ver', 'puede', 'hacer', 'saber', 'tener', 'dar', 'pedir', 'desde',
  'entre', 'sobre', 'también', 'tambien', 'más', 'mas', 'pero',
  'muy', 'bien', 'solo', 'todo', 'toda', 'todos', 'todas', 'otro',
  'otra', 'otros', 'otras', 'ese', 'esa', 'eso', 'este', 'estos',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[¿?¡!.,;:()"\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Light normalizer — only removes plurals. No aggressive stemming. */
function stem(word: string): string {
  if (word.length <= 3) return word;
  // Only remove simple plurals — nothing else
  if (word.endsWith('es') && word.length > 5) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 4 && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function stemTokens(tokens: string[]): string[] {
  return tokens.map(stem);
}

// ── TF-IDF Index ────────────────────────────────────────────────────

interface IndexedDoc {
  item: ContentItem;
  titleTokens: string[];
  tagTokens: string[];
  contentTokens: string[];
  allTokens: string[];
  titleRaw: string; // normalized, no accent, for contains-match
}

let contentCache: ContentItem[] | null = null;
let indexedDocs: IndexedDoc[] = [];
let idf: Map<string, number> = new Map();
let lastIndexVersion = -1;
let staticContent: ContentItem[] = [];

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

  // Build indexed documents
  indexedDocs = contentCache.map((item) => {
    const titleTokens = stemTokens(tokenize(item.title));
    const tagTokens = stemTokens(item.tags.flatMap((t) => tokenize(t)));
    const contentTokens = stemTokens(tokenize(
      (item.excerpt || '') + ' ' + item.content.slice(0, 300)
    ));
    const allTokens = [...titleTokens, ...tagTokens, ...contentTokens];
    const titleRaw = normalize(item.title);

    return { item, titleTokens, tagTokens, contentTokens, allTokens, titleRaw };
  });

  // Compute IDF (inverse document frequency)
  const docCount = indexedDocs.length;
  const termDocFreq = new Map<string, number>();

  for (const doc of indexedDocs) {
    const uniqueTerms = new Set(doc.allTokens);
    for (const term of uniqueTerms) {
      termDocFreq.set(term, (termDocFreq.get(term) || 0) + 1);
    }
  }

  idf = new Map();
  for (const [term, df] of termDocFreq) {
    idf.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
  }

  lastIndexVersion = getIndexVersion();
}

function ensureFreshIndex(): void {
  if (!contentCache) return;
  try {
    const currentVersion = getIndexVersion();
    if (currentVersion !== lastIndexVersion) rebuildIndex();
  } catch {}
}

/**
 * Score a document against a query using weighted TF-IDF.
 * Title matches are worth 5x, tag matches 3x, content matches 1x.
 */
function scoreDocument(doc: IndexedDoc, queryStems: string[]): number {
  let score = 0;

  for (const qs of queryStems) {
    const idfScore = idf.get(qs) || 1;

    // Match: exact word or word starts with query term (min 4 chars to avoid false positives)
    const matches = (t: string) => t === qs || (qs.length >= 4 && t.startsWith(qs));

    // Title match (highest weight)
    const titleTF = doc.titleTokens.filter(matches).length;
    score += titleTF * idfScore * 5;

    // Tag match
    const tagTF = doc.tagTokens.filter(matches).length;
    score += tagTF * idfScore * 3;

    // Content match
    const contentTF = doc.contentTokens.filter(matches).length;
    score += contentTF * idfScore * 1;
  }

  // Normalize by query length to make scores comparable
  return queryStems.length > 0 ? score / queryStems.length : 0;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Search for content (used by search page and API).
 */
export function search(query: string, limit = 10): SearchResult[] {
  ensureFreshIndex();
  if (!contentCache) return [];

  const queryStems = stemTokens(tokenize(query));
  if (queryStems.length === 0) return [];

  const scored = indexedDocs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryStems) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const maxScore = scored[0]?.score || 1;

  return scored.map((s) => ({
    item: stripContent(s.doc.item),
    score: s.score / maxScore, // Normalize to 0-1
  }));
}

/**
 * Find best matching FAQ for chatbot.
 * Strategy:
 * 1. Exact title match
 * 2. Title contains query
 * 3. TF-IDF ranked search (title-weighted)
 */
export function exactFaqMatch(query: string): ContentItem | null {
  ensureFreshIndex();
  if (!contentCache) return null;

  const norm = normalize(query);

  // Strategy 0: Query aliases — common student phrases mapped to correct topics
  const aliasMatch = matchAlias(norm);
  if (aliasMatch) {
    for (const doc of indexedDocs) {
      if (doc.titleRaw.includes(aliasMatch)) return doc.item;
    }
  }

  // Strategy 1: Exact title match
  for (const doc of indexedDocs) {
    if (doc.titleRaw === norm) return doc.item;
  }

  // Strategy 2: Title contains query (shortest = most specific)
  if (norm.length >= 4) {
    const matches: IndexedDoc[] = [];
    for (const doc of indexedDocs) {
      if (doc.titleRaw.includes(norm)) {
        matches.push(doc);
      }
    }
    if (matches.length > 0) {
      matches.sort((a, b) => a.titleRaw.length - b.titleRaw.length);
      return matches[0].item;
    }
  }

  // Strategy 3: TF-IDF search
  const queryStems = stemTokens(tokenize(query));
  if (queryStems.length === 0) return null;

  const scored = indexedDocs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryStems) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  // Only return if score is significantly above the second result (confidence)
  const best = scored[0];
  const second = scored[1];
  const minScore = 2; // minimum absolute score to consider a match

  if (best.score < minScore) return null;

  return best.doc.item;
}

/**
 * Retrieve context for RAG.
 */
export function retrieveForRAG(query: string, limit = 5): ContentItem[] {
  ensureFreshIndex();
  if (!contentCache) return [];

  const queryStems = stemTokens(tokenize(query));
  if (queryStems.length === 0) return [];

  return indexedDocs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryStems) }))
    .filter((s) => s.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc.item);
}

function stripContent(item: ContentItem): ContentMeta {
  const { content, htmlContent, ...meta } = item;
  return meta;
}

/**
 * Query aliases — maps common student phrases to the right FAQ title keyword.
 * This handles cases where TF-IDF fails due to word ambiguity.
 */
const QUERY_ALIASES: Array<{ patterns: RegExp; titleHint: string }> = [
  // Acceso a plataformas
  { patterns: /como entro|como ingreso|como accedo|no puedo entrar|como inicio sesion/, titleHint: 'como accedo a blackboard' },
  { patterns: /no me acuerdo.*(usuario|contrasena|clave|password)|olvide mi (usuario|contrasena|clave)/, titleHint: 'como restablezco mi contrasena' },
  { patterns: /como entro a office|como uso office/, titleHint: 'como accedo a office' },

  // Pagos
  { patterns: /como pago|donde pago|metodo.*(pago|pagar)|formas? de pago/, titleHint: 'metodos de pago' },
  { patterns: /me cobraron.*(doble|mas|extra)|cobro.*(doble|duplicado)|pague.*doble/, titleHint: 'pago' },
  { patterns: /cuando.*(pago|pagar|fecha.*pago|limite.*pago)/, titleHint: 'fecha limite de pago' },

  // Horarios
  { patterns: /a que hora.*(llam|atiend|abren|contact)|horario.*(atencion|oficina|servicio)/, titleHint: 'horarios de atencion' },

  // Inscripción
  { patterns: /quiero (inscribirme|entrar|estudiar)|como me inscribo|requisitos.*inscripcion/, titleHint: 'como me inscribo' },

  // Enviar tarea
  { patterns: /como (envio|subo|entrego|mando).*tarea/, titleHint: 'como envio una tarea' },

  // Tutor/asesor
  { patterns: /mi tutor no (contesta|responde|califica)/, titleHint: 'mi tutor no' },
  { patterns: /donde.*(tutor|localizo.*tutor)/, titleHint: 'localizo a mi tutor' },

  // Facturación
  { patterns: /como facturo|quiero factura|necesito factura|datos.*factur/, titleHint: 'factura' },

  // Becas
  { patterns: /que becas|como.*beca|solicito.*beca|pido.*beca/, titleHint: 'beca' },
];

function matchAlias(normalizedQuery: string): string | null {
  for (const alias of QUERY_ALIASES) {
    if (alias.patterns.test(normalizedQuery)) {
      return normalize(alias.titleHint);
    }
  }
  return null;
}
