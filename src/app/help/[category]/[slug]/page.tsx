import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Clock, Tag } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ChatWidget } from '@/components/chat/chat-widget';
import { SafeContent } from '@/components/help/safe-content';
import { getContentBySlug, loadPublishedContent, loadCategories } from '@/lib/knowledge/loader';

interface Props {
  params: { category: string; slug: string };
}

export default async function ArticlePage({ params }: Props) {
  const item = await getContentBySlug(params.slug);
  if (!item) notFound();

  const categories = loadCategories();
  const category = categories.find((c) => c.id === item.category);

  // Content is rendered by SafeContent component (sanitized, no XSS risk)

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        <div className="bg-gradient-to-br from-cnci-navy to-cnci-navy-deep py-12 px-6">
          <div className="max-w-3xl mx-auto">
            <Link
              href={`/help/${item.category}`}
              className="inline-flex items-center gap-1.5 text-blue-200 hover:text-white text-sm font-medium mb-4 transition-colors"
            >
              <ChevronLeft size={16} />
              {category?.name || item.category}
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
              {item.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-4">
              {item.area && (
                <span className="text-xs font-bold text-blue-200 bg-white/10 px-3 py-1 rounded-full">
                  {item.area}
                </span>
              )}
              <span className="text-xs text-blue-300 flex items-center gap-1">
                <Clock size={12} />
                Actualizado: {item.updatedAt}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          {/* Article content — sanitized rendering, no XSS risk */}
          <SafeContent content={item.content} className="prose-cnci" />

          {/* Actions */}
          {item.suggestedActions && item.suggestedActions.length > 0 && (
            <div className="mt-10 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-slate-800 mb-4">Acciones rápidas</h3>
              <div className="flex flex-wrap gap-3">
                {item.suggestedActions.map((action, i) => (
                  <a
                    key={i}
                    href={action.href || '#'}
                    target={action.href?.startsWith('http') ? '_blank' : undefined}
                    rel={action.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-2 bg-cnci-blue text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-cnci-dark transition-colors shadow-md"
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2 items-center">
              <Tag size={14} className="text-slate-400" />
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md tracking-wide"
                >
                  {tag}
                </span>
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
  const content = await loadPublishedContent();
  return content.map((item) => ({
    category: item.category,
    slug: item.slug,
  }));
}
