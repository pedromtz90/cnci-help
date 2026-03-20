'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, GraduationCap, Loader2, ArrowRight, Ticket, FileText, UserCheck, Phone } from 'lucide-react';
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
  '¿Cómo solicito una constancia?',
  '¿Cuáles son los métodos de pago?',
  '¿Qué necesito para titularme?',
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (isOpen) { setShowPulse(false); setTimeout(() => inputRef.current?.focus(), 200); } }, [isOpen]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: text.trim() }]);
    setInput('');
    setLoading(true);
    try {
      const history: ChatHistoryItem[] = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), mode: 'help', locale: 'es', history }),
      });
      const data: ChatResponse = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content, metadata: data.metadata, sources: data.sources, suggestedActions: data.suggestedActions }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Ocurrió un error. Intenta de nuevo.' }]);
    } finally { setLoading(false); }
  }, [loading, messages]);

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-2xl hover:shadow-[0_8px_30px_rgba(37,99,235,0.35)] hover:scale-105 transition-all duration-300 flex items-center justify-center"
      >
        {isOpen ? <X size={22} /> : <Bot size={22} />}
        {showPulse && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] max-sm:inset-0 max-sm:bottom-0 max-sm:right-0 max-sm:w-full animate-fade-up">
          <div className="bg-white rounded-3xl max-sm:rounded-none shadow-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: 'min(540px, calc(100vh - 7rem))' }}>

            {/* Header — gradient like Rolando */}
            <div className="hero-gradient px-6 py-4 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <GraduationCap size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-white font-bold text-sm">Asistente CNCI</h4>
                <p className="text-blue-200/70 text-[10px]">Servicios Estudiantiles</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white sm:hidden transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
              {messages.length === 0 && (
                <>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] text-sm text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-800 mb-1">¡Hola!</p>
                    <p>Soy el asistente del Centro de Ayuda CNCI. ¿En qué te puedo orientar?</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="text-[11px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors font-medium border border-blue-100">
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                  {msg.role === 'user' ? (
                    <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] text-sm leading-relaxed">{msg.content}</div>
                  ) : (
                    <div className="max-w-[90%] space-y-1.5">
                      <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{msg.content}</div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.slice(0, 2).map((src, j) => (
                            <a key={j} href={`/help/${src.category}/${src.slug}`} className="text-[10px] font-medium text-blue-600 hover:underline flex items-center gap-0.5">
                              <ArrowRight size={9} /> {src.title.slice(0, 45)}
                            </a>
                          ))}
                        </div>
                      )}
                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedActions.slice(0, 2).map((a, j) => (
                            <a key={j} href={a.href || '#'} target={a.href?.startsWith('http') ? '_blank' : undefined} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100 transition-colors">
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
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Loader2 size={14} className="animate-spin" /> Buscando respuesta...
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Ticket overlay */}
            {showTicketForm && (
              <div className="absolute inset-0 bg-white z-20 overflow-y-auto p-4 rounded-3xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800">Crear solicitud</p>
                  <button onClick={() => setShowTicketForm(false)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
                </div>
                <TicketForm
                  compact
                  prefill={{ chatContext: messages.map((m) => `${m.role}: ${m.content}`).join('\n').slice(-1000), subject: messages.find((m) => m.role === 'user')?.content.slice(0, 100) }}
                  onSuccess={(folio) => { setShowTicketForm(false); setMessages((prev) => [...prev, { role: 'assistant', content: `Solicitud creada: ${folio}. Da seguimiento en "Mis solicitudes".`, suggestedActions: [{ type: 'link' as const, label: 'Ver solicitudes', href: '/tickets' }] }]); }}
                  onCancel={() => setShowTicketForm(false)}
                />
              </div>
            )}

            {/* Escalation form overlay */}
            {showEscalate && (
              <div className="absolute inset-0 bg-white z-20 overflow-y-auto p-4 rounded-3xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800">Hablar con un asesor</p>
                  <button onClick={() => setShowEscalate(false)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
                </div>
                <p className="text-xs text-slate-500 mb-4">Déjanos tus datos y un asesor te contactará. Tu conversación se transfiere completa.</p>
                <EscalateForm
                  chatHistory={messages}
                  onSuccess={(msg) => {
                    setShowEscalate(false);
                    setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
                  }}
                  onCancel={() => setShowEscalate(false)}
                />
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-slate-100 p-4 shrink-0 bg-white">
              {messages.length > 0 && !showTicketForm && !showEscalate && (
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setShowEscalate(true)} className="text-[11px] font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
                    <UserCheck size={11} /> Hablar con asesor
                  </button>
                  <button onClick={() => setShowTicketForm(true)} className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-1">
                    <Ticket size={11} /> Crear ticket
                  </button>
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu pregunta..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-all"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-30 transition-colors shadow-md shrink-0"
                  aria-label="Enviar"
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="text-[10px] text-slate-400 mt-2 text-center">Respuestas basadas en el Centro de Ayuda CNCI</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Escalation Form ─────────────────────────────────────────────────

function EscalateForm({ chatHistory, onSuccess, onCancel }: {
  chatHistory: Message[];
  onSuccess: (msg: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: name,
          studentEmail: email,
          phone: phone || undefined,
          subject: chatHistory.find((m) => m.role === 'user')?.content?.slice(0, 100) || 'Escalación desde chatbot',
          chatHistory: chatHistory.map((m) => ({ role: m.role, content: m.content })),
          category: 'soporte',
        }),
      });
      const data = await res.json();
      onSuccess(data.message || 'Tu caso fue transferido a un asesor. Te contactarán pronto por correo o WhatsApp.');
    } catch {
      onSuccess('No pudimos transferir en este momento. Contacta al 800 681 5314 (opción 4 y 5) o escribe a servicios@cncivirtual.mx');
    }
    setSending(false);
  };

  const input = "w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tu nombre *</label>
        <input required value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Nombre completo" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1">Correo electrónico *</label>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="tu@correo.com" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-500 mb-1">WhatsApp (opcional)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} placeholder="81 1234 5678" />
      </div>
      <p className="text-[10px] text-slate-400">
        Tu conversación completa se enviará al asesor para que no tengas que repetir nada.
      </p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-slate-500 text-xs font-bold hover:bg-slate-100">Cancelar</button>
        <button type="submit" disabled={sending} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
          {sending ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
          {sending ? 'Transfiriendo...' : 'Transferir a asesor'}
        </button>
      </div>
    </form>
  );
}
