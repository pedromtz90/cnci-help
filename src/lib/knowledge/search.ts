import Fuse from 'fuse.js';
import type { ContentItem, ContentMeta, SearchResult } from '@/types/content';
import { getAllDynamic, getIndexVersion } from './dynamic';

let fuseInstance: Fuse<ContentItem> | null = null;
let contentCache: ContentItem[] | null = null;
let lastIndexVersion = -1;

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.45 },
    { name: 'excerpt', weight: 0.25 },
    { name: 'tags', weight: 0.20 },
    { name: 'content', weight: 0.10 },
  ],
  threshold: 0.45,
  ignoreLocation: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};

const STOPWORDS = new Set([
  'como', 'cómo', 'que', 'qué', 'cual', 'cuál', 'donde', 'dónde',
  'cuando', 'cuándo', 'por', 'para', 'con', 'sin', 'los', 'las',
  'del', 'una', 'uno', 'unos', 'unas', 'mis', 'sus', 'ese', 'esa',
  'esto', 'esta', 'hay', 'ser', 'hago', 'puedo', 'debo', 'tengo',
  'necesito', 'quiero', 'the', 'and', 'for', 'are', 'but', 'not',
  'ver', 'puede', 'hacer', 'saber', 'tener', 'dar', 'pedir',
]);

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
  fuseInstance = new Fuse(contentCache, FUSE_OPTIONS);
  lastIndexVersion = getIndexVersion();
}

function ensureFreshIndex(): void {
  if (!contentCache) return;
  try {
    const currentVersion = getIndexVersion();
    if (currentVersion !== lastIndexVersion) rebuildIndex();
  } catch {}
}

export function search(query: string, limit = 10): SearchResult[] {
  ensureFreshIndex();
  if (!fuseInstance || !contentCache) return [];
  const results = fuseInstance.search(query, { limit });
  return results.map((r) => ({
    item: stripContent(r.item),
    score: 1 - (r.score ?? 1),
    matches: r.matches?.map((m) => m.value || '').filter(Boolean),
  }));
}

/**
 * Smart FAQ match for chatbot — returns best matching FAQ.
 *
 * Strategy order:
 * 1. Exact title match (highest confidence)
 * 2. Title contains all keywords (high confidence)
 * 3. Fuse.js best result (medium confidence — uses all fields with proper weighting)
 *
 * Key fix: never match on body content alone — prevents false positives
 * when a keyword appears in an unrelated FAQ's long answer text.
 */
export function exactFaqMatch(query: string): ContentItem | null {
  ensureFreshIndex();
  if (!contentCache || !fuseInstance) return null;

  const normalized = query.toLowerCase().trim()
    .replace(/^[¿?¡!]+/, '').replace(/[?!]+$/, '').trim();

  // Normalize accents for matching
  const noAccent = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normNoAccent = noAccent(normalized);

  // Strategy 1: Exact title match (with and without accents)
  for (const item of contentCache) {
    const titleNorm = item.title.toLowerCase().replace(/^[¿?¡!]+/, '').replace(/[?!]+$/, '').trim();
    if (titleNorm === normalized || noAccent(titleNorm) === normNoAccent) return item;
  }

  // Extract meaningful keywords
  const keywords = normalized.split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  if (keywords.length === 0) return null;

  // Strategy 2: Title-priority keyword scoring (for multi-word queries)
  if (keywords.length >= 2) {
    let bestMatch: ContentItem | null = null;
    let bestScore = 0;

    for (const item of contentCache) {
      const title = item.title.toLowerCase();
      const tags = item.tags.join(' ').toLowerCase();

      // Title matches worth 3x, tag matches worth 2x
      let score = 0;
      for (const kw of keywords) {
        if (title.includes(kw)) score += 3;
        else if (tags.includes(kw)) score += 2;
      }

      const maxPossible = keywords.length * 3;
      const pct = score / maxPossible;

      if (pct > bestScore && pct >= 0.4) {
        bestScore = pct;
        bestMatch = item;
      }
    }

    if (bestMatch && bestScore >= 0.5) return bestMatch;
  }

  // Strategy 2.5: For short queries where all keywords were stopwords,
  // try the original query against tags (accent-normalized)
  if (keywords.length === 0 && normalized.length >= 3) {
    for (const item of contentCache) {
      const titleNoAccent = noAccent(item.title.toLowerCase());
      if (titleNoAccent.includes(normNoAccent)) return item;
    }
  }

  // Strategy 3: Fuse.js — try both original query and accent-stripped version
  const fuseResults = fuseInstance.search(normalized, { limit: 3 });
  const fuseResultsNoAccent = normNoAccent !== normalized
    ? fuseInstance.search(normNoAccent, { limit: 3 })
    : [];

  // Merge and pick best
  const allFuse = [...fuseResults, ...fuseResultsNoAccent].sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
  if (allFuse.length > 0 && (allFuse[0].score ?? 1) < 0.55) {
    return allFuse[0].item;
  }

  return null;
}

/**
 * Retrieve relevant content for RAG context.
 * Uses Fuse.js primarily (better ranking than keyword scoring for retrieval).
 */
export function retrieveForRAG(query: string, limit = 5): ContentItem[] {
  ensureFreshIndex();
  if (!fuseInstance || !contentCache) return [];

  const results = fuseInstance.search(query, { limit });
  return results
    .filter((r) => (r.score ?? 1) < 0.65)
    .map((r) => r.item);
}

function stripContent(item: ContentItem): ContentMeta {
  const { content, htmlContent, ...meta } = item;
  return meta;
}
