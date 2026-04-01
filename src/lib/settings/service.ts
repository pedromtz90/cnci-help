/**
 * Settings Service — Persistent config in SQLite.
 * Secrets are encrypted at rest with AES-256-GCM when SETTINGS_ENCRYPTION_KEY is set.
 * Falls back to base64 for backward compatibility with existing rows or when the key
 * is not configured. All changes are audit-logged.
 */
import { getDb } from '@/lib/db/database';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const SECRET_KEYS = new Set([
  'azure_ad_client_secret', 'smtp_pass', 'nexus_api_key', 'nexus_password', 'ai_api_key',
  'whatsapp_access_token', 'whatsapp_verify_token',
]);

// SETTINGS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes = AES-256).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY
  ? Buffer.from(process.env.SETTINGS_ENCRYPTION_KEY, 'hex')
  : null;

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    // Fallback to base64 if no key configured (backward compat)
    return 'enc:' + Buffer.from(text).toString('base64');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: enc:<iv_hex>:<tag_hex>:<ciphertext_hex>
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data: string): string {
  if (!data.startsWith('enc:')) {
    // Unencoded plain value (legacy rows written before this system)
    return data;
  }
  const rest = data.slice(4); // strip "enc:"
  const parts = rest.split(':');
  if (parts.length === 3) {
    // AES-256-GCM format: <iv_hex>:<tag_hex>:<ciphertext_hex>
    if (!ENCRYPTION_KEY) throw new Error('SETTINGS_ENCRYPTION_KEY required to decrypt');
    const [ivHex, tagHex, cipherHex] = parts;
    const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(cipherHex, 'hex')) + decipher.final('utf8');
  }
  // Legacy base64 fallback (single segment after "enc:")
  return Buffer.from(rest, 'base64').toString('utf-8');
}

function encode(key: string, value: string): string {
  if (!value || !SECRET_KEYS.has(key)) return value;
  return encrypt(value);
}

function decode(key: string, value: string): string {
  if (!value || !SECRET_KEYS.has(key) || !value.startsWith('enc:')) return value;
  return decrypt(value);
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
  nexus_email: string;
  nexus_password: string;
  nexus_channel_id: string;
  ai_api_key: string;
  ai_model: string;
  staff_emails: string;
  director_emails: string;
  institution_name: string;
  support_phone: string;
  department_emails: string; // JSON map of department → email
  chatbot_prompt: string;    // System prompt for chatbot
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
  nexus_email: 'admin@nexus.mx',
  nexus_password: '',
  nexus_channel_id: '4bf0bccb-3741-4957-aefc-81d8f9693bfa',
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
  chatbot_prompt: `Eres un Ejecutivo de Servicios Estudiantiles de la Universidad Virtual CNCI.

IDENTIDAD:
- Eres parte del equipo de Servicios Estudiantiles
- Conoces los procesos académicos y administrativos de CNCI
- Representas a la institución
- Tu tono es profesional, cercano y humano

FORMA DE RESPONDER:
- Responde en español, de forma clara y directa
- Usa lenguaje sencillo, evita tecnicismos
- Explica paso a paso cuando sea necesario
- Da soluciones, no solo información
- Anticipa dudas comunes
- Mantén un tono amable y empático
- NO suenes como IA o sistema automatizado
- Máximo 3 párrafos

REGLAS:
- Basa tus respuestas EXCLUSIVAMENTE en el contexto proporcionado
- NUNCA inventes información sobre trámites, fechas, costos o requisitos
- Si no tienes la respuesta, dilo claramente y ofrece alternativas
- Sugiere crear ticket o contactar al área correcta si no puedes resolver`,
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
