import Fuse from 'fuse.js';
import type { ContentItem, ContentMeta, SearchResult } from '@/types/content';

let fuseInstance: Fuse<ContentItem> | null = null;
let contentCache: ContentItem[] | null = null;

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'excerpt', weight: 0.25 },
    { name: 'tags', weight: 0.2 },
    { name: 'content', weight: 0.15 },
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};

/**
 * Initialize search index with content.
 */
export function initSearchIndex(content: ContentItem[]): void {
  contentCache = content;
  fuseInstance = new Fuse(content, FUSE_OPTIONS);
}

/**
 * Full-text fuzzy search.
 */
export function search(query: string, limit = 10): SearchResult[] {
  if (!fuseInstance || !contentCache) return [];

  const results = fuseInstance.search(query, { limit });

  return results.map((r) => ({
    item: stripContent(r.item),
    score: 1 - (r.score ?? 1), // Convert to 0-1 where 1 is best
    matches: r.matches?.map((m) => m.value || '').filter(Boolean),
  }));
}

/**
 * Exact FAQ match — for chatbot fast path.
 */
export function exactFaqMatch(query: string): ContentItem | null {
  if (!contentCache) return null;

  const normalized = query.toLowerCase().trim()
    .replace(/^¿+/, '')
    .replace(/\?+$/, '')
    .trim();

  // Try exact title match first
  const exact = contentCache.find((item) =>
    item.title.toLowerCase()
      .replace(/^¿+/, '')
      .replace(/\?+$/, '')
      .trim() === normalized,
  );
  if (exact) return exact;

  // Try high-confidence keyword match
  const keywords = normalized.split(/\s+/).filter((w) => w.length > 2);
  if (keywords.length < 2) return null;

  let bestMatch: ContentItem | null = null;
  let bestScore = 0;

  for (const item of contentCache) {
    const titleLower = item.title.toLowerCase();
    const matchCount = keywords.filter((kw) => titleLower.includes(kw)).length;
    const score = matchCount / keywords.length;

    if (score > 0.7 && score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

/**
 * Retrieve content relevant to a query — for RAG context.
 */
export function retrieveForRAG(query: string, limit = 5): ContentItem[] {
  if (!fuseInstance || !contentCache) return [];

  const results = fuseInstance.search(query, { limit });
  return results
    .filter((r) => (r.score ?? 1) < 0.6)
    .map((r) => r.item);
}

function stripContent(item: ContentItem): ContentMeta {
  const { content, htmlContent, ...meta } = item;
  return meta;
}
