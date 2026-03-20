import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { HeroSearch } from '@/components/help/hero-search';
import { CategoryGrid } from '@/components/help/category-grid';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import { loadPublishedContent, loadCategories } from '@/lib/knowledge/loader';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function HomePage() {
  const content = await loadPublishedContent();
  const categories = loadCategories();

  const topFaqs = content
    .filter((c) => c.type === 'faq' && (c.priority === 'critical' || c.priority === 'high'))
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 8);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-grow">
        <HeroSearch />

        {/* Main content area — overlaps hero like Rolando's design */}
        <div className="max-w-6xl mx-auto w-full px-4 -mt-16 relative z-10 pb-20">

          {/* Categories carousel */}
          <section className="mb-12">
            <CategoryGrid categories={categories} />
          </section>

          {/* Top FAQs */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                  Preguntas frecuentes
                </h2>
                <p className="text-slate-500 font-medium mt-1">
                  Las dudas más comunes de nuestros alumnos
                </p>
              </div>
              <Link href="/help/plataformas" className="hidden sm:flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-4">
              {topFaqs.map((faq) => (
                <FaqCard key={faq.id} faq={faq} />
              ))}
            </div>
          </section>

          {/* Directory section */}
          <section className="mt-24 mb-10">
            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-8 md:p-12 text-center overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-bl-full -z-0" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-tr-full -z-0" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mb-6 shadow-sm border border-blue-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-4 tracking-tight">Directorio CNCI</h2>
                <p className="text-slate-500 mb-10 max-w-2xl mx-auto font-medium text-lg">
                  Encuentra rápidamente la información de contacto de nuestros departamentos.
                </p>
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white">
                  <img
                    src="/directorio-cnci.png"
                    alt="Directorio de Departamentos"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center py-8">
            <p className="text-slate-400 font-medium mb-4">¿No encontraste lo que buscas?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/tickets" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold text-sm px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                Crear solicitud de soporte
              </Link>
              <a href="mailto:servicios@cncivirtual.mx" className="inline-flex items-center justify-center gap-2 text-slate-600 font-bold text-sm px-8 py-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                Escribir por correo
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
