import Fuse from 'fuse.js';
import type { ContentItem, ContentMeta, SearchResult } from '@/types/content';

let fuseInstance: Fuse<ContentItem> | null = null;
let contentCache: ContentItem[] | null = null;

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.35 },
    { name: 'excerpt', weight: 0.25 },
    { name: 'tags', weight: 0.25 },
    { name: 'content', weight: 0.15 },
  ],
  threshold: 0.5,
  ignoreLocation: true,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};

// Common Spanish stopwords to filter out
const STOPWORDS = new Set([
  'como', 'cómo', 'que', 'qué', 'cual', 'cuál', 'donde', 'dónde',
  'cuando', 'cuándo', 'por', 'para', 'con', 'sin', 'los', 'las',
  'del', 'una', 'uno', 'unos', 'unas', 'mis', 'sus', 'ese', 'esa',
  'esto', 'esta', 'hay', 'ser', 'hago', 'puedo', 'debo', 'tengo',
  'necesito', 'quiero', 'the', 'and', 'for', 'are', 'but', 'not',
]);

export function initSearchIndex(content: ContentItem[]): void {
  contentCache = content;
  fuseInstance = new Fuse(content, FUSE_OPTIONS);
}

export function search(query: string, limit = 10): SearchResult[] {
  if (!fuseInstance || !contentCache) return [];
  const results = fuseInstance.search(query, { limit });
  return results.map((r) => ({
    item: stripContent(r.item),
    score: 1 - (r.score ?? 1),
    matches: r.matches?.map((m) => m.value || '').filter(Boolean),
  }));
}

/**
 * Smart FAQ match — multi-strategy matching for chatbot.
 * 1. Exact title match
 * 2. Keyword match against title + excerpt + tags
 * 3. Fuse.js fuzzy with generous threshold
 */
export function exactFaqMatch(query: string): ContentItem | null {
  if (!contentCache) return null;

  const normalized = query.toLowerCase().trim()
    .replace(/^[¿?]+/, '').replace(/[?]+$/, '').trim();

  // Strategy 1: Exact title match
  const exact = contentCache.find((item) =>
    item.title.toLowerCase().replace(/^[¿?]+/, '').replace(/[?]+$/, '').trim() === normalized,
  );
  if (exact) return exact;

  // Strategy 2: Keyword scoring against title + excerpt + tags
  const keywords = normalized.split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  if (keywords.length >= 1) {
    let bestMatch: ContentItem | null = null;
    let bestScore = 0;

    for (const item of contentCache) {
      const searchable = [
        item.title.toLowerCase(),
        (item.excerpt || '').toLowerCase(),
        item.tags.join(' ').toLowerCase(),
      ].join(' ');

      let score = 0;
      for (const kw of keywords) {
        if (searchable.includes(kw)) score += 1;
      }

      // Normalize to 0-1
      const normalizedScore = score / keywords.length;

      if (normalizedScore > 0.5 && normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = item;
      }
    }

    if (bestMatch && bestScore >= 0.6) return bestMatch;
  }

  // Strategy 3: Fuse.js top result if very good score
  if (fuseInstance) {
    const fuseResults = fuseInstance.search(normalized, { limit: 1 });
    if (fuseResults.length > 0 && (fuseResults[0].score ?? 1) < 0.3) {
      return fuseResults[0].item;
    }
  }

  return null;
}

/**
 * Retrieve content relevant to a query — for RAG context.
 * More generous than exactFaqMatch — returns multiple items.
 */
export function retrieveForRAG(query: string, limit = 5): ContentItem[] {
  if (!contentCache) return [];

  // First try keyword-based retrieval
  const normalized = query.toLowerCase().trim()
    .replace(/^[¿?]+/, '').replace(/[?]+$/, '').trim();

  const keywords = normalized.split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  if (keywords.length >= 1) {
    const scored = contentCache.map((item) => {
      const searchable = [
        item.title.toLowerCase(),
        (item.excerpt || '').toLowerCase(),
        item.tags.join(' ').toLowerCase(),
        item.content.toLowerCase().slice(0, 500),
      ].join(' ');

      let score = 0;
      for (const kw of keywords) {
        if (searchable.includes(kw)) score += 1;
      }
      return { item, score: score / keywords.length };
    });

    const matches = scored
      .filter((s) => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);

    if (matches.length > 0) return matches;
  }

  // Fallback to Fuse.js
  if (fuseInstance) {
    const results = fuseInstance.search(query, { limit });
    return results
      .filter((r) => (r.score ?? 1) < 0.7)
      .map((r) => r.item);
  }

  return [];
}

function stripContent(item: ContentItem): ContentMeta {
  const { content, htmlContent, ...meta } = item;
  return meta;
}
