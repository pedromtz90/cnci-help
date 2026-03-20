import { NextRequest, NextResponse } from 'next/server';
import { getPendingGaps, getAllGaps, resolveGap, ignoreGap } from '@/lib/knowledge/gaps';
import { requireStaff, AuthError } from '@/lib/auth/session';
import { getDb } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100'), 500);

  if (status === 'pending') {
    return NextResponse.json(getPendingGaps(limit));
  }
  return NextResponse.json({ items: getAllGaps(status), total: getAllGaps(status).length });
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();

  const body = await req.json();
  const { action, id, answer, category } = body;

  if (action === 'resolve') {
    if (!id || !answer || !category) {
      return NextResponse.json({ error: 'Faltan campos: id, answer, category.' }, { status: 400 });
    }
    const result = resolveGap(id, answer, category, session.email);
    if (!result) return NextResponse.json({ error: 'Pregunta no encontrada.' }, { status: 404 });
    return NextResponse.json({ item: result, message: 'Respuesta guardada. El chatbot ya la puede usar.' });
  }

  if (action === 'ignore') {
    if (!id) return NextResponse.json({ error: 'Falta id.' }, { status: 400 });
    ignoreGap(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no válida. Usa: resolve o ignore.' }, { status: 400 });
}
