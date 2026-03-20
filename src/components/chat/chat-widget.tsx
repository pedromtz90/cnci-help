'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, GraduationCap, Loader2, ExternalLink, Ticket, FileText } from 'lucide-react';
import type { ChatResponse, ChatHistoryItem } from '@/types/content';
import { TicketForm } from '@/components/tickets/ticket-form';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatResponse['metadata'];
  sources?: ChatResponse['sources'];
  suggestedActions?: ChatResponse['suggestedActions'];
}

const QUICK_SUGGESTIONS = [
  '¿Cómo entro a Blackboard?',
  '¿Cómo solicito una constancia?',
  '¿Cuáles son los métodos de pago?',
  '¿Qué necesito para titularme?',
  '¿Cómo restablezco mi contraseña?',
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setShowPulse(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatHistoryItem[] = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          mode: 'help',
          locale: 'es',
          history,
        }),
      });

      const data: ChatResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          metadata: data.metadata,
          sources: data.sources,
          suggestedActions: data.suggestedActions,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Ocurrió un error. Por favor intenta de nuevo.',
          metadata: { source: 'fallback', confidence: 'low', mode: 'help', processingMs: 0 },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case 'faq': return { text: 'Base de Conocimientos', color: 'bg-green-50 text-green-600' };
      case 'retrieval': return { text: 'Artículo encontrado', color: 'bg-blue-50 text-cnci-blue' };
      case 'llm': return { text: 'IA Asistente', color: 'bg-purple-50 text-purple-600' };
      default: return { text: 'Sugerencia', color: 'bg-amber-50 text-amber-600' };
    }
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente virtual'}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-cnci-blue to-cnci-navy text-white shadow-2xl hover:shadow-[0_8px_30px_rgba(37,99,235,0.4)] hover:scale-110 transition-all duration-300 flex items-center justify-center"
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
        {showPulse && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-cnci-accent rounded-full animate-pulse border-2 border-white" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] max-sm:inset-0 max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:max-w-full animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-white rounded-3xl max-sm:rounded-none shadow-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ height: 'min(560px, calc(100vh - 7rem))' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-cnci-blue to-cnci-navy px-6 py-4 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <GraduationCap size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm">Asistente CNCI</h4>
                <p className="text-blue-200 text-xs">Servicios Estudiantiles</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white transition-colors p-1 sm:hidden"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
              {/* Welcome */}
              {messages.length === 0 && (
                <>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] text-sm text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-800 mb-1">¡Hola! Soy tu Asistente Virtual CNCI</p>
                    <p>Puedo ayudarte con dudas sobre plataformas, trámites, pagos, titulación y más. ¿En qué te puedo orientar?</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-xs bg-blue-50 text-cnci-blue px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors font-medium border border-blue-100"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                  {msg.role === 'user' ? (
                    <div className="bg-cnci-blue text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="space-y-2 max-w-[90%]">
                      <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {msg.content}
                      </div>

                      {/* Source badge */}
                      {msg.metadata?.source && (
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-medium ${sourceLabel(msg.metadata.source).color}`}>
                          {sourceLabel(msg.metadata.source).text}
                        </span>
                      )}

                      {/* Sources links */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, j) => (
                            <a
                              key={j}
                              href={`/help/${src.category}/${src.slug}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-cnci-blue hover:underline"
                            >
                              <ExternalLink size={10} />
                              {src.title}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedActions.map((action, j) => (
                            <a
                              key={j}
                              href={action.href || '#'}
                              target={action.href?.startsWith('http') ? '_blank' : undefined}
                              rel={action.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className="text-[11px] font-bold bg-cnci-blue/5 text-cnci-blue px-2.5 py-1 rounded-lg border border-cnci-blue/10 hover:bg-cnci-blue/10 transition-colors"
                            >
                              {action.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs">Buscando respuesta...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Ticket form overlay inside chat */}
            {showTicketForm && (
              <div className="absolute inset-0 bg-white z-20 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 text-sm">Crear solicitud de soporte</h4>
                  <button onClick={() => setShowTicketForm(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
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
                      content: `Tu solicitud ha sido creada con folio **${folio}**. Puedes dar seguimiento en la sección "Mis Solicitudes".`,
                      metadata: { source: 'fallback', confidence: 'high', mode: 'help', processingMs: 0 },
                      suggestedActions: [{ type: 'link', label: 'Ver mis tickets', href: '/tickets' }],
                    }]);
                  }}
                  onCancel={() => setShowTicketForm(false)}
                />
              </div>
            )}

            {/* Input + escalation */}
            <div className="border-t border-slate-100 p-4 shrink-0 bg-white">
              {/* Quick actions bar */}
              {messages.length > 0 && !showTicketForm && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setShowTicketForm(true)}
                    className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors flex items-center gap-1.5"
                  >
                    <Ticket size={12} /> Crear ticket
                  </button>
                  <a
                    href="/tickets"
                    className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-cnci-blue hover:border-blue-200 transition-colors flex items-center gap-1.5"
                  >
                    <FileText size={12} /> Mis solicitudes
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
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/30 focus:border-cnci-blue transition-all disabled:opacity-50"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="w-11 h-11 rounded-xl bg-cnci-blue text-white flex items-center justify-center hover:bg-cnci-dark transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label="Enviar"
                >
                  <Send size={16} />
                </button>
              </form>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                Respuestas basadas en el Centro de Ayuda CNCI
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
