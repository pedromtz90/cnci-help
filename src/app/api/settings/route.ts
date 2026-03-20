import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSettings, savePlatformSettings } from '@/lib/settings/service';
import { getDb } from '@/lib/db/database';

export async function GET() {
  getDb();
  const settings = getPlatformSettings();
  // Mask secrets for display
  return NextResponse.json({
    ...settings,
    azure_ad_client_secret: settings.azure_ad_client_secret ? '••••••••' : '',
    smtp_pass: settings.smtp_pass ? '••••••••' : '',
    nexus_api_key: settings.nexus_api_key ? '••••••••' : '',
    ai_api_key: settings.ai_api_key ? '••••••••' : '',
  });
}

export async function POST(req: NextRequest) {
  getDb();
  const body = await req.json();

  // Don't overwrite secrets with masked values
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value !== '••••••••') {
      clean[key] = value;
    }
  }

  savePlatformSettings(clean as any);
  return NextResponse.json({ ok: true, message: 'Configuración guardada.' });
}
