'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, AlertCircle, CheckCircle2, XCircle, MessageCircle,
  Loader2, RefreshCw, Send, Trash2, TrendingUp, HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Navbar } from '@/components/layout/navbar';

interface GapItem {
  id: number;
  query: string;
  confidence: string;
  source: string;
  times_asked: number;
  status: string;
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

export default function TrainingPage() {
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('soporte');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'ignored'>('pending');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gaps?status=${filter}&limit=100`);
      const data = await res.json();
      setGaps(data.items || []);
      setTotal(data.total || 0);
    } catch { setGaps([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: number) => {
    if (!answer.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', id, answer: answer.trim(), category }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Respuesta guardada — el chatbot ya la puede usar');
        setActiveId(null);
        setAnswer('');
        load();
      } else {
        showToast(data.error || 'Error al guardar');
      }
    } catch {
      showToast('Error de conexión');
    }
    setSaving(false);
  };

  const handleIgnore = async (id: number) => {
    await fetch('/api/gaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore', id }),
    });
    load();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-semibold animate-fade-up flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={20} className="text-blue-600" />
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Entrenamiento</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800">Enseñar al Chatbot</h1>
            <p className="text-slate-500 text-sm mt-1">
              Preguntas que el chatbot no pudo responder.
              <span className="font-bold text-orange-500 ml-1">{total} pendientes</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/content" className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
              Contenido
            </Link>
            <Link href="/admin" className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
              Dashboard
            </Link>
            <button onClick={load} className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-blue-600">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border mb-6 w-fit">
          {[
            { id: 'pending' as const, label: 'Pendientes', icon: AlertCircle, color: 'text-orange-500' },
            { id: 'resolved' as const, label: 'Resueltas', icon: CheckCircle2, color: 'text-green-500' },
            { id: 'ignored' as const, label: 'Ignoradas', icon: XCircle, color: 'text-slate-400' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-600" />
          </div>
        ) : gaps.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-premium p-12 text-center">
            {filter === 'pending' ? (
              <>
                <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-2">Todo al día</h3>
                <p className="text-slate-500">No hay preguntas pendientes por responder. El chatbot está contestando bien.</p>
              </>
            ) : (
              <>
                <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No hay preguntas en esta categoría.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {gaps.map((gap) => (
              <div key={gap.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle size={14} className="text-blue-500 shrink-0" />
                      <p className="font-bold text-slate-800 text-sm">"{gap.query}"</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={10} />
                        Preguntada {gap.times_asked}x
                      </span>
                      <span>{new Date(gap.updated_at).toLocaleDateString('es-MX')}</span>
                      {gap.status === 'resolved' && (
                        <span className="text-green-500 font-bold">Resuelta</span>
                      )}
                    </div>
                  </div>

                  {filter === 'pending' && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setActiveId(activeId === gap.id ? null : gap.id); setAnswer(''); }}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                          activeId === gap.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        <Brain size={12} className="inline mr-1" />
                        Enseñar
                      </button>
                      <button
                        onClick={() => handleIgnore(gap.id)}
                        className="px-3 py-2 text-xs font-bold text-slate-400 bg-slate-50 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Ignorar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Teach form */}
                {activeId === gap.id && filter === 'pending' && (
                  <div className="border-t border-slate-100 p-5 bg-blue-50/30 animate-fade-up">
                    <p className="text-xs font-bold text-slate-500 mb-3">
                      Escribe la respuesta que debería dar el chatbot cuando pregunten esto:
                    </p>
                    <div className="space-y-3">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700"
                      >
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Escribe la respuesta completa que el chatbot debería dar..."
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-h-[120px] resize-y"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setActiveId(null)}
                          className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleResolve(gap.id)}
                          disabled={saving || !answer.trim()}
                          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md disabled:opacity-50 flex items-center gap-2"
                        >
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Guardar y enseñar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
