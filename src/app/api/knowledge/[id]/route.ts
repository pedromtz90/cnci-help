import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDynamicById, updateKnowledge, deleteKnowledge, toggleVisibility, bumpIndexVersion } from '@/lib/knowledge/dynamic';
import { getDb } from '@/lib/db/database';
import { requireStaff, AuthError } from '@/lib/auth/session';

interface Params { params: { id: string } }

// BUG-06 FIX: Validate params.id is a valid integer
function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// BUG-04 FIX: Add Zod validation for PATCH body
const UpdateKnowledgeSchema = z.object({
  action: z.literal('toggle').optional(),
  title: z.string().min(3).max(500).optional(),
  category: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(50)).max(15).optional(),
  area: z.string().max(200).optional(),
  contactEmail: z.string().email().or(z.literal('')).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10).max(50000).optional(),
  videoUrl: z.string().url().or(z.literal('')).optional(),
  imageUrl: z.string().url().or(z.literal('')).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  getDb();
  const item = getDynamicById(id);
  if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  getDb();

  let body: z.infer<typeof UpdateKnowledgeSchema>;
  try { body = UpdateKnowledgeSchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }); }

  if (body.action === 'toggle') {
    const item = toggleVisibility(id);
    if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    bumpIndexVersion();
    return NextResponse.json({ item });
  }
  const item = updateKnowledge(id, body);
  if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  bumpIndexVersion();
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  getDb();
  const ok = deleteKnowledge(id);
  if (!ok) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  bumpIndexVersion();
  return NextResponse.json({ ok: true });
}
