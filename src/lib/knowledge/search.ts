import Fuse from 'fuse.js';
import type { ContentItem, ContentMeta, SearchResult } from '@/types/content';
import { getAllDynamic, getIndexVersion } from './dynamic';

let contentCache: ContentItem[] | null = null;
let titleFuse: Fuse<ContentItem> | null = null;   // Fuse on titles only (for chat)
let fullFuse: Fuse<ContentItem> | null = null;     // Fuse on all fields (for search page)
let lastIndexVersion = -1;

const STOPWORDS = new Set([
  'como', 'cómo', 'que', 'qué', 'cual', 'cuál', 'donde', 'dónde',
  'cuando', 'cuándo', 'por', 'para', 'con', 'sin', 'los', 'las',
  'del', 'una', 'uno', 'unos', 'unas', 'mis', 'sus', 'ese', 'esa',
  'esto', 'esta', 'hay', 'ser', 'hago', 'puedo', 'debo', 'tengo',
  'necesito', 'quiero', 'the', 'and', 'for', 'are', 'but', 'not',
  'ver', 'puede', 'hacer', 'saber', 'tener', 'dar', 'pedir',
]);

const noAccent = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  // Title-focused index for chatbot (high precision)
  titleFuse = new Fuse(contentCache, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'tags', weight: 0.3 },
    ],
    threshold: 0.5,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 2,
  });
  // Full content index for search page (high recall)
  fullFuse = new Fuse(contentCache, {
    keys: [
      { name: 'title', weight: 0.40 },
      { name: 'excerpt', weight: 0.25 },
      { name: 'tags', weight: 0.20 },
      { name: 'content', weight: 0.15 },
    ],
    threshold: 0.5,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,
  });
  lastIndexVersion = getIndexVersion();
}

function ensureFreshIndex(): void {
  if (!contentCache) return;
  try {
    const currentVersion = getIndexVersion();
    if (currentVersion !== lastIndexVersion) rebuildIndex();
  } catch {}
}

// ── Public search (for search page) ─────────────────────────────────

export function search(query: string, limit = 10): SearchResult[] {
  ensureFreshIndex();
  if (!fullFuse || !contentCache) return [];
  const results = fullFuse.search(query, { limit });
  return results.map((r) => ({
    item: stripContent(r.item),
    score: 1 - (r.score ?? 1),
    matches: r.matches?.map((m) => m.value || '').filter(Boolean),
  }));
}

// ── Chat FAQ match (for chatbot — title-focused, high precision) ────

export function exactFaqMatch(query: string): ContentItem | null {
  ensureFreshIndex();
  if (!contentCache || !titleFuse) return null;

  const normalized = query.toLowerCase().trim()
    .replace(/^[¿?¡!]+/, '').replace(/[?!]+$/, '').trim();
  const normNA = noAccent(normalized);

  // Strategy 1: Exact title match
  for (const item of contentCache) {
    const t = noAccent(item.title.toLowerCase()).replace(/^[¿?¡!]+/, '').replace(/[?!]+$/, '').trim();
    if (t === normNA) return item;
  }

  // Strategy 2: Title CONTAINS the query (for short queries like "quien es mi asesor")
  // Pick the shortest matching title (most specific)
  const containsMatches: Array<{ item: ContentItem; len: number }> = [];
  for (const item of contentCache) {
    const t = noAccent(item.title.toLowerCase()).replace(/^[¿?¡!]+/, '').replace(/[?!]+$/, '').trim();
    if (t.includes(normNA)) {
      containsMatches.push({ item, len: t.length });
    }
  }
  if (containsMatches.length > 0) {
    containsMatches.sort((a, b) => a.len - b.len);
    return containsMatches[0].item;
  }

  // Strategy 3: Title Fuse search (title + tags only, NOT content)
  const results = titleFuse.search(normalized, { limit: 5 });
  // Also try without accents
  const resultsNA = normNA !== normalized ? titleFuse.search(normNA, { limit: 5 }) : [];

  // Merge, dedupe, pick best
  const seen = new Set<string>();
  const all = [...results, ...resultsNA]
    .filter((r) => { if (seen.has(r.item.id)) return false; seen.add(r.item.id); return true; })
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1));

  if (all.length > 0 && (all[0].score ?? 1) < 0.6) {
    return all[0].item;
  }

  return null;
}

// ── RAG retrieval (for chatbot context when no exact match) ─────────

export function retrieveForRAG(query: string, limit = 5): ContentItem[] {
  ensureFreshIndex();
  if (!fullFuse || !contentCache) return [];
  const results = fullFuse.search(query, { limit });
  return results
    .filter((r) => (r.score ?? 1) < 0.65)
    .map((r) => r.item);
}

function stripContent(item: ContentItem): ContentMeta {
  const { content, htmlContent, ...meta } = item;
  return meta;
}
