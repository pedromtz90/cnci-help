/**
 * Import FAQs from CNCI CSV export into MDX content files.
 * Usage: npx tsx scripts/import-csv.ts /path/to/file.csv
 */
import fs from 'fs';
import path from 'path';

const CSV_PATH = process.argv[2] || '/home/braingine/Downloads/Banco_Conocimientos_CNCI.csv';
const OUTPUT_DIR = path.join(process.cwd(), 'content', 'faqs');

// ── Parse CSV ──────────────────────────────────────────────────────

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());

  const rows: Array<Record<string, string>> = [];
  let i = 1;

  while (i < lines.length) {
    // Handle multi-line quoted fields
    let line = lines[i];
    while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += '\n' + lines[i];
    }
    i++;

    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });

    if (row['Pregunta']) rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function countQuotes(s: string): number {
  return (s.match(/"/g) || []).length;
}

// ── Normalization ──────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'tramites escolares': 'tramites',
  'trámites escolares': 'tramites',
  'calificaciones y evaluaciones': 'academico',
  'pagos y cobranza': 'pagos',
  'soporte técnico': 'soporte',
  'soporte tecnico': 'soporte',
  'plataformas y accesos': 'plataformas',
  'plataformas educativas': 'plataformas',
  'inscripción y reinscripción': 'inscripcion',
  'inscripciones': 'inscripcion',
  'titulación': 'titulacion',
  'titulacion': 'titulacion',
  'servicio social': 'titulacion',
  'becas': 'pagos',
  'vida académica': 'academico',
  'contacto': 'contacto',
  'general': 'soporte',
};

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  // Try exact match
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  // Try partial match
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  // Keyword fallback
  if (/pago|cobr|factur|beca/i.test(lower)) return 'pagos';
  if (/tramit|constanc|credenc|document/i.test(lower)) return 'tramites';
  if (/inscri|registro|baja|reinscri/i.test(lower)) return 'inscripcion';
  if (/titula|tesis|egres/i.test(lower)) return 'titulacion';
  if (/soporte|técn|blackboard|office|plataforma|acceso/i.test(lower)) return 'soporte';
  if (/calific|materia|horario|academ|evalua/i.test(lower)) return 'academico';
  if (/contact|director/i.test(lower)) return 'contacto';
  return 'soporte';
}

const AREA_EMAIL_MAP: Record<string, string> = {
  'servicios estudiantiles': 'servicios@cncivirtual.mx',
  'escolar': 'servicios@cncivirtual.mx',
  'cobranza': 'cobranza@cncivirtual.mx',
  'soporte técnico': 'soporte@cncivirtual.mx',
  'soporte tecnico': 'soporte@cncivirtual.mx',
  'titulación': 'titulacion@cncivirtual.mx',
  'titulacion': 'titulacion@cncivirtual.mx',
  'bienestar': 'bienestar@cncivirtual.mx',
};

function getContactEmail(area: string): string {
  const lower = area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  for (const [key, email] of Object.entries(AREA_EMAIL_MAP)) {
    if (lower.includes(key)) return email;
  }
  return 'servicios@cncivirtual.mx';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[¿?¡!]+/, '')
    .replace(/[?!]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function htmlToMarkdown(html: string): string {
  return html
    // Remove HTML tags but keep structure
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?[uo]l[^>]*>/gi, '\n')
    .replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '\n### $1\n')
    .replace(/<\/?(div|span|font|table|tr|td|th|thead|tbody)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTags(question: string, category: string): string[] {
  const tags = new Set<string>();
  const q = question.toLowerCase();

  // Category-based tags
  tags.add(category);

  // Keyword extraction
  const keywords: Record<string, string[]> = {
    blackboard: ['blackboard', 'aula virtual', 'plataforma'],
    office: ['office', 'office 365', 'correo', 'teams'],
    pago: ['pago', 'mensualidad', 'factura', 'costo'],
    beca: ['beca', 'descuento', 'apoyo'],
    inscripcion: ['inscripción', 'inscripcion', 'registro', 'matrícula'],
    constancia: ['constancia', 'certificado', 'documento'],
    titulo: ['título', 'titulación', 'tesis'],
    calificacion: ['calificación', 'nota', 'evaluación'],
    contraseña: ['contraseña', 'password', 'acceso'],
    soporte: ['soporte', 'ayuda', 'error', 'problema'],
  };

  for (const [tag, kws] of Object.entries(keywords)) {
    if (kws.some(kw => q.includes(kw))) tags.add(tag);
  }

  return [...tags].slice(0, 8);
}

function escapeYaml(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  console.log(`\n📚 Importing FAQs from: ${CSV_PATH}\n`);

  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(raw);

  console.log(`Found ${rows.length} rows\n`);

  // Track slugs to avoid duplicates
  const usedSlugs = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const question = row['Pregunta'] || '';
    const answerHtml = row['Respuesta (HTML)'] || '';
    const categoryRaw = row['Categoria'] || row['Categoría'] || '';
    const area = row['Area'] || row['Área'] || '';
    const videoUrl = row['URL Youtube'] || '';
    const imageUrl = row['URL Imagen'] || '';

    if (!question.trim() || !answerHtml.trim()) {
      skipped++;
      continue;
    }

    let slug = slugify(question);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${created}`;
    }
    usedSlugs.add(slug);

    const category = normalizeCategory(categoryRaw);
    const tags = extractTags(question, category);
    const contactEmail = getContactEmail(area);
    const answer = htmlToMarkdown(answerHtml);
    const excerpt = answer.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 250).replace(/\n/g, ' ').trim();

    // Build suggested actions
    const actions: string[] = [];
    if (videoUrl) {
      actions.push(`  - type: link\n    label: "Ver video"\n    href: "${videoUrl}"`);
    }
    if (imageUrl) {
      actions.push(`  - type: link\n    label: "Ver imagen"\n    href: "${imageUrl}"`);
    }
    if (contactEmail) {
      actions.push(`  - type: email\n    label: "Contactar ${area || 'soporte'}"\n    href: "mailto:${contactEmail}"`);
    }

    const actionsYaml = actions.length > 0
      ? `suggestedActions:\n${actions.join('\n')}`
      : '';

    const mdx = `---
id: faq-imported-${created}
title: "${escapeYaml(question)}"
slug: ${slug}
type: faq
category: ${category}
tags: [${tags.join(', ')}]
audience: student
locale: es
priority: medium
updatedAt: "${new Date().toISOString().slice(0, 10)}"
visibility: published
area: "${area}"
contactEmail: ${contactEmail}
excerpt: "${escapeYaml(excerpt)}"
${actionsYaml}
---

${answer}
`;

    const filePath = path.join(OUTPUT_DIR, `${slug}.mdx`);
    fs.writeFileSync(filePath, mdx, 'utf-8');
    created++;
  }

  console.log(`✅ Created: ${created} FAQ files`);
  console.log(`⏭️  Skipped: ${skipped} (empty question or answer)`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`\n🔄 Run 'npm run build' to rebuild the site with new content.\n`);
}

main();
