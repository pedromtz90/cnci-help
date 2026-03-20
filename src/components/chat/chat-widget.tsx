'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, ArrowRight, Ticket, FileText } from 'lucide-react';
import type { ChatResponse, ChatHistoryItem } from '@/types/content';
import { TicketForm } from '@/components/tickets/ticket-form';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatResponse['metadata'];
  sources?: ChatResponse['sources'];
  suggestedActions?: ChatResponse['suggestedActions'];
}

const SUGGESTIONS = [
  '¿Cómo entro a Blackboard?',
  '¿Cómo pago mi mensualidad?',
  '¿Cómo solicito una constancia?',
  '¿Cómo restablezco mi contraseña?',
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (isOpen) { setShowPulse(false); setTimeout(() => inputRef.current?.focus(), 150); } }, [isOpen]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatHistoryItem[] = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), mode: 'help', locale: 'es', history }),
      });
      const data: ChatResponse = await res.json();
      setMessages((prev) => [...prev, {
        role: 'assistant', content: data.content, metadata: data.metadata,
        sources: data.sources, suggestedActions: data.suggestedActions,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error al consultar. Intenta de nuevo.' }]);
    } finally { setLoading(false); }
  }, [loading, messages]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };

  return (
    <>
      {/* Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-cnci-navy text-white shadow-lg hover:bg-cnci-dark transition-colors flex items-center justify-center"
      >
        {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        {showPulse && !isOpen && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] max-sm:inset-0 max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:max-w-full animate-fade-up">
          <div className="bg-white rounded-xl max-sm:rounded-none shadow-xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: 'min(500px, calc(100vh - 6rem))' }}>

            {/* Header */}
            <div className="bg-cnci-navy px-4 py-3 flex items-center justify-between shrink-0">
              <div>
                <p className="text-white text-sm font-medium">Asistente CNCI</p>
                <p className="text-blue-300/60 text-[10px]">Servicios Estudiantiles</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white sm:hidden"><X size={16} /></button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
              {messages.length === 0 && (
                <>
                  <div className="bg-slate-50 rounded-lg px-3.5 py-3 text-[13px] text-slate-600 leading-relaxed max-w-[88%]">
                    Hola, soy el asistente del Centro de Ayuda. ¿En qué te puedo orientar?
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="text-[11px] text-cnci-navy bg-cnci-navy/[0.04] hover:bg-cnci-navy/[0.08] px-2.5 py-1.5 rounded-md transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                  {msg.role === 'user' ? (
                    <div className="bg-cnci-navy text-white rounded-lg rounded-br-sm px-3.5 py-2.5 max-w-[85%] text-[13px] leading-relaxed">{msg.content}</div>
                  ) : (
                    <div className="max-w-[90%] space-y-1.5">
                      <div className="bg-slate-50 rounded-lg rounded-tl-sm px-3.5 py-2.5 text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{msg.content}</div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.slice(0, 2).map((src, j) => (
                            <a key={j} href={`/help/${src.category}/${src.slug}`} className="text-[10px] text-cnci-navy hover:underline flex items-center gap-0.5">
                              <ArrowRight size={9} /> {src.title.slice(0, 40)}
                            </a>
                          ))}
                        </div>
                      )}
                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.suggestedActions.slice(0, 2).map((a, j) => (
                            <a key={j} href={a.href || '#'} target={a.href?.startsWith('http') ? '_blank' : undefined} className="text-[10px] text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors">
                              {a.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Loader2 size={12} className="animate-spin" /> Buscando...
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Ticket form overlay */}
            {showTicketForm && (
              <div className="absolute inset-0 bg-white z-20 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-800">Crear solicitud</p>
                  <button onClick={() => setShowTicketForm(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                </div>
                <TicketForm
                  compact
                  prefill={{
                    chatContext: messages.map((m) => `${m.role}: ${m.content}`).join('\n').slice(-1000),
                    subject: messages.find((m) => m.role === 'user')?.content.slice(0, 100),
                  }}
                  onSuccess={(folio) => {
                    setShowTicketForm(false);
                    setMessages((prev) => [...prev, {
                      role: 'assistant',
                      content: `Solicitud creada con folio ${folio}. Puedes dar seguimiento en "Mis solicitudes".`,
                      suggestedActions: [{ type: 'link' as const, label: 'Ver solicitudes', href: '/tickets' }],
                    }]);
                  }}
                  onCancel={() => setShowTicketForm(false)}
                />
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-100 p-3 shrink-0">
              {messages.length > 0 && !showTicketForm && (
                <div className="flex gap-1.5 mb-2">
                  <button onClick={() => setShowTicketForm(true)} className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1 transition-colors">
                    <Ticket size={10} /> Crear ticket
                  </button>
                  <a href="/tickets" className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1 transition-colors">
                    <FileText size={10} /> Solicitudes
                  </a>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu pregunta..."
                  disabled={loading}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-cnci-navy/20 focus:border-cnci-navy/30 disabled:opacity-50 transition-all"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-lg bg-cnci-navy text-white flex items-center justify-center hover:bg-cnci-dark disabled:opacity-30 transition-colors shrink-0"
                  aria-label="Enviar"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
