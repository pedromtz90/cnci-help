import { NextRequest, NextResponse } from 'next/server';
import { loadPublishedContent } from '@/lib/knowledge/loader';
import { initSearchIndex, search } from '@/lib/knowledge/search';

let indexed = false;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const category = req.nextUrl.searchParams.get('category');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (!indexed) {
    const content = await loadPublishedContent();
    initSearchIndex(content);
    indexed = true;
  }

  let results = search(q, limit);

  if (category) {
    results = results.filter((r) => r.item.category === category);
  }

  return NextResponse.json({ results, query: q });
}
