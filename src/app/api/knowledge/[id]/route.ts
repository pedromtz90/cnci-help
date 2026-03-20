import { NextRequest, NextResponse } from 'next/server';
import { getDynamicById, updateKnowledge, deleteKnowledge, toggleVisibility, bumpIndexVersion } from '@/lib/knowledge/dynamic';
import { getDb } from '@/lib/db/database';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  getDb();
  const item = getDynamicById(parseInt(params.id));
  if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
  return NextResponse.json({ item, message: 'Actualizado. El chatbot ya usa la nueva versión.' });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  getDb();
  const ok = deleteKnowledge(parseInt(params.id));
  if (!ok) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  bumpIndexVersion();
  return NextResponse.json({ ok: true });
}
