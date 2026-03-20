import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAllDynamicRaw, createKnowledge, bulkImport, bumpIndexVersion, searchDynamic } from '@/lib/knowledge/dynamic';
import { getDb } from '@/lib/db/database';

const CreateSchema = z.object({
  title: z.string().min(3).max(500),
  category: z.string().min(1),
  tags: z.array(z.string()).optional(),
  area: z.string().optional(),
  contactEmail: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  excerpt: z.string().optional(),
  content: z.string().min(10),
  videoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
});

const BulkSchema = z.object({
  items: z.array(z.object({
    title: z.string(),
    content: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    area: z.string().optional(),
    contactEmail: z.string().optional(),
    priority: z.string().optional(),
    excerpt: z.string().optional(),
    videoUrl: z.string().optional(),
    imageUrl: z.string().optional(),
  })),
});

export async function GET(req: NextRequest) {
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
  getDb();

  const body = await req.json();

  // Bulk import
  if (body.items && Array.isArray(body.items)) {
    try {
      const parsed = BulkSchema.parse(body);
      const result = bulkImport(parsed.items as any);
      bumpIndexVersion();
      return NextResponse.json({ ...result, message: `Importadas ${result.created} preguntas.` }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Formato inválido para importación masiva.' }, { status: 400 });
    }
  }

  // Single create
  try {
    const parsed = CreateSchema.parse(body);
    const item = createKnowledge(parsed);
    bumpIndexVersion();
    return NextResponse.json({ item, message: 'Pregunta creada. El chatbot la puede usar de inmediato.' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Datos inválidos. Verifica título y contenido.' }, { status: 400 });
  }
}
