/**
 * Settings Service — Persistent key-value configuration stored in SQLite.
 * All platform settings are managed here: Azure AD, SMTP, emails, etc.
 * Settings override environment variables when present.
 */
import { getDb } from '@/lib/db/database';

// ── Read/Write ──────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
  `).run(key, value, value);
}

export function deleteSetting(key: string): void {
  const db = getDb();
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ── Typed getters (fall back to env vars) ───────────────────────────

export function getConfig(key: string): string {
  return getSetting(key) || process.env[key] || '';
}

// ── Settings groups ─────────────────────────────────────────────────

export interface PlatformSettings {
  // Azure AD
  azure_ad_client_id: string;
  azure_ad_client_secret: string;
  azure_ad_tenant_id: string;
  // SMTP
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  // Nexus
  nexus_api_url: string;
  nexus_api_key: string;
  // AI
  ai_api_key: string;
  ai_model: string;
  // Access control
  staff_emails: string;    // comma-separated
  director_emails: string; // comma-separated
  // Branding
  institution_name: string;
  support_phone: string;
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
};

export function getPlatformSettings(): PlatformSettings {
  const all = getAllSettings();
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof PlatformSettings)[]) {
    if (all[key]) result[key] = all[key];
  }
  return result;
}

export function savePlatformSettings(settings: Partial<PlatformSettings>): void {
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined && value !== null) {
      setSetting(key, value);
    }
  }
}

// ── Role helpers (use DB settings) ──────────────────────────────────

export function getStaffEmails(): Set<string> {
  const raw = getSetting('staff_emails') || DEFAULTS.staff_emails;
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function getDirectorEmails(): Set<string> {
  const raw = getSetting('director_emails') || DEFAULTS.director_emails;
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}
