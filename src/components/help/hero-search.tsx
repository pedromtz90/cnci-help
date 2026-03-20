'use client';

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function HeroSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      router.push(`/help?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router]);

  return (
    <section className="relative w-full bg-gradient-to-br from-cnci-navy via-[#003a95] to-cnci-navy-deep pt-20 pb-28 px-6 text-center overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />

      {/* Glows */}
      <div className="absolute -top-32 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-[100px] animate-float pointer-events-none" />
      <div className="absolute -bottom-20 right-1/4 w-80 h-80 bg-cnci-accent/10 rounded-full blur-[80px] animate-float-delayed pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-blue-200 text-xs font-medium">Centro de Ayuda disponible 24/7</span>
        </div>

        <h2 className="font-black text-3xl sm:text-4xl md:text-5xl text-white mb-4 tracking-tight leading-[1.15]">
          ¿En qué podemos<br className="hidden sm:block" /> orientarte hoy?
        </h2>

        <p className="text-blue-200/80 mb-8 text-base font-medium max-w-xl mx-auto hidden sm:block">
          Busca respuestas sobre plataformas, trámites, pagos, titulación y más.
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
          <Search
            size={20}
            className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 z-10 transition-colors group-focus-within:text-cnci-blue"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe tu pregunta..."
            aria-label="Buscar en el Centro de Ayuda"
            className="w-full pl-14 pr-5 py-4 rounded-2xl shadow-2xl shadow-black/10 text-slate-800 text-base focus:outline-none focus:ring-4 focus:ring-white/20 transition-all border-none placeholder-slate-400 bg-white"
          />
        </form>

        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {['Blackboard', 'Pagos', 'Constancias', 'Contraseña'].map((tag) => (
            <button
              key={tag}
              onClick={() => { setQuery(tag); }}
              className="text-xs font-medium text-blue-200/70 bg-white/8 hover:bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
