'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Upload, Pencil, Trash2, Eye, EyeOff, Loader2, BookOpen, RefreshCw, Brain, FileText } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

interface KnowledgeItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  area: string;
  contact_email: string;
  priority: string;
  visibility: string;
  excerpt: string;
  content: string;
  tags: string;
  video_url: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: 'plataformas', name: 'Plataformas y Accesos' },
  { id: 'pagos', name: 'Pagos y Becas' },
  { id: 'inscripcion', name: 'Inscripción' },
  { id: 'tramites', name: 'Trámites' },
  { id: 'titulacion', name: 'Titulación' },
  { id: 'soporte', name: 'Soporte Técnico' },
  { id: 'academico', name: 'Académico' },
  { id: 'contacto', name: 'Contacto' },
];

export default function AdminContentPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState('');
  const PAGE_SIZE = 50;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadItems = useCallback(async () => {
    setLoading(true);
    const url = searchQuery
      ? `/api/knowledge?q=${encodeURIComponent(searchQuery)}`
      : `/api/knowledge?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [searchQuery, page]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    showToast('Eliminada correctamente');
    loadItems();
  };

  const handleToggle = async (id: number) => {
    await fetch(`/api/knowledge/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle' }) });
    showToast('Visibilidad actualizada');
    loadItems();
  };

  const filtered = filterCat ? items.filter((i) => i.category === filterCat) : items;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-cnci-blue text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-up">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={20} className="text-cnci-blue" />
              <span className="text-xs font-black text-cnci-blue uppercase tracking-widest">Base de Conocimiento</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">Gestión de Contenido</h1>
            <p className="text-slate-500 text-sm mt-1">
              Todo lo que agregues aquí el chatbot lo usa de inmediato.
              <span className="text-cnci-blue font-semibold"> {items.length} artículos</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin" className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
              <FileText size={16} /> Dashboard
            </Link>
            <button onClick={() => setShowImport(true)} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
              <Upload size={16} /> Importar CSV
            </button>
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="px-5 py-2.5 text-sm font-bold text-white bg-cnci-blue rounded-xl hover:bg-cnci-dark transition-all shadow-md flex items-center gap-2">
              <Plus size={16} /> Nueva Pregunta
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en base de conocimiento..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cnci-blue/20 focus:border-cnci-blue"
            />
          </div>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none">
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={loadItems} className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-cnci-blue hover:border-cnci-blue/30 transition-all">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-cnci-blue" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay artículos</p>
              <p className="text-slate-400 text-sm mt-1">Agrega el primero con el botón "Nueva Pregunta"</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Pregunta</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden sm:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden md:table-cell">Área</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800 text-sm leading-snug">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">{item.excerpt?.slice(0, 80)}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">{item.category}</span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-xs text-slate-500">{item.area}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => handleToggle(item.id)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.visibility === 'published' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                        {item.visibility === 'published' ? 'Activo' : 'Borrador'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-2 rounded-lg text-slate-400 hover:text-cnci-blue hover:bg-blue-50 transition-all" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && !searchQuery && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <FormModal
          item={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={() => { setShowForm(false); setEditing(null); loadItems(); showToast(editing ? 'Actualizada correctamente' : 'Pregunta creada — el chatbot ya la puede usar'); }}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={(count) => { setShowImport(false); loadItems(); showToast(`Se importaron ${count} preguntas`); }}
        />
      )}
    </div>
  );
}

// ── Form Modal ──────────────────────────────────────────────────────

