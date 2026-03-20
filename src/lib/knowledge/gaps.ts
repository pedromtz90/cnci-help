/**
 * Knowledge Gaps — tracks questions the chatbot couldn't answer.
 * Staff uses the training module to review these and teach the chatbot.
 */
import { getDb } from '@/lib/db/database';
import { createKnowledge, bumpIndexVersion } from './dynamic';

export interface UnansweredItem {
  id: number;
  query: string;
  confidence: string;
  source: string;
  matched_faq: string | null;
  times_asked: number;
  status: 'pending' | 'resolved' | 'ignored';
  resolved_by: string | null;
  resolved_answer: string | null;
  knowledge_item_id: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Record an unanswered or low-confidence question.
 * If same question was asked before, increment counter.
 */
export function recordGap(query: string, confidence: string, source: string, matchedFaq?: string): void {
  try {
    const db = getDb();
    const normalized = query.trim().toLowerCase().slice(0, 500);

    // Check if this question (or very similar) already exists
    const existing = db.prepare(
      "SELECT id, times_asked FROM unanswered WHERE LOWER(query) = ? AND status = 'pending'"
    ).get(normalized) as any;

    if (existing) {
      db.prepare(
        "UPDATE unanswered SET times_asked = times_asked + 1, updated_at = datetime('now') WHERE id = ?"
      ).run(existing.id);
    } else {
      db.prepare(
        "INSERT INTO unanswered (query, confidence, source, matched_faq) VALUES (?, ?, ?, ?)"
      ).run(normalized, confidence, source, matchedFaq || null);
    }
  } catch (e) {
    console.error('Failed to record gap:', e);
  }
}

/**
 * Get all pending gaps, sorted by most asked.
 */
export function getPendingGaps(limit = 100, offset = 0): { items: UnansweredItem[]; total: number } {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as c FROM unanswered WHERE status = 'pending'").get() as any).c;
  const items = db.prepare(
    "SELECT * FROM unanswered WHERE status = 'pending' ORDER BY times_asked DESC, updated_at DESC LIMIT ? OFFSET ?"
  ).all(limit, offset) as UnansweredItem[];
  return { items, total };
}

/**
 * Get all gaps regardless of status.
 */
export function getAllGaps(status?: string): UnansweredItem[] {
  const db = getDb();
  if (status) {
    return db.prepare('SELECT * FROM unanswered WHERE status = ? ORDER BY times_asked DESC').all(status) as UnansweredItem[];
  }
  return db.prepare('SELECT * FROM unanswered ORDER BY times_asked DESC').all() as UnansweredItem[];
}

/**
 * Resolve a gap by creating a new knowledge item — teaches the chatbot.
 */
export function resolveGap(id: number, answer: string, category: string, actor: string): UnansweredItem | null {
  const db = getDb();
  const gap = db.prepare('SELECT * FROM unanswered WHERE id = ?').get(id) as UnansweredItem | undefined;
  if (!gap) return null;

  // Create knowledge item so chatbot can answer this next time
  const item = createKnowledge({
    title: gap.query.charAt(0).toUpperCase() + gap.query.slice(1) + (gap.query.endsWith('?') ? '' : ''),
    content: answer,
    category,
    tags: extractTags(gap.query),
    area: '',
    priority: gap.times_asked >= 5 ? 'high' : 'medium',
  });

  bumpIndexVersion();

  // Mark as resolved
  db.prepare(
    "UPDATE unanswered SET status = 'resolved', resolved_by = ?, resolved_answer = ?, knowledge_item_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(actor, answer.slice(0, 500), item.id, id);

  return db.prepare('SELECT * FROM unanswered WHERE id = ?').get(id) as UnansweredItem;
}

/**
 * Ignore a gap (not relevant, spam, etc.)
 */
export function ignoreGap(id: number): void {
  const db = getDb();
  db.prepare("UPDATE unanswered SET status = 'ignored', updated_at = datetime('now') WHERE id = ?").run(id);
}

function extractTags(query: string): string[] {
  const tags: string[] = [];
  const q = query.toLowerCase();
  const map: Record<string, string[]> = {
    blackboard: ['blackboard', 'plataforma', 'aula'],
    pagos: ['pago', 'pagar', 'mensualidad', 'costo'],
    inscripcion: ['inscri', 'registro', 'matrícula'],
    tramites: ['constancia', 'certificado', 'trámite', 'credencial'],
    titulacion: ['título', 'titulación', 'tesis'],
    calificaciones: ['calificación', 'nota', 'kardex'],
    soporte: ['error', 'problema', 'no funciona', 'contraseña'],
  };
  for (const [tag, keywords] of Object.entries(map)) {
    if (keywords.some((kw) => q.includes(kw))) tags.push(tag);
  }
  return tags.length > 0 ? tags : ['general'];
}
