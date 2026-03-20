import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), 'data', 'cnci.db');

  // Ensure data directory exists
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Tickets
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      folio TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_email TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'open',
      assignee TEXT,
      department TEXT,
      related_articles TEXT,
      chat_context TEXT,
      tags TEXT,
      nexus_case_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_student ON tickets(student_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
    CREATE INDEX IF NOT EXISTS idx_tickets_folio ON tickets(folio);

    -- Ticket messages
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      author_type TEXT NOT NULL DEFAULT 'student',
      content TEXT NOT NULL,
      attachments TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages(ticket_id);

    -- Analytics events
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      query TEXT,
      category TEXT,
      slug TEXT,
      confidence TEXT,
      source TEXT,
      resolved INTEGER DEFAULT 0,
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(type);
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at);

    -- Dynamic knowledge base (added via admin, no rebuild needed)
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'faq',
      category TEXT NOT NULL DEFAULT 'soporte',
      tags TEXT DEFAULT '[]',
      area TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      excerpt TEXT DEFAULT '',
      content TEXT NOT NULL,
      video_url TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_visibility ON knowledge_items(visibility);
    CREATE INDEX IF NOT EXISTS idx_knowledge_slug ON knowledge_items(slug);

    -- Platform settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Unanswered questions (chatbot gaps — for training)
    CREATE TABLE IF NOT EXISTS unanswered (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'low',
      source TEXT NOT NULL DEFAULT 'fallback',
      matched_faq TEXT,
      times_asked INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_by TEXT,
      resolved_answer TEXT,
      knowledge_item_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_unanswered_status ON unanswered(status);
    CREATE INDEX IF NOT EXISTS idx_unanswered_times ON unanswered(times_asked DESC);

    -- Audit log (tracks all admin changes)
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);
  `);
}