function FormModal({ item, onClose, onSave }: { item: KnowledgeItem | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: item?.title || '',
    category: item?.category || 'soporte',
    area: item?.area || '',
    contactEmail: item?.contact_email || '',
    priority: item?.priority || 'medium',
    content: item?.content || '',
    tags: item?.tags ? (typeof item.tags === 'string' ? item.tags : JSON.stringify(item.tags)) : '',
    videoUrl: item?.video_url || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse(form.tags);
    } catch {
      parsedTags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    const body = { ...form, tags: parsedTags };
    const url = item ? `/api/knowledge/${item.id}` : '/api/knowledge';
    const method = item ? 'PATCH' : 'POST';

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    onSave();
  };

  const input = "w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/20 focus:border-cnci-blue";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-6">
          {item ? 'Editar Pregunta' : 'Nueva Pregunta'}
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Pregunta / Título *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} placeholder="¿Cómo tramito mi constancia?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Categoría *</label>
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Prioridad</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={input}>
                <option value="critical">Crítica</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Área responsable</label>
              <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={input} placeholder="Servicios Estudiantiles" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Email de contacto</label>
              <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className={input} placeholder="servicios@cncivirtual.mx" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Tags (separados por coma)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={input} placeholder="blackboard, acceso, login" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Respuesta / Contenido *</label>
            <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className={`${input} min-h-[160px] resize-y`} placeholder="Escribe la respuesta completa..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">URL de video (opcional)</label>
            <input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className={input} placeholder="https://youtube.com/..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-all">Cancelar</button>
            <button type="submit" disabled={saving} className="px-8 py-2.5 rounded-xl bg-cnci-blue text-white font-bold shadow-md hover:bg-cnci-dark transition-all disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {item ? 'Guardar cambios' : 'Crear y enseñar al chatbot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Import Modal ────────────────────────────────────────────────────

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (count: number) => void }) {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError('');

    // Parse CSV to JSON
    const lines = csvText.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
    if (lines.length < 2) { setError('El archivo parece estar vacío.'); setLoading(false); return; }

    const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      let line = lines[i];
      while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) { i++; line += '\n' + lines[i]; }
      const vals = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });

      const title = row['Pregunta'] || row['pregunta'] || row['title'] || '';
      const content = row['Respuesta (HTML)'] || row['Respuesta'] || row['respuesta'] || row['content'] || '';
      if (title && content) {
        items.push({
          title,
          content: content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '),
          category: normalizeCategory(row['Categoria'] || row['Categoría'] || row['categoria'] || ''),
          area: row['Area'] || row['Área'] || row['area'] || '',
          contactEmail: row['Contacto'] || row['contacto'] || '',
        });
      }
    }

    if (items.length === 0) { setError('No se encontraron filas válidas.'); setLoading(false); return; }

    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      onDone(data.created || 0);
    } catch {
      setError('Error al importar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black text-slate-900 mb-2">Importar desde CSV</h2>
        <p className="text-slate-500 text-sm mb-6">
          Sube un archivo CSV con columnas: <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Pregunta, Respuesta, Categoría, Área</span>
        </p>

        <div className="space-y-4">
          <label className="block w-full p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center cursor-pointer hover:border-cnci-blue/30 hover:bg-blue-50/30 transition-all">
            <Upload size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Haz clic para subir CSV</p>
            <p className="text-xs text-slate-400 mt-1">o arrastra el archivo aquí</p>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          {csvText && (
            <p className="text-xs text-green-600 font-semibold">
              Archivo cargado ({csvText.split('\n').length - 1} filas detectadas)
            </p>
          )}

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-all">Cancelar</button>
            <button onClick={handleImport} disabled={!csvText || loading} className="px-6 py-2.5 rounded-xl bg-cnci-blue text-white font-bold shadow-md hover:bg-cnci-dark transition-all disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Importar y enseñar al chatbot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CSV Helpers ──────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += char;
  }
  result.push(current);
  return result;
}

function countQuotes(s: string): number { return (s.match(/"/g) || []).length; }

function normalizeCategory(cat: string): string {
  const c = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (/pago|cobr|beca|factur/.test(c)) return 'pagos';
  if (/tramit|constanc|credenc|document|escolar/.test(c)) return 'tramites';
  if (/inscri|registro|baja/.test(c)) return 'inscripcion';
  if (/titula|tesis|egres/.test(c)) return 'titulacion';
  if (/soporte|tecn|blackboard|office|plataforma/.test(c)) return 'soporte';
  if (/calific|materia|horario|academ|evalua/.test(c)) return 'academico';
  if (/contact|director/.test(c)) return 'contacto';
  return 'soporte';
}
