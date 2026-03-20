/**
 * Enrich FAQ tags by extracting keywords from title and content.
 * Run: npx tsx scripts/enrich-tags.ts
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

const KEYWORD_MAP: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ['blackboard', 'aula virtual', 'plataforma educativa'], tag: 'blackboard' },
  { keywords: ['office 365', 'office365', 'microsoft', 'teams', 'outlook', 'word', 'excel'], tag: 'office365' },
  { keywords: ['correo', 'email', 'e-mail', 'institucional'], tag: 'correo' },
  { keywords: ['contraseña', 'password', 'clave', 'acceso', 'iniciar sesión', 'login'], tag: 'acceso' },
  { keywords: ['pago', 'pagar', 'mensualidad', 'cuota', 'costo', 'precio'], tag: 'pagos' },
  { keywords: ['beca', 'descuento', 'apoyo económico', 'financiamiento'], tag: 'becas' },
  { keywords: ['factura', 'facturación', 'cfdi', 'fiscal', 'rfc'], tag: 'facturacion' },
  { keywords: ['inscripción', 'inscripcion', 'inscribirme', 'inscrito', 'reinscripción', 'reinscripcion'], tag: 'inscripcion' },
  { keywords: ['baja', 'cancelar', 'darme de baja', 'dejar de estudiar'], tag: 'baja' },
  { keywords: ['constancia', 'carta', 'comprobante', 'documento'], tag: 'constancias' },
  { keywords: ['certificado', 'certificación'], tag: 'certificados' },
  { keywords: ['credencial', 'identificación', 'ife', 'ine'], tag: 'credencial' },
  { keywords: ['título', 'titulo', 'titulación', 'titulacion', 'cédula', 'cedula'], tag: 'titulacion' },
  { keywords: ['tesis', 'tesina', 'trabajo recepcional'], tag: 'tesis' },
  { keywords: ['servicio social', 'horas', 'liberación'], tag: 'servicio-social' },
  { keywords: ['calificación', 'calificaciones', 'nota', 'evaluación', 'examen'], tag: 'calificaciones' },
  { keywords: ['kardex', 'historial', 'boleta', 'expediente'], tag: 'kardex' },
  { keywords: ['materia', 'materias', 'asignatura', 'curso', 'cursos'], tag: 'materias' },
  { keywords: ['extraordinario', 'recursamiento', 'reprobar', 'reprobé'], tag: 'extraordinarios' },
  { keywords: ['horario', 'horarios', 'calendario', 'fecha'], tag: 'horarios' },
  { keywords: ['tutor', 'asesor', 'orientador', 'maestro', 'profesor'], tag: 'asesores' },
  { keywords: ['equivalencia', 'revalidación', 'convalidación'], tag: 'equivalencias' },
  { keywords: ['biblioteca', 'libros', 'recursos', 'lectura'], tag: 'biblioteca' },
  { keywords: ['egreso', 'egresado', 'graduado', 'terminé'], tag: 'egreso' },
  { keywords: ['prácticas', 'profesional', 'residencia'], tag: 'practicas' },
  { keywords: ['cambio', 'carrera', 'plan de estudios', 'programa'], tag: 'cambio-carrera' },
  { keywords: ['soporte', 'técnico', 'ayuda', 'error', 'problema', 'no funciona', 'no puedo'], tag: 'soporte' },
  { keywords: ['trámite', 'tramite', 'gestión', 'proceso', 'solicitar', 'solicitud'], tag: 'tramites' },
  { keywords: ['contacto', 'teléfono', 'dirección', 'departamento', 'área'], tag: 'contacto' },
  { keywords: ['oxxo', 'transferencia', 'depósito', 'banco', 'tarjeta'], tag: 'metodos-pago' },
];

async function main() {
  const files = await glob(path.join(process.cwd(), 'content', 'faqs', '*.mdx'));
  let enriched = 0;

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    const currentTags: string[] = data.tags || [];
    if (currentTags.length > 3) continue; // Already has good tags

    const searchText = `${data.title || ''} ${data.excerpt || ''} ${content}`.toLowerCase();
    const newTags = new Set(currentTags);

    for (const { keywords, tag } of KEYWORD_MAP) {
      if (keywords.some((kw) => searchText.includes(kw))) {
        newTags.add(tag);
      }
    }

    // Only update if we found new tags
    if (newTags.size > currentTags.length) {
      data.tags = [...newTags].slice(0, 10);
      const updated = matter.stringify(content, data);
      fs.writeFileSync(filePath, updated, 'utf-8');
      enriched++;
    }
  }

  console.log(`\n✅ Enriched ${enriched} of ${files.length} FAQs with better tags.\n`);
}

main().catch(console.error);
