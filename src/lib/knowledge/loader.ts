import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import type { ContentItem, ContentMeta, Category } from '@/types/content';

const CONTENT_DIR = path.join(process.cwd(), 'content');

// ── In-memory cache (avoids reading 481 files from disk on every call) ──
let cachedContent: ContentItem[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60_000; // 5 minutes

/**
 * Load all content items from MDX files (cached).
 */
export async function loadAllContent(): Promise<ContentItem[]> {
  if (cachedContent && Date.now() - cacheTime < CACHE_TTL) {
    return cachedContent;
  }

  const pattern = path.join(CONTENT_DIR, '**/*.mdx').replace(/\\/g, '/');
  const files = await glob(pattern);

  cachedContent = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      id: data.id || path.basename(filePath, '.mdx'),
      title: data.title || '',
      slug: data.slug || path.basename(filePath, '.mdx'),
      type: data.type || 'faq',
      category: data.category || 'general',
      tags: data.tags || [],
      audience: data.audience || 'student',
      locale: data.locale || 'es',
      priority: data.priority || 'medium',
      updatedAt: data.updatedAt || new Date().toISOString(),
      visibility: data.visibility || 'published',
      relatedSlugs: data.relatedSlugs || [],
      suggestedActions: data.suggestedActions || [],
      excerpt: data.excerpt || '',
      area: data.area || '',
      contactEmail: data.contactEmail || '',
      content,
    } satisfies ContentItem;
  });

  cacheTime = Date.now();
  return cachedContent;
}

export async function loadPublishedContent(): Promise<ContentItem[]> {
  const all = await loadAllContent();
  return all.filter((item) => item.visibility === 'published');
}

export function loadCategories(): Category[] {
  const filePath = path.join(CONTENT_DIR, 'categories.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Category[];
}

export async function getContentBySlug(slug: string): Promise<ContentItem | null> {
  const all = await loadPublishedContent();
  return all.find((item) => item.slug === slug) || null;
}

export async function getContentByCategory(category: string): Promise<ContentItem[]> {
  const all = await loadPublishedContent();
  return all.filter((item) => item.category === category);
}

export async function loadContentMeta(): Promise<ContentMeta[]> {
  const all = await loadPublishedContent();
  return all.map(({ content, htmlContent, ...meta }) => meta);
}
