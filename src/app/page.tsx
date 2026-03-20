import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { HeroSearch } from '@/components/help/hero-search';
import { CategoryGrid } from '@/components/help/category-grid';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import { loadPublishedContent, loadCategories } from '@/lib/knowledge/loader';
import { BookOpen, Headphones, GraduationCap, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-grow">
        <HeroSearch />

        {/* Quick access strip */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: BookOpen, title: 'Guías rápidas', desc: 'Paso a paso para trámites', href: '/help/tramites', color: 'from-blue-500 to-blue-600' },
                { icon: Headphones, title: 'Soporte técnico', desc: 'Blackboard, Office 365, accesos', href: '/help/soporte', color: 'from-violet-500 to-violet-600' },
                { icon: GraduationCap, title: 'Titulación', desc: 'Requisitos y proceso completo', href: '/help/titulacion', color: 'from-amber-500 to-amber-600' },
              ].map((card) => (
                <a
                  key={card.title}
                  href={card.href}
                  className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/70 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shrink-0 shadow-md`}>
                    <card.icon size={22} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm group-hover:text-cnci-blue transition-colors">{card.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{card.desc}</p>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-cnci-blue group-hover:translate-x-1 transition-all ml-auto shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full px-4 py-16">
          {/* Categories */}
          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Explora por tema
              </h2>
              <p className="text-slate-500 mt-2 max-w-lg mx-auto">
                Selecciona una categoría para encontrar respuestas específicas
              </p>
            </div>
            <CategoryGrid categories={categories} />
          </section>

          {/* Top FAQs */}
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="text-xs font-black text-cnci-blue uppercase tracking-widest">Más consultadas</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
                  Preguntas frecuentes
                </h2>
              </div>
              <a href="/help/plataformas" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-cnci-blue hover:text-cnci-dark transition-colors">
                Ver todas <ArrowRight size={14} />
              </a>
            </div>

            <div className="space-y-3">
              {topFaqs.map((faq) => (
                <FaqCard key={faq.id} faq={faq} />
              ))}
            </div>
          </section>

          {/* CTA banner */}
          <section className="mt-20">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cnci-navy via-[#003d99] to-cnci-navy-deep p-10 md:p-14 text-center">
              <div className="absolute inset-0 bg-grid-pattern opacity-30" />
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-cnci-blue/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cnci-accent/10 rounded-full blur-3xl" />
              <div className="relative z-10">
                <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3">
                  ¿No encontraste lo que buscas?
                </h3>
                <p className="text-blue-200 font-medium max-w-lg mx-auto mb-8">
                  Nuestro equipo de Servicios Estudiantiles está listo para ayudarte.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <a
                    href="/tickets"
                    className="inline-flex items-center justify-center gap-2 bg-white text-cnci-navy font-bold text-sm px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
                  >
                    Crear solicitud de soporte
                  </a>
                  <a
                    href="mailto:servicios@cncivirtual.mx"
                    className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white font-bold text-sm px-8 py-3.5 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    Escribir por correo
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Directory */}
          <section className="mt-16 mb-10">
            <div className="bg-white rounded-3xl shadow-premium border border-slate-100 p-8 md:p-12 text-center overflow-hidden relative">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50/50 rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-tr-full" />
              <div className="relative z-10">
                <span className="text-xs font-black text-cnci-blue uppercase tracking-widest">Departamentos</span>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight mt-2">
                  Directorio CNCI
                </h2>
                <p className="text-slate-500 mb-8 max-w-lg mx-auto">
                  Encuentra la información de contacto de cada área.
                </p>
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
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
