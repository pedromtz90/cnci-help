import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runWorkflow } from '@/lib/workflows/mastra';
import { requireStaff, AuthError } from '@/lib/auth/session';
import { getDb } from '@/lib/db/database';

export async function GET() {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const db = getDb();
  const rows = db.prepare('SELECT * FROM workflows ORDER BY created_at ASC').all() as any[];
  return NextResponse.json({
    workflows: rows.map((r) => ({ ...r, enabled: !!r.enabled, steps: JSON.parse(r.steps || '[]') })),
  });
}

const StepSchema = z.object({
  id: z.string(),
  action: z.string(),
  label: z.string(),
  description: z.string(),
  condition: z.string().optional(),
});

const SaveSchema = z.object({
  id: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3).max(200),
  description: z.string().max(2000),
  trigger_description: z.string().max(500),
  trigger_keywords: z.string().max(500),
  enabled: z.boolean().default(true),
  steps: z.array(StepSchema).max(10),
});

export async function POST(req: NextRequest) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const body = await req.json();

  // Test run
  if (body.action === 'run') {
    const result = await runWorkflow(body.workflow, body.data || {} as any);
    return NextResponse.json(result);
  }

  // Save
  let data: z.infer<typeof SaveSchema>;
  try { data = SaveSchema.parse(body); } catch {
    return NextResponse.json({ error: 'Revisa que todos los campos estén completos y el ID solo tenga letras minúsculas, números y guiones.' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO workflows (id, name, description, trigger_description, trigger_keywords, enabled, steps, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name=?, description=?, trigger_description=?, trigger_keywords=?, enabled=?, steps=?, updated_at=datetime('now')
  `).run(data.id, data.name, data.description, data.trigger_description, data.trigger_keywords, data.enabled ? 1 : 0, JSON.stringify(data.steps),
    data.name, data.description, data.trigger_description, data.trigger_keywords, data.enabled ? 1 : 0, JSON.stringify(data.steps));

  return NextResponse.json({ ok: true, message: 'Flujo guardado.' });
}

export async function DELETE(req: NextRequest) {
  try { await requireStaff(); } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
  getDb().prepare('DELETE FROM workflows WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
