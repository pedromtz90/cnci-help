import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { HeroSearch } from '@/components/help/hero-search';
import { CategoryGrid } from '@/components/help/category-grid';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import { loadPublishedContent, loadCategories } from '@/lib/knowledge/loader';
import { ArrowRight, BookOpen, Headphones, GraduationCap } from 'lucide-react';
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
    .slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-grow">
        <HeroSearch />

        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Quick links */}
          <div className="-mt-6 relative z-10 mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: BookOpen, label: 'Guías y trámites', href: '/help/tramites', desc: 'Constancias, credenciales, documentos' },
                { icon: Headphones, label: 'Soporte técnico', href: '/help/soporte', desc: 'Blackboard, Office 365, contraseñas' },
                { icon: GraduationCap, label: 'Titulación', href: '/help/titulacion', desc: 'Requisitos, proceso, servicio social' },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:text-cnci-navy">
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-800 block">{item.label}</span>
                    <span className="text-[11px] text-slate-400">{item.desc}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Categories */}
          <section className="mb-14">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Explorar por tema</h2>
            <CategoryGrid categories={categories} />
          </section>

          {/* Top FAQs */}
          <section className="mb-14">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800">Preguntas frecuentes</h2>
              <Link href="/help/plataformas" className="text-[12px] text-slate-400 hover:text-cnci-navy flex items-center gap-1 transition-colors">
                Ver todas <ArrowRight size={11} />
              </Link>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 px-5">
              {topFaqs.map((faq) => (
                <FaqCard key={faq.id} faq={faq} />
              ))}
            </div>
          </section>

          {/* Directory */}
          <section className="mb-16">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Directorio de departamentos</h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <img
                src="/directorio-cnci.png"
                alt="Directorio de Departamentos CNCI"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </section>

          {/* Help CTA — simple, not a banner */}
          <section className="mb-16 text-center py-10 border-t border-slate-100">
            <p className="text-slate-500 text-sm mb-4">¿No encontraste lo que buscas?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/tickets" className="inline-flex items-center justify-center gap-2 text-sm font-medium bg-cnci-navy text-white px-5 py-2.5 rounded-lg hover:bg-cnci-dark transition-colors">
                Crear solicitud de soporte
              </Link>
              <a href="mailto:servicios@cncivirtual.mx" className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-600 border border-slate-200 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
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
