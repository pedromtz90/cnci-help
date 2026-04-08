import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireStaff, AuthError } from '@/lib/auth/session';

/**
 * POST /api/import — Import FAQs from JSON array.
 *
 * Accepts JSON body with array of FAQ objects:
 * [
 *   {
 *     "pregunta": "¿Cómo accedo a ...?",
 *     "respuesta": "Para acceder...",
 *     "categoria": "plataformas",
 *     "tags": "blackboard, acceso",
 *     "area": "Soporte Técnico",
 *     "contacto": "soporte@cncivirtual.mx",
 *     "prioridad": "alta"
 *   }
 * ]
 *
 * Also accepts Excel-converted format with columns:
 * Pregunta, Respuesta, Categoría, Tags, Área, Contacto, Prioridad
 */
export async function POST(req: NextRequest) {
  try {
    await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const data = await req.json();
    const items: any[] = Array.isArray(data) ? data : data.items || data.faqs || [];

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items found in body.' }, { status: 400 });
    }

    const contentDir = path.join(process.cwd(), 'content', 'faqs');
    const created: string[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        // Normalize field names (supports Spanish or English)
        const question = item.pregunta || item.Pregunta || item.question || item.title || '';
        const answer = item.respuesta || item.Respuesta || item.answer || item.content || '';
        const category = normalizeCategory(item.categoria || item.Categoría || item.Categoria || item.category || 'general');
        const tags = parseTags(item.tags || item.Tags || item.etiquetas || '');
        const area = item.area || item.Area || item.Área || item.departamento || '';
        const contact = item.contacto || item.Contacto || item.email || item.contactEmail || '';
        const priority = normalizePriority(item.prioridad || item.Prioridad || item.priority || 'medium');

        if (!question || !answer) {
          errors.push(`Skipped: empty question or answer`);
          continue;
        }

        const slug = slugify(question);
        // BUG-11 FIX: Validate slug is non-empty and safe for filesystem
        if (!slug || slug.length < 2) {
          errors.push(`Skipped: could not generate valid slug for "${question.slice(0, 40)}"`);
          continue;
        }
        const id = `faq-${slug}`;

        // Build MDX file content
        const mdx = `---
id: ${id}
title: "${escapeYaml(question)}"
slug: ${slug}
type: faq
category: ${category}
tags: [${tags.map(t => t).join(', ')}]
audience: student
locale: es
priority: ${priority}
updatedAt: "${new Date().toISOString().slice(0, 10)}"
visibility: published
area: ${area}
contactEmail: ${contact}
excerpt: "${escapeYaml(answer.slice(0, 200).replace(/\n/g, ' '))}"
---

${formatAnswer(answer)}
`;

        const filePath = path.join(contentDir, `${slug}.mdx`);
        // BUG-11 FIX: Ensure file stays within contentDir (prevent path traversal)
        if (!filePath.startsWith(contentDir + path.sep)) {
          errors.push(`Skipped: path traversal attempt for slug "${slug}"`);
          continue;
        }
        fs.writeFileSync(filePath, mdx, 'utf-8');
        created.push(slug);
      } catch (err: any) {
        errors.push(`Error processing item: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length,
      files: created,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined,
      message: `Created ${created.length} FAQ files. Rebuild needed for changes to take effect.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[¿?]+/, '')
    .replace(/[?]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function parseTags(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map(t => t.trim()).filter(Boolean);
  return raw.split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0);
}

function normalizeCategory(cat: string): string {
  const map: Record<string, string> = {
    'plataformas': 'plataformas', 'plataforma': 'plataformas', 'acceso': 'plataformas', 'accesos': 'plataformas',
    'pagos': 'pagos', 'pago': 'pagos', 'becas': 'pagos', 'cobranza': 'pagos', 'facturacion': 'pagos',
    'inscripcion': 'inscripcion', 'inscripciones': 'inscripcion', 'registro': 'inscripcion', 'baja': 'inscripcion',
    'tramites': 'tramites', 'tramite': 'tramites', 'constancias': 'tramites', 'documentos': 'tramites',
    'titulacion': 'titulacion', 'titulo': 'titulacion', 'tesis': 'titulacion', 'egreso': 'titulacion',
    'soporte': 'soporte', 'tecnico': 'soporte', 'ayuda': 'soporte', 'problema': 'soporte',
    'academico': 'academico', 'materias': 'academico', 'calificaciones': 'academico', 'horarios': 'academico',
    'contacto': 'contacto', 'directorio': 'contacto', 'departamentos': 'contacto',
  };
  const normalized = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return map[normalized] || 'general';
}

function normalizePriority(p: string): string {
  const map: Record<string, string> = {
    'critica': 'critical', 'critical': 'critical', 'urgente': 'critical',
    'alta': 'high', 'high': 'high', 'importante': 'high',
    'media': 'medium', 'medium': 'medium', 'normal': 'medium',
    'baja': 'low', 'low': 'low',
  };
  return map[p.toLowerCase().trim()] || 'medium';
}

function escapeYaml(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

function formatAnswer(answer: string): string {
  // If answer has line breaks, format as markdown
  if (answer.includes('\n')) {
    return answer
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n\n');
  }
  return answer;
}
