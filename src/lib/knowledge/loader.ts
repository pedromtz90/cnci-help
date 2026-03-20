import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';
import type { ContentItem, ContentMeta, Category } from '@/types/content';

const CONTENT_DIR = path.join(process.cwd(), 'content');

/**
 * Load all content items from MDX files.
 */
export async function loadAllContent(): Promise<ContentItem[]> {
  const pattern = path.join(CONTENT_DIR, '**/*.mdx').replace(/\\/g, '/');
  const files = await glob(pattern);

  return files.map((filePath) => {
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
}

/**
 * Load published content only.
 */
export async function loadPublishedContent(): Promise<ContentItem[]> {
  const all = await loadAllContent();
  return all.filter((item) => item.visibility === 'published');
}

/**
 * Load categories from JSON.
 */
export function loadCategories(): Category[] {
  const filePath = path.join(CONTENT_DIR, 'categories.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Category[];
}

/**
 * Get content by slug.
 */
export async function getContentBySlug(slug: string): Promise<ContentItem | null> {
  const all = await loadPublishedContent();
  return all.find((item) => item.slug === slug) || null;
}

/**
 * Get content by category.
 */
export async function getContentByCategory(category: string): Promise<ContentItem[]> {
  const all = await loadPublishedContent();
  return all.filter((item) => item.category === category);
}

/**
 * Get all published metadata (without body content — for search index).
 */
export async function loadContentMeta(): Promise<ContentMeta[]> {
  const all = await loadPublishedContent();
  return all.map(({ content, htmlContent, ...meta }) => meta);
}
