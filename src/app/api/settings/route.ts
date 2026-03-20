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
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value !== '••••••••') {
      clean[key] = value;
    }
  }
  savePlatformSettings(clean as any);
  return NextResponse.json({ ok: true, message: 'Configuración guardada.' });
}
