/**
 * Settings Service — Persistent config in SQLite.
 * Secrets are obfuscated at rest (base64 — not crypto-grade, but prevents casual reading).
 * All changes are audit-logged.
 */
import { getDb } from '@/lib/db/database';
import { createHash } from 'crypto';

const SECRET_KEYS = new Set([
  'azure_ad_client_secret', 'smtp_pass', 'nexus_api_key', 'ai_api_key',
]);

function encode(key: string, value: string): string {
  if (!value || !SECRET_KEYS.has(key)) return value;
  return 'enc:' + Buffer.from(value).toString('base64');
}

function decode(key: string, value: string): string {
  if (!value || !SECRET_KEYS.has(key) || !value.startsWith('enc:')) return value;
  return Buffer.from(value.slice(4), 'base64').toString('utf-8');
}

// ── Read/Write ──────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  if (!row?.value) return null;
  return decode(key, row.value);
}

export function setSetting(key: string, value: string, actor?: string): void {
  const db = getDb();
  const oldValue = getSetting(key);
  const encoded = encode(key, value);
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
  `).run(key, encoded, encoded);

  // Audit log
  if (actor) {
    logAudit(actor, 'update_setting', 'setting', key,
      SECRET_KEYS.has(key) ? '****' : (oldValue || ''),
      SECRET_KEYS.has(key) ? '****' : value,
    );
  }
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = decode(row.key, row.value);
  return result;
}

export function getConfig(key: string): string {
  return getSetting(key) || process.env[key] || '';
}

// ── Settings groups ─────────────────────────────────────────────────

export interface PlatformSettings {
  azure_ad_client_id: string;
  azure_ad_client_secret: string;
  azure_ad_tenant_id: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  nexus_api_url: string;
  nexus_api_key: string;
  ai_api_key: string;
  ai_model: string;
  staff_emails: string;
  director_emails: string;
  institution_name: string;
  support_phone: string;
  department_emails: string; // JSON map of department → email
}

const DEFAULTS: PlatformSettings = {
  azure_ad_client_id: '',
  azure_ad_client_secret: '',
  azure_ad_tenant_id: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: 'soporte@cncivirtual.mx',
  nexus_api_url: '',
  nexus_api_key: '',
  ai_api_key: '',
  ai_model: 'claude-haiku-4-5-20251001',
  staff_emails: 'admin@cncivirtual.mx,soporte@cncivirtual.mx,servicios@cncivirtual.mx,cobranza@cncivirtual.mx,titulacion@cncivirtual.mx',
  director_emails: 'brenda@cncivirtual.mx,director@cncivirtual.mx',
  institution_name: 'Universidad Virtual CNCI',
  support_phone: '800 681 5314',
  department_emails: JSON.stringify({
    plataformas: 'soporte@cncivirtual.mx',
    pagos: 'cobranza@cncivirtual.mx',
    inscripcion: 'servicios@cncivirtual.mx',
    tramites: 'servicios@cncivirtual.mx',
    titulacion: 'titulacion@cncivirtual.mx',
    soporte: 'soporte@cncivirtual.mx',
    academico: 'servicios@cncivirtual.mx',
    contacto: 'servicios@cncivirtual.mx',
  }),
};

export function getPlatformSettings(): PlatformSettings {
  const all = getAllSettings();
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof PlatformSettings)[]) {
    if (all[key]) result[key] = all[key];
  }
  return result;
}

export function savePlatformSettings(settings: Partial<PlatformSettings>, actor?: string): void {
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined && value !== null) {
      setSetting(key, value, actor);
    }
  }
}

// ── Role helpers ────────────────────────────────────────────────────

export function getStaffEmails(): Set<string> {
  const raw = getSetting('staff_emails') || DEFAULTS.staff_emails;
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function getDirectorEmails(): Set<string> {
  const raw = getSetting('director_emails') || DEFAULTS.director_emails;
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

// ── Department emails (used by chat engine and workflows) ───────────

export function getDepartmentEmail(department: string): { name: string; email: string } {
  const raw = getSetting('department_emails') || DEFAULTS.department_emails;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const email = map[department] || 'servicios@cncivirtual.mx';
    const names: Record<string, string> = {
      plataformas: 'Soporte Técnico', pagos: 'Cobranza', inscripcion: 'Servicios Estudiantiles',
      tramites: 'Servicios Estudiantiles', titulacion: 'Titulación', soporte: 'Soporte Técnico',
      academico: 'Servicios Estudiantiles', contacto: 'Servicios Estudiantiles',
    };
    return { name: names[department] || 'Servicios Estudiantiles', email };
  } catch {
    return { name: 'Servicios Estudiantiles', email: 'servicios@cncivirtual.mx' };
  }
}

// ── Audit log ───────────────────────────────────────────────────────

export function logAudit(actor: string, action: string, entityType: string, entityId?: string, oldValue?: string, newValue?: string, ip?: string): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, old_value, new_value, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(actor, action, entityType, entityId || null, oldValue || null, newValue || null, ip || null);
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

export function getAuditLog(limit = 100, offset = 0): Array<{
  id: number; actor: string; action: string; entity_type: string;
  entity_id: string | null; created_at: string;
}> {
  const db = getDb();
  return db.prepare(
    'SELECT id, actor, action, entity_type, entity_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as any[];
}
