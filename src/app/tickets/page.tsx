'use client';

import { useState } from 'react';
import { Search, Clock, MessageCircle, CheckCircle2, AlertCircle, ArrowRight, Send, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ChatWidget } from '@/components/chat/chat-widget';
import { TicketForm } from '@/components/tickets/ticket-form';
import type { Ticket, TicketStatus } from '@/types/content';

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: any }> = {
  open: { label: 'Abierto', color: 'bg-blue-50 text-blue-600', icon: AlertCircle },
  in_review: { label: 'En revisión', color: 'bg-amber-50 text-amber-600', icon: Clock },
  waiting_student: { label: 'Esperando respuesta', color: 'bg-purple-50 text-purple-600', icon: MessageCircle },
  resolved: { label: 'Resuelto', color: 'bg-green-50 text-green-600', icon: CheckCircle2 },
  closed: { label: 'Cerrado', color: 'bg-slate-100 text-slate-500', icon: CheckCircle2 },
};

export default function TicketsPage() {
  const [view, setView] = useState<'lookup' | 'create' | 'detail'>('lookup');
  const [folio, setFolio] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const lookupTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tickets?folio=${encodeURIComponent(folio.trim())}`);
      if (!res.ok) throw new Error('No encontrado');
      const data = await res.json();
      setTicket(data.ticket);
      setView('detail');
    } catch {
      setError('No se encontró un ticket con ese folio. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !ticket) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          message: replyText.trim(),
          author: ticket.studentName,
          authorType: 'student',
        }),
      });
      const data = await res.json();
      setTicket(data.ticket);
      setReplyText('');
    } catch {
      setError('Error al enviar tu mensaje.');
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        {/* Header */}
        <div className="bg-gradient-to-br from-cnci-navy to-cnci-navy-deep py-16 px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Mis Solicitudes
          </h1>
          <p className="text-blue-200 mt-2 font-medium max-w-lg mx-auto">
            Consulta el estado de tus tickets o crea uno nuevo si necesitas ayuda.
          </p>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* Tab selector */}
          {view !== 'detail' && (
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border mb-8">
              <button
                onClick={() => setView('lookup')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${view === 'lookup' ? 'bg-cnci-blue text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Consultar ticket
              </button>
              <button
                onClick={() => setView('create')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${view === 'create' ? 'bg-cnci-blue text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Nueva solicitud
              </button>
            </div>
          )}

          {/* Lookup view */}
          {view === 'lookup' && (
            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-8">
              <h2 className="font-bold text-slate-800 text-lg mb-2">Buscar por folio</h2>
              <p className="text-slate-500 text-sm mb-6">Ingresa el folio que recibiste al crear tu solicitud.</p>
              <form onSubmit={lookupTicket} className="flex gap-3">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    placeholder="Ej. CNCI-2603-1234"
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/30 focus:border-cnci-blue"
                  />
                </div>
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-cnci-blue text-white font-bold text-sm hover:bg-cnci-dark transition-colors shadow-md disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Buscar
                </button>
              </form>
              {error && <p className="text-red-500 text-sm mt-4 font-medium">{error}</p>}
            </div>
          )}

          {/* Create view */}
          {view === 'create' && (
            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-8">
              <h2 className="font-bold text-slate-800 text-lg mb-2">Nueva solicitud de soporte</h2>
              <p className="text-slate-500 text-sm mb-6">Completa el formulario y te asignaremos un folio para seguimiento.</p>
              <TicketForm
                onSuccess={(f) => {
                  setFolio(f);
                  setTimeout(() => {
                    setView('lookup');
                  }, 3000);
                }}
              />
            </div>
          )}

          {/* Detail view */}
          {view === 'detail' && ticket && (
            <div className="space-y-6">
              <button onClick={() => { setView('lookup'); setTicket(null); }} className="text-sm text-cnci-blue font-medium hover:underline">
                ← Volver a buscar
              </button>

              {/* Ticket header */}
              <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-xs font-mono text-slate-400">{ticket.folio}</span>
                    <h2 className="font-bold text-slate-800 text-lg mt-1">{ticket.subject}</h2>
                  </div>
                  {(() => {
                    const cfg = STATUS_CONFIG[ticket.status];
                    const Icon = cfg.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.color}`}>
                        <Icon size={14} />
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-400 text-xs font-bold">Categoría</span><p className="text-slate-700 font-medium">{ticket.category}</p></div>
                  <div><span className="text-slate-400 text-xs font-bold">Prioridad</span><p className="text-slate-700 font-medium capitalize">{ticket.priority}</p></div>
                  <div><span className="text-slate-400 text-xs font-bold">Creado</span><p className="text-slate-700 font-medium">{new Date(ticket.createdAt).toLocaleDateString('es-MX')}</p></div>
                  <div><span className="text-slate-400 text-xs font-bold">Última actualización</span><p className="text-slate-700 font-medium">{new Date(ticket.updatedAt).toLocaleDateString('es-MX')}</p></div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="text-slate-400 text-xs font-bold">Descripción</span>
                  <p className="text-slate-600 text-sm mt-1 leading-relaxed">{ticket.description}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-8">
                <h3 className="font-bold text-slate-800 mb-4">Conversación</h3>

                {ticket.messages.length === 0 ? (
                  <p className="text-slate-400 text-sm italic py-4">No hay mensajes todavía. El equipo de soporte responderá pronto.</p>
                ) : (
                  <div className="space-y-4">
                    {ticket.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.authorType === 'student' ? 'justify-end' : ''}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                          msg.authorType === 'student'
                            ? 'bg-cnci-blue text-white rounded-br-md'
                            : msg.authorType === 'system'
                              ? 'bg-slate-50 text-slate-500 italic text-xs'
                              : 'bg-slate-100 text-slate-700 rounded-bl-md'
                        }`}>
                          <p className="text-[10px] font-bold mb-1 opacity-70">{msg.author}</p>
                          <p className="leading-relaxed">{msg.content}</p>
                          <p className="text-[10px] mt-1 opacity-50">{new Date(msg.createdAt).toLocaleString('es-MX')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply */}
                {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                  <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cnci-blue/30"
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
                    />
                    <button onClick={sendReply} disabled={replying || !replyText.trim()} className="px-4 py-2.5 rounded-xl bg-cnci-blue text-white hover:bg-cnci-dark transition-colors disabled:opacity-50">
                      {replying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
