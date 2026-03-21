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

    -- Workflows (editable from admin panel)
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      trigger_description TEXT NOT NULL DEFAULT '',
      trigger_keywords TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      steps TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default workflows if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM workflows').get() as any).c;
  if (count === 0) {
    const seed = db.prepare('INSERT OR IGNORE INTO workflows (id, name, description, trigger_description, trigger_keywords, steps) VALUES (?, ?, ?, ?, ?, ?)');
    seed.run('no-answer', 'Sin Respuesta → Escalar', 'Cuando el chatbot no puede resolver la pregunta del alumno, se registra la brecha, se crea un ticket y se escala a Nexus para que un asesor humano atienda.', 'El chatbot responde con fallback (confidence: low)', '', JSON.stringify([
      { id: 'record-gap', action: 'record-gap', label: 'Registrar brecha', description: 'Guarda la pregunta sin respuesta para que el equipo pueda entrenar al chatbot después.' },
      { id: 'create-ticket', action: 'create-ticket', label: 'Crear ticket automático', description: 'Crea un ticket con la pregunta y todo el contexto del chat para que soporte le dé seguimiento al alumno.', condition: 'Solo si tenemos el correo del alumno' },
      { id: 'escalate-nexus', action: 'escalate-nexus', label: 'Escalar a Nexus', description: 'Crea una conversación en Nexus con todo el historial del chat. El asesor ve todo el contexto y puede responder por WhatsApp.', condition: 'Solo si tenemos el correo del alumno' },
    ]));
    seed.run('payment', 'Intención de Pago', 'Cuando un alumno pregunta sobre pagos, costos, becas o facturación, se registra la intención para que el equipo pueda ver qué temas de pagos generan más consultas.', 'El mensaje contiene palabras como: pago, beca, factura, costo, mensualidad', 'pago,beca,factura,costo,mensualidad,descuento,cobro', JSON.stringify([
      { id: 'track-intent', action: 'track-event', label: 'Registrar consulta de pagos', description: 'Registra en las métricas que hubo una consulta relacionada con pagos. Esto ayuda a identificar los temas más frecuentes.' },
    ]));
    seed.run('enrollment', 'Intención de Inscripción', 'Cuando un alumno muestra interés en inscribirse, se registra como lead potencial y si tenemos sus datos, se crea un contacto en Nexus para que admisiones le dé seguimiento.', 'El mensaje contiene: inscribir, estudiar, registro, nuevo ingreso', 'inscri,registro,nuevo ingreso,quiero estudiar,me interesa', JSON.stringify([
      { id: 'track-intent', action: 'track-event', label: 'Registrar interés', description: 'Registra en las métricas que alguien preguntó sobre inscripción. Ayuda a medir la demanda.' },
      { id: 'create-lead', action: 'escalate-nexus', label: 'Crear lead en Nexus', description: 'Si tenemos los datos del alumno, se crea como contacto/lead en Nexus para que el equipo de admisiones le dé seguimiento.', condition: 'Solo si tenemos datos del alumno' },
    ]));
    seed.run('repeated-failure', 'Fallas Repetidas → Escalar Urgente', 'Si el chatbot falla 2 o más veces seguidas con el mismo alumno, se crea automáticamente un ticket de alta prioridad y se escala a Nexus como urgente.', 'Más de 2 fallbacks consecutivos del mismo alumno', '', JSON.stringify([
      { id: 'check-threshold', action: 'check-threshold', label: 'Verificar umbral', description: 'Revisa si ya van 2 o más intentos sin resolver. Si no llega al umbral, no hace nada.' },
      { id: 'create-ticket', action: 'create-ticket', label: 'Ticket de alta prioridad', description: 'Crea un ticket marcado como URGENTE para que soporte lo atienda primero.', condition: 'Si ya van 2+ fallas' },
      { id: 'escalate-nexus', action: 'escalate-nexus', label: 'Escalación urgente', description: 'Crea una conversación urgente en Nexus para atención inmediata.', condition: 'Si ya van 2+ fallas' },
    ]));
  }
}
