'use client';

import { useState, useEffect } from 'react';
import { Search, ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import type { SearchResult, ContentMeta } from '@/types/content';

const CATEGORY_NAMES: Record<string, { name: string; desc: string }> = {
  plataformas: { name: 'Plataformas y Accesos', desc: 'Blackboard, Office 365, Biblioteca Virtual' },
  pagos: { name: 'Pagos y Becas', desc: 'Métodos de pago, facturación, becas y descuentos' },
  inscripcion: { name: 'Inscripción y Registro', desc: 'Proceso de inscripción, requisitos, cambios y bajas' },
  tramites: { name: 'Trámites y Constancias', desc: 'Constancias, certificados, credenciales y documentos' },
  titulacion: { name: 'Titulación', desc: 'Requisitos de titulación, proceso y documentos' },
  soporte: { name: 'Soporte Técnico', desc: 'Problemas técnicos, accesos bloqueados y errores' },
  academico: { name: 'Vida Académica', desc: 'Materias, horarios, calificaciones, historial' },
  contacto: { name: 'Contacto y Directorio', desc: 'Departamentos, áreas de atención' },
};

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.category as string;
  const category = CATEGORY_NAMES[categoryId] || { name: categoryId, desc: '' };

  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState<ContentMeta[]>([]);
  const [filtered, setFiltered] = useState<ContentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all FAQs for this category
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/search?q=*&category=${categoryId}&limit=50`);
        const data = await res.json();
        // Also do a broad search to get all items in category
        const res2 = await fetch(`/api/search?q=${categoryId}&limit=50`);
        const data2 = await res2.json();

        // Merge and deduplicate
        const map = new Map<string, ContentMeta>();
        [...(data.results || []), ...(data2.results || [])].forEach((r: SearchResult) => {
          if (r.item.category === categoryId) map.set(r.item.id, r.item);
        });
        const items = [...map.values()];
        setAllResults(items);
        setFiltered(items);
      } catch {
        setAllResults([]);
        setFiltered([]);
      }
      setLoading(false);
    })();
  }, [categoryId]);

  // Filter by search query
  useEffect(() => {
    if (!query.trim()) {
      setFiltered(allResults);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(
      allResults.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        (item.excerpt || '').toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)),
      ),
    );
  }, [query, allResults]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-grow">
        {/* Header */}
        <div className="bg-gradient-to-br from-cnci-navy to-cnci-navy-deep py-14 px-6">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm font-medium mb-5 transition-colors"
            >
              <ChevronLeft size={16} />
              Centro de Ayuda
            </Link>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              {category.name}
            </h1>
            <p className="text-blue-200 mt-2 font-medium">
              {category.desc}
            </p>

            {/* Search within category */}
            <div className="relative mt-6 max-w-xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Buscar en ${category.name}...`}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/95 text-slate-800 text-sm focus:outline-none focus:ring-4 focus:ring-white/20 shadow-lg placeholder-slate-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-10">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-cnci-blue" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Search size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">
                {query ? `No hay resultados para "${query}" en esta categoría` : 'No hay artículos en esta categoría todavía'}
              </p>
              {query && (
                <button onClick={() => setQuery('')} className="mt-3 text-sm text-cnci-blue font-semibold hover:underline">
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-6">
                {filtered.length} pregunta{filtered.length !== 1 ? 's' : ''}
                {query && <> para <span className="font-semibold text-slate-700">"{query}"</span></>}
              </p>
              <div className="space-y-3">
                {filtered.map((faq) => (
                  <FaqCard key={faq.id} faq={faq} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
