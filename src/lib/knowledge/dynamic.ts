/**
 * Dynamic Knowledge — FAQ content stored in SQLite.
 * Added via admin panel, available to chatbot instantly (no rebuild).
 * Complements the static MDX content.
 */
import { getDb } from '@/lib/db/database';
import type { ContentItem } from '@/types/content';

export interface KnowledgeRow {
  id: number;
  title: string;
  slug: string;
  type: string;
  category: string;
  tags: string;
  area: string;
  contact_email: string;
  priority: string;
  excerpt: string;
  content: string;
  video_url: string;
  image_url: string;
  visibility: string;
  created_at: string;
  updated_at: string;
}

function rowToContentItem(row: KnowledgeRow): ContentItem {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags); } catch { tags = []; }

  const actions: any[] = [];
  if (row.contact_email) {
    actions.push({ type: 'email', label: `Contactar ${row.area || 'soporte'}`, href: `mailto:${row.contact_email}` });
  }
  if (row.video_url) {
    actions.push({ type: 'link', label: 'Ver video', href: row.video_url });
  }

  return {
    id: `db-${row.id}`,
    title: row.title,
    slug: row.slug,
    type: row.type as any,
    category: row.category,
    tags,
    audience: 'student',
    locale: 'es',
    priority: row.priority as any,
    updatedAt: row.updated_at,
    visibility: row.visibility as any,
    excerpt: row.excerpt,
    area: row.area,
    contactEmail: row.contact_email,
    suggestedActions: actions,
    content: row.content,
  };
}

// ── CRUD ────────────────────────────────────────────────────────────

export function getAllDynamic(): ContentItem[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM knowledge_items WHERE visibility = 'published' ORDER BY updated_at DESC"
  ).all() as KnowledgeRow[];
  return rows.map(rowToContentItem);
}

export function getAllDynamicRaw(limit = 50, offset = 0): { items: KnowledgeRow[]; total: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM knowledge_items').get() as any).c;
  const items = db.prepare('SELECT id, title, slug, category, area, priority, visibility, excerpt, tags, updated_at FROM knowledge_items ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset) as KnowledgeRow[];
  return { items, total };
}

export function getDynamicById(id: number): KnowledgeRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id) as KnowledgeRow) || null;
}

export function searchDynamic(query: string): KnowledgeRow[] {
  const db = getDb();
  const q = `%${query}%`;
  return db.prepare(
    "SELECT * FROM knowledge_items WHERE visibility = 'published' AND (title LIKE ? OR content LIKE ? OR tags LIKE ? OR excerpt LIKE ?) ORDER BY updated_at DESC LIMIT 20"
  ).all(q, q, q, q) as KnowledgeRow[];
}

export interface CreateKnowledgeInput {
  title: string;
  category: string;
  tags?: string[];
  area?: string;
  contactEmail?: string;
  priority?: string;
  excerpt?: string;
  content: string;
  videoUrl?: string;
  imageUrl?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[¿?¡!]+/, '').replace(/[?!]+$/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
    .slice(0, 60);
}

export function createKnowledge(input: CreateKnowledgeInput): KnowledgeRow {
  const db = getDb();
  let slug = slugify(input.title);

  // Ensure unique slug
  const existing = db.prepare('SELECT id FROM knowledge_items WHERE slug = ?').get(slug);
  if (existing) slug = `${slug}-${Date.now() % 10000}`;

  const stmt = db.prepare(`
    INSERT INTO knowledge_items (title, slug, category, tags, area, contact_email, priority, excerpt, content, video_url, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.title, slug, input.category,
    JSON.stringify(input.tags || []),
    input.area || '', input.contactEmail || '',
    input.priority || 'medium',
    input.excerpt || input.content.slice(0, 250).replace(/\n/g, ' '),
    input.content,
    input.videoUrl || '', input.imageUrl || '',
  );

  return getDynamicById(result.lastInsertRowid as number)!;
}

export function updateKnowledge(id: number, input: Partial<CreateKnowledgeInput>): KnowledgeRow | null {
  const db = getDb();
  const existing = getDynamicById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) { fields.push('title = ?'); values.push(input.title); }
  if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category); }
  if (input.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(input.tags)); }
  if (input.area !== undefined) { fields.push('area = ?'); values.push(input.area); }
  if (input.contactEmail !== undefined) { fields.push('contact_email = ?'); values.push(input.contactEmail); }
  if (input.priority !== undefined) { fields.push('priority = ?'); values.push(input.priority); }
  if (input.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(input.excerpt); }
  if (input.content !== undefined) { fields.push('content = ?'); values.push(input.content); }
  if (input.videoUrl !== undefined) { fields.push('video_url = ?'); values.push(input.videoUrl); }
  if (input.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(input.imageUrl); }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE knowledge_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getDynamicById(id);
}

export function deleteKnowledge(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(id);
  return result.changes > 0;
}

export function toggleVisibility(id: number): KnowledgeRow | null {
  const db = getDb();
  const item = getDynamicById(id);
  if (!item) return null;
  const newVis = item.visibility === 'published' ? 'draft' : 'published';
  db.prepare("UPDATE knowledge_items SET visibility = ?, updated_at = datetime('now') WHERE id = ?").run(newVis, id);
  return getDynamicById(id);
}

export function bulkImport(items: CreateKnowledgeInput[]): { created: number; errors: number } {
  const db = getDb();
  let created = 0;
  let errors = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO knowledge_items (title, slug, category, tags, area, contact_email, priority, excerpt, content, video_url, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items: CreateKnowledgeInput[]) => {
    for (const item of items) {
      try {
        if (!item.title || !item.content) { errors++; continue; }
        let slug = slugify(item.title);
        const existing = db.prepare('SELECT id FROM knowledge_items WHERE slug = ?').get(slug);
        if (existing) slug = `${slug}-${Date.now() % 10000}-${created}`;

        insertStmt.run(
          item.title, slug, item.category || 'soporte',
          JSON.stringify(item.tags || []),
          item.area || '', item.contactEmail || '',
          item.priority || 'medium',
          item.excerpt || item.content.slice(0, 250).replace(/\n/g, ' '),
          item.content,
          item.videoUrl || '', item.imageUrl || '',
        );
        created++;
      } catch (err) { console.error('[dynamic] Failed to insert item:', err); errors++; }
    }
  });

  transaction(items);
  return { created, errors };
}

// ── Index version (increments on any change) ────────────────────────

let indexVersion = 0;
export function getIndexVersion(): number { return indexVersion; }
export function bumpIndexVersion(): void { indexVersion++; }
