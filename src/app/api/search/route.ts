import { NextRequest, NextResponse } from 'next/server';
import { loadPublishedContent } from '@/lib/knowledge/loader';
import { initSearchIndex, search } from '@/lib/knowledge/search';
import { trackEvent } from '@/lib/analytics/service';
import { getDb } from '@/lib/db/database';

let indexedAt = 0;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const category = req.nextUrl.searchParams.get('category');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '10'), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Ensure index is fresh
  const now = Date.now();
  if (!indexedAt || (now - indexedAt > 5 * 60_000)) {
    try {
      getDb();
      const content = await loadPublishedContent();
      initSearchIndex(content);
      indexedAt = now;
    } catch (err) {
      console.error('Search index load failed:', err);
    }
  }

  let results = search(q, limit);
  if (category) results = results.filter((r) => r.item.category === category);

  // Track search for analytics
  try {
    getDb();
    trackEvent({ type: 'search', query: q, category: category || undefined });
  } catch {}

  return NextResponse.json({ results, query: q });
}
