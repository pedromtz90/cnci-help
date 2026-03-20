import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { HeroSearch } from '@/components/help/hero-search';
import { CategoryGrid } from '@/components/help/category-grid';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import { loadPublishedContent, loadCategories } from '@/lib/knowledge/loader';

export default async function HomePage() {
  const content = await loadPublishedContent();
  const categories = loadCategories();

  // Top FAQs: critical + high priority, sorted
  const topFaqs = content
    .filter((c) => c.type === 'faq' && (c.priority === 'critical' || c.priority === 'high'))
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 8);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        <HeroSearch />

        {/* Categories + FAQs */}
        <div className="max-w-6xl mx-auto w-full px-4 -mt-16 relative z-10 pb-20">
          {/* Categories */}
          <section className="mb-16">
            <CategoryGrid categories={categories} />
          </section>

          {/* Top FAQs */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                  Preguntas frecuentes
                </h2>
                <p className="text-slate-500 font-medium mt-1">
                  Las dudas más comunes de nuestros alumnos
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {topFaqs.map((faq) => (
                <FaqCard key={faq.id} faq={faq} />
              ))}
            </div>
          </section>

          {/* Directory section */}
          <section className="mt-24 mb-10">
            <div className="bg-white rounded-4xl shadow-premium border border-slate-100 p-8 md:p-12 text-center overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-tr-full" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-cnci-blue mb-6 shadow-sm border border-blue-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 tracking-tight">
                  Directorio CNCI
                </h2>
                <p className="text-slate-500 mb-10 max-w-2xl mx-auto font-medium text-lg">
                  Encuentra la información de contacto de nuestros departamentos.
                </p>
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white">
                  <img
                    src="https://i.ibb.co/RF36Vz7/Directorios-Departamentos-1.png"
                    alt="Directorio de Departamentos CNCI"
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}
