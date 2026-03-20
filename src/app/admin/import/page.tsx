'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Trash2, Download, Database } from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Known column names → our fields
  const AUTO_MAP: Record<string, string> = {
    'pregunta': 'title', 'pregunta formal': 'title', 'preguntas': 'title', 'question': 'title', 'titulo': 'title',
    'respuesta': 'content', 'respuesta 4s (lic, bach, diplomado)': 'content', 'respuestas': 'content', 'respuesta (html)': 'content', 'answer': 'content', 'respuesta correcta': 'content',
    'categoria': 'category', 'categoría': 'category', 'category': 'category',
    'area': 'area', 'área': 'area', 'department': 'area',
    'url_youtube': 'videoUrl', 'url youtube': 'videoUrl', 'video': 'videoUrl',
    'url_imagen': 'imageUrl', 'url imagen': 'imageUrl', 'imagen': 'imageUrl',
    'fuente': '_source', 'source': '_source',
    'pregunta informal': '_alt_question',
    'liga': 'videoUrl',
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    if (f.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (ev) => parseCSV(ev.target?.result as string);
      reader.readAsText(f, 'UTF-8');
    } else if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
      showToast('Para archivos Excel, primero conviértelo a CSV desde Excel (Guardar como → CSV UTF-8)');
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
    if (lines.length < 2) return;

    const hdrs = parseCSVLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
    setHeaders(hdrs);

    // Auto-map columns
    const autoMapping: Record<string, string> = {};
    hdrs.forEach((h) => {
      const key = h.toLowerCase().trim();
      if (AUTO_MAP[key]) autoMapping[h] = AUTO_MAP[key];
    });
    setMapping(autoMapping);

    // Parse preview (first 5 rows)
    const rows: any[] = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      let line = lines[i];
      while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) { i++; line += '\n' + lines[i]; }
      const vals = parseCSVLine(line);
      const row: Record<string, string> = {};
      hdrs.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
      rows.push(row);
    }
    setPreview(rows);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
      const hdrs = parseCSVLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());

      const items: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) { i++; line += '\n' + lines[i]; }
        const vals = parseCSVLine(line);
        const row: Record<string, string> = {};
        hdrs.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });

        // Apply mapping
        const mapped: any = {};
        for (const [csvCol, field] of Object.entries(mapping)) {
          if (field && !field.startsWith('_') && row[csvCol]) {
            mapped[field] = row[csvCol].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
          }
        }

        if (mapped.title && mapped.content && mapped.content.length >= 10) {
          items.push(mapped);
        }
      }

      try {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        setResult(data);
        if (data.created > 0) {
          showToast(`${data.created} preguntas importadas — el chatbot ya las puede usar`);
        }
      } catch {
        setResult({ error: 'Error de conexión' });
      }
      setImporting(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleClearAll = async () => {
    if (!confirm('¿Seguro que quieres borrar TODO el contenido dinámico? Esto no se puede deshacer.')) return;
    // Would need a dedicated endpoint — for now just warn
    showToast('Para limpiar todo, contacta al administrador del sistema.');
  };

  const FIELDS = [
    { id: 'title', name: 'Pregunta (título)' },
    { id: 'content', name: 'Respuesta' },
    { id: 'category', name: 'Categoría' },
    { id: 'area', name: 'Área' },
    { id: 'videoUrl', name: 'URL Video' },
    { id: 'imageUrl', name: 'URL Imagen' },
    { id: '_skip', name: '— Ignorar —' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-up flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database size={20} className="text-blue-600" />
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Datos</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800">Importar Contenido</h1>
            <p className="text-slate-500 text-sm mt-1">Sube un CSV con preguntas y respuestas — el chatbot las aprende de inmediato</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/content" className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Contenido</Link>
            <Link href="/admin/training" className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Entrenar</Link>
          </div>
        </div>

        {/* Step 1: Upload */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-premium p-8 mb-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
            Sube tu archivo
          </h2>

          <label className="block w-full p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
            <FileSpreadsheet size={40} className="mx-auto text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-600">
              {file ? file.name : 'Haz clic para subir un archivo CSV'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Formato: CSV con columnas Pregunta, Respuesta, Categoría, Área
            </p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>

          {file && (
            <button onClick={() => { setFile(null); setPreview([]); setHeaders([]); setResult(null); if (fileRef.current) fileRef.current.value = ''; }} className="mt-3 text-xs text-red-500 hover:underline">
              Quitar archivo
            </button>
          )}
        </div>

        {/* Step 2: Map columns */}
        {headers.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-premium p-8 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
              Mapea las columnas
            </h2>
            <p className="text-sm text-slate-500 mb-4">Asigna cada columna de tu archivo al campo correcto. Las columnas reconocidas se mapean automáticamente.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                  <span className="text-xs font-bold text-slate-600 min-w-[120px] truncate" title={h}>{h}</span>
                  <span className="text-slate-300">→</span>
                  <select
                    value={mapping[h] || '_skip'}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium ${
                      mapping[h] && mapping[h] !== '_skip'
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {FIELDS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-premium p-8 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">3</span>
              Vista previa ({preview.length} de las primeras filas)
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {headers.filter((h) => mapping[h] && mapping[h] !== '_skip').map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">{mapping[h]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {headers.filter((h) => mapping[h] && mapping[h] !== '_skip').map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleImport}
                disabled={importing || !mapping[headers.find((h) => mapping[h] === 'title') || ''] || !mapping[headers.find((h) => mapping[h] === 'content') || '']}
                className="px-8 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {importing ? 'Importando...' : 'Importar todo'}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-3xl border p-8 ${result.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            {result.error ? (
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-red-500" />
                <p className="text-red-700 font-medium">{result.error}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={24} className="text-green-500" />
                  <p className="text-green-700 font-bold text-lg">Importación completa</p>
                </div>
                <p className="text-green-600">
                  Se importaron <strong>{result.created}</strong> preguntas nuevas.
                  {result.errors > 0 && <span className="text-amber-600"> ({result.errors} filas ignoradas por datos faltantes)</span>}
                </p>
                <p className="text-green-500 text-sm mt-2">El chatbot ya puede usar este contenido para responder preguntas de los alumnos.</p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-premium p-8 mt-6">
          <h3 className="font-bold text-slate-800 mb-4">Formato del archivo</h3>
          <div className="text-sm text-slate-600 space-y-3">
            <p>El archivo debe ser un <strong>CSV</strong> (valores separados por comas) con al menos estas columnas:</p>
            <div className="bg-slate-50 rounded-xl p-4 font-mono text-xs">
              <p className="text-slate-400 mb-1"># Mínimo necesario:</p>
              <p>Pregunta, Respuesta</p>
              <p className="text-slate-400 mt-3 mb-1"># Completo:</p>
              <p>Pregunta, Respuesta, Categoria, Area, URL_Youtube, URL_Imagen</p>
            </div>
            <p>Los nombres de columna se reconocen automáticamente. Si tu archivo tiene nombres diferentes, puedes mapearlos manualmente en el paso 2.</p>
            <p><strong>Tip:</strong> Si tienes un Excel (.xlsx), ábrelo en Excel y haz "Guardar como → CSV UTF-8".</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
