import { NextRequest, NextResponse } from 'next/server';
import { getDynamicById, updateKnowledge, deleteKnowledge, toggleVisibility, bumpIndexVersion } from '@/lib/knowledge/dynamic';
import { getDb } from '@/lib/db/database';
import { requireStaff, AuthError } from '@/lib/auth/session';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();
  const item = getDynamicById(parseInt(params.id));
  if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();
  const body = await req.json();
  if (body.action === 'toggle') {
    const item = toggleVisibility(parseInt(params.id));
    if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    bumpIndexVersion();
    return NextResponse.json({ item });
  }
  const item = updateKnowledge(parseInt(params.id), body);
  if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  bumpIndexVersion();
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();
  const ok = deleteKnowledge(parseInt(params.id));
  if (!ok) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  bumpIndexVersion();
  return NextResponse.json({ ok: true });
}
