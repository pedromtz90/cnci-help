import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllDynamicRaw, createKnowledge, bulkImport, bumpIndexVersion, searchDynamic } from '@/lib/knowledge/dynamic';
import { getDb } from '@/lib/db/database';
import { requireStaff, AuthError } from '@/lib/auth/session';

const CreateSchema = z.object({
  title: z.string().min(3).max(500),
  category: z.string().min(1),
  tags: z.array(z.string().max(50)).max(15).optional(),
  area: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(10).max(50000),
  videoUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

const BulkSchema = z.object({
  items: z.array(z.object({
    title: z.string().min(1).max(500),
    content: z.string().min(1).max(50000),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    area: z.string().optional(),
    contactEmail: z.string().optional(),
    priority: z.string().optional(),
    excerpt: z.string().optional(),
    videoUrl: z.string().optional(),
    imageUrl: z.string().optional(),
  })).max(1000),
});

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Error de autenticación.' }, { status: 401 });
  }

  getDb();
  const q = req.nextUrl.searchParams.get('q');
  if (q) {
    const results = searchDynamic(q);
    return NextResponse.json({ items: results, total: results.length });
  }
  const items = getAllDynamicRaw();
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: NextRequest) {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Error de autenticación.' }, { status: 401 });
  }

  getDb();
  const body = await req.json();

  if (body.items && Array.isArray(body.items)) {
    try {
      const parsed = BulkSchema.parse(body);
      const result = bulkImport(parsed.items as any);
      bumpIndexVersion();
      return NextResponse.json({ ...result, message: `Importadas ${result.created} preguntas.` }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 });
    }
  }

  try {
    const parsed = CreateSchema.parse(body);
    const item = createKnowledge(parsed);
    bumpIndexVersion();
    return NextResponse.json({ item, message: 'Pregunta creada.' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
}
