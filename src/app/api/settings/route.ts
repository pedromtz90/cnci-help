import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSettings, savePlatformSettings } from '@/lib/settings/service';
import { getDb } from '@/lib/db/database';
import { requireDirector, AuthError } from '@/lib/auth/session';

export async function GET() {
  try { await requireDirector(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();
  const settings = getPlatformSettings();
  return NextResponse.json({
    ...settings,
    azure_ad_client_secret: settings.azure_ad_client_secret ? '••••••••' : '',
    smtp_pass: settings.smtp_pass ? '••••••••' : '',
    nexus_api_key: settings.nexus_api_key ? '••••••••' : '',
    ai_api_key: settings.ai_api_key ? '••••••••' : '',
  });
}

export async function POST(req: NextRequest) {
  try { await requireDirector(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();
  const body = await req.json();

  // Whitelist allowed settings keys
  const ALLOWED_KEYS = new Set([
    'azure_ad_client_id', 'azure_ad_client_secret', 'azure_ad_tenant_id',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
    'nexus_api_url', 'nexus_api_key', 'nexus_email', 'nexus_password', 'nexus_channel_id',
    'ai_api_key', 'ai_model',
    'staff_emails', 'director_emails',
    'institution_name', 'support_phone',
    'department_emails', 'chatbot_prompt',
  ]);

  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value !== '••••••••' && ALLOWED_KEYS.has(key)) {
      clean[key] = value;
    }
  }
  savePlatformSettings(clean as any);
  return NextResponse.json({ ok: true, message: 'Configuración guardada.' });
}
