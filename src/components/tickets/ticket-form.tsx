'use client';

import { useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';

interface TicketFormProps {
  prefill?: {
    category?: string;
    subject?: string;
    chatContext?: string;
    relatedArticles?: string[];
  };
  onSuccess?: (folio: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function TicketForm({ prefill, onSuccess, onCancel, compact }: TicketFormProps) {
  const [form, setForm] = useState({
    studentName: '',
    studentId: '',
    studentEmail: '',
    category: prefill?.category || '',
    subject: prefill?.subject || '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');

  const categories = [
    { id: 'plataformas', name: 'Plataformas y Accesos' },
    { id: 'pagos', name: 'Pagos y Becas' },
    { id: 'inscripcion', name: 'Inscripción' },
    { id: 'tramites', name: 'Trámites y Constancias' },
    { id: 'titulacion', name: 'Titulación' },
    { id: 'soporte', name: 'Soporte Técnico' },
    { id: 'academico', name: 'Vida Académica' },
    { id: 'otro', name: 'Otro' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          channel: prefill?.chatContext ? 'chat' : 'manual',
          chatContext: prefill?.chatContext,
          relatedArticles: prefill?.relatedArticles,
        }),
      });

      if (!res.ok) throw new Error('Error al crear ticket');

      const data = await res.json();
      setSuccess(data.ticket.folio);
      onSuccess?.(data.ticket.folio);
    } catch {
      setError('No pudimos crear tu solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`text-center ${compact ? 'py-4' : 'py-8'}`}>
        <CheckCircle className="mx-auto text-green-500 mb-3" size={compact ? 32 : 48} />
        <h3 className={`font-bold text-slate-800 ${compact ? 'text-sm' : 'text-lg'}`}>
          Solicitud creada
        </h3>
        <p className="text-slate-500 text-sm mt-1">
          Tu folio es: <span className="font-mono font-bold text-cnci-blue">{success}</span>
        </p>
        <p className="text-slate-400 text-xs mt-2">
          Guarda este folio para dar seguimiento.
        </p>
      </div>
    );
  }

  const inputClass = `w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/30 focus:border-cnci-blue transition-all ${compact ? 'text-xs py-2' : ''}`;
  const labelClass = `block text-xs font-bold text-slate-500 mb-1 ${compact ? 'text-[10px]' : ''}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Nombre completo *</label>
          <input required value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} className={inputClass} placeholder="Tu nombre" />
        </div>
        <div>
          <label className={labelClass}>Matrícula *</label>
          <input required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className={inputClass} placeholder="Ej. A12345" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Correo electrónico *</label>
        <input required type="email" value={form.studentEmail} onChange={(e) => setForm({ ...form, studentEmail: e.target.value })} className={inputClass} placeholder="tu@correo.com" />
      </div>

      <div>
        <label className={labelClass}>Categoría *</label>
        <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
          <option value="">Selecciona...</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className={labelClass}>Asunto *</label>
        <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} placeholder="Resumen breve de tu duda" />
      </div>

      <div>
        <label className={labelClass}>Descripción *</label>
        <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} min-h-[80px] resize-y`} placeholder="Describe tu situación con detalle..." />
      </div>

      {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-slate-500 text-sm font-semibold hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-cnci-blue text-white text-sm font-bold hover:bg-cnci-dark transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </div>
    </form>
  );
}
