import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/settings/service';
import { getDb } from '@/lib/db/database';
import { requireDirector, AuthError } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try { await requireDirector(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  getDb();
  const { service } = await req.json();
  const settings = getPlatformSettings();

  switch (service) {
    case 'azure': return testAzure(settings);
    case 'smtp': return testSmtp(settings);
    case 'nexus': return testNexus(settings);
    case 'ai': return testAI(settings);
    default: return NextResponse.json({ ok: false, error: 'Servicio desconocido.' }, { status: 400 });
  }
}

async function testAzure(s: any) {
  if (!s.azure_ad_client_id || !s.azure_ad_tenant_id) {
    return NextResponse.json({ ok: false, error: 'Falta Client ID o Tenant ID.' });
  }
  try {
    const url = `https://login.microsoftonline.com/${s.azure_ad_tenant_id}/v2.0/.well-known/openid-configuration`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ok: !!data.issuer, message: data.issuer ? `Tenant válido.` : 'Respuesta inválida.' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar al tenant de Azure.' });
  }
}

async function testSmtp(s: any) {
  if (!s.smtp_host) return NextResponse.json({ ok: false, error: 'Falta el host SMTP.' });
  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: s.smtp_host, port: parseInt(s.smtp_port || '587'),
      secure: s.smtp_port === '465',
      auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
      connectionTimeout: 5000,
    });
    await transport.verify();
    return NextResponse.json({ ok: true, message: `Conectado a ${s.smtp_host}` });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar al servidor SMTP.' });
  }
}

async function testNexus(s: any) {
  if (!s.nexus_api_url) return NextResponse.json({ ok: false, error: 'Falta la URL de Nexus.' });
  try {
    const res = await fetch(`${s.nexus_api_url}/api/v1/health`, {
      headers: s.nexus_api_key ? { Authorization: `Bearer ${s.nexus_api_key}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json({ ok: res.ok, message: res.ok ? 'Nexus respondió OK.' : `Nexus respondió ${res.status}` });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar a Nexus.' });
  }
}

async function testAI(s: any) {
  if (!s.ai_api_key) return NextResponse.json({ ok: false, error: 'Falta la API key.' });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': s.ai_api_key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: s.ai_model || 'claude-haiku-4-5-20251001', max_tokens: 20, messages: [{ role: 'user', content: 'Di OK.' }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: 'API key inválida o sin créditos.' });
    const data = await res.json();
    return NextResponse.json({ ok: true, message: `IA respondió: "${data.content?.[0]?.text || 'OK'}"` });
  } catch {
    return NextResponse.json({ ok: false, error: 'Error conectando con IA.' });
  }
}
