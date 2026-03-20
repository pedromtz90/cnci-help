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
    <section className="relative w-full bg-gradient-to-br from-cnci-navy via-[#00398a] to-cnci-navy-deep pt-24 pb-36 px-6 text-center overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40" />

      {/* Floating orbs */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute top-20 -right-10 w-96 h-96 bg-cnci-accent/15 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto">
        <h2 className="font-black text-4xl md:text-6xl text-white mb-4 tracking-tight leading-tight drop-shadow-md">
          ¿En qué podemos orientarte hoy?
        </h2>
        <p className="text-blue-100 mb-10 text-lg font-medium max-w-2xl mx-auto drop-shadow-sm hidden md:block">
          Encuentra respuestas rápidas sobre plataformas, constancias, titulación y servicios universitarios.
        </p>

        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto group">
          <Search
            size={22}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 z-10 transition-colors group-focus-within:text-cnci-blue"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. ¿Cómo entro a Blackboard?..."
            aria-label="Buscar en el Centro de Ayuda"
            className="w-full pl-16 pr-6 py-5 rounded-2xl shadow-2xl text-slate-800 text-lg md:text-xl focus:outline-none focus:ring-4 focus:ring-cnci-accent/50 transition-all border-none placeholder-slate-400 bg-white/95 backdrop-blur-sm"
          />
        </form>
      </div>
    </section>
  );
}
