import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { FaqCard } from '@/components/help/faq-card';
import { ChatWidget } from '@/components/chat/chat-widget';
import { loadCategories, getContentByCategory } from '@/lib/knowledge/loader';

interface Props {
  params: { category: string };
}

export default async function CategoryPage({ params }: Props) {
  const categories = loadCategories();
  const category = categories.find((c) => c.id === params.category);

  if (!category) notFound();

  const items = await getContentByCategory(params.category);
  const faqs = items.filter((i) => i.type === 'faq');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        {/* Header */}
        <div className="bg-gradient-to-br from-cnci-navy to-cnci-navy-deep py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm font-medium mb-6 transition-colors"
            >
              <ChevronLeft size={16} />
              Centro de Ayuda
            </Link>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              {category.name}
            </h1>
            <p className="text-blue-200 mt-2 font-medium">
              {category.description}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          {faqs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 font-medium">
                No hay artículos en esta categoría todavía.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq) => (
                <FaqCard key={faq.id} faq={faq} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}

export async function generateStaticParams() {
  const categories = loadCategories();
  return categories.map((c) => ({ category: c.id }));
}
