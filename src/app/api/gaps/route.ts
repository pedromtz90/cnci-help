import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
  // BUG-07 FIX: Only call getAllGaps once instead of twice
  const items = getAllGaps(status);
  return NextResponse.json({ items, total: items.length });
}

// BUG-05 FIX: Add proper Zod validation for POST body
const ResolveSchema = z.object({
  action: z.literal('resolve'),
  id: z.number().int().positive(),
  answer: z.string().min(1).max(50000),
  category: z.string().min(1).max(100),
});

const IgnoreSchema = z.object({
  action: z.literal('ignore'),
  id: z.number().int().positive(),
});

const GapActionSchema = z.discriminatedUnion('action', [ResolveSchema, IgnoreSchema]);

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  getDb();

  let body: z.infer<typeof GapActionSchema>;
  try {
    body = GapActionSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos. Campos requeridos: action (resolve|ignore), id (número), y para resolve: answer, category.' }, { status: 400 });
  }

  if (body.action === 'resolve') {
    const result = resolveGap(body.id, body.answer, body.category, session.email);
    if (!result) return NextResponse.json({ error: 'Pregunta no encontrada.' }, { status: 404 });
    return NextResponse.json({ item: result, message: 'Respuesta guardada. El chatbot ya la puede usar.' });
  }

  if (body.action === 'ignore') {
    ignoreGap(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Acción no válida. Usa: resolve o ignore.' }, { status: 400 });
}
