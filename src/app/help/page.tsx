'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import type { SearchResult } from '@/types/content';

export default function HelpSearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50"><Navbar /></div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(!!initialQuery);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
    setSearched(true);
  };

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-grow">
        <div className="bg-gradient-to-br from-cnci-navy to-cnci-navy-deep py-12 px-6">
          <div className="max-w-3xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm font-medium mb-4 transition-colors">
              <ArrowLeft size={14} /> Centro de Ayuda
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-6">Buscar en el Centro de Ayuda</h1>

            <form onSubmit={handleSubmit} className="relative">
              <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe tu pregunta..."
                autoFocus
                className="w-full pl-14 pr-5 py-4 rounded-2xl shadow-2xl text-slate-800 text-base focus:outline-none focus:ring-4 focus:ring-white/20 border-none bg-white"
              />
            </form>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-cnci-blue" />
            </div>
          ) : searched && results.length === 0 ? (
            <div className="text-center py-16">
              <Search size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No encontramos resultados para "{initialQuery || query}"</p>
              <p className="text-slate-400 text-sm mt-2">Intenta con otras palabras o revisa las categorías.</p>
              <Link href="/" className="inline-block mt-4 text-sm font-semibold text-cnci-blue hover:underline">
                Ver todas las categorías
              </Link>
            </div>
          ) : results.length > 0 ? (
            <>
              <p className="text-sm text-slate-500 mb-6">
                {results.length} resultado{results.length !== 1 ? 's' : ''} para <span className="font-semibold text-slate-700">"{initialQuery || query}"</span>
              </p>
              <div className="space-y-3">
                {results.map((r) => (
                  <FaqCard key={r.item.id} faq={r.item} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
