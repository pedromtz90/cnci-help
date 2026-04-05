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
    <section className="hero-gradient text-white py-16 md:py-24 px-6 relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
          ¿Cómo podemos ayudarte?
        </h1>
        <p className="text-blue-100 text-base md:text-lg mb-10 opacity-90 font-light px-4">
          Encuentra respuestas sobre plataformas, constancias, titulación y servicios universitarios
        </p>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto relative px-2">
          <Search size={20} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe tu pregunta aquí..."
            aria-label="Buscar"
            className="w-full pl-14 pr-6 py-5 rounded-2xl border-0 shadow-2xl focus:ring-4 focus:ring-blue-400/30 outline-none text-gray-800 text-base transition-all"
          />
        </form>
      </div>
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-white/[0.03] rounded-full" />
        <div className="absolute -bottom-40 -left-20 w-96 h-96 bg-white/[0.02] rounded-full" />
      </div>
    </section>
  );
}
