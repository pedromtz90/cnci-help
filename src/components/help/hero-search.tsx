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
    <section className="bg-cnci-navy hero-texture">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
        <h2 className="text-white text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
          ¿En qué podemos ayudarte?
        </h2>
        <p className="text-blue-200/60 mt-2 text-sm max-w-md mx-auto">
          Busca respuestas sobre plataformas, trámites, pagos, titulación y más.
        </p>

        <form onSubmit={handleSubmit} className="relative mt-8 max-w-lg mx-auto">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe tu pregunta..."
            aria-label="Buscar"
            className="w-full pl-11 pr-4 py-3.5 rounded-lg text-sm text-slate-800 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-white/30 placeholder-slate-400 border-0"
          />
        </form>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {['Blackboard', 'Pagos', 'Constancias', 'Contraseña', 'Titulación'].map((tag) => (
            <button
              key={tag}
              onClick={() => { setQuery(tag); router.push(`/help?q=${encodeURIComponent(tag)}`); }}
              className="text-[11px] text-blue-200/50 hover:text-blue-100 bg-white/[0.06] hover:bg-white/[0.1] px-2.5 py-1 rounded-md transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
