'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ContentMeta } from '@/types/content';

export function FaqCard({ faq }: { faq: ContentMeta }) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`bg-white rounded-3xl border overflow-hidden transition-all duration-300 ${
      open
        ? 'border-blue-200 shadow-lg'
        : 'border-slate-100 shadow-premium hover:-translate-y-0.5 hover:shadow-lg'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-6 md:p-8 flex justify-between items-center group"
        aria-expanded={open}
      >
        <h3 className={`font-bold text-sm md:text-base pr-4 transition-colors leading-snug ${
          open ? 'text-blue-600' : 'text-slate-800 group-hover:text-blue-600'
        }`}>
          {faq.title}
        </h3>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-blue-600' : 'text-slate-300 group-hover:text-blue-500'
          }`}
        />
      </button>

      {open && (
        <div className="px-6 md:px-8 pb-6 md:pb-8 animate-fade-up">
          {faq.excerpt && (
            <p className="text-slate-600 text-sm leading-relaxed mb-4">{faq.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Link
              href={`/help/${faq.category}/${faq.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
            >
              Ver artículo completo <ArrowRight size={14} />
            </Link>

            {faq.suggestedActions?.slice(0, 2).map((action, i) => (
              <a
                key={i}
                href={action.href || '#'}
                target={action.href?.startsWith('http') ? '_blank' : undefined}
                rel={action.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors"
              >
                <ExternalLink size={11} /> {action.label}
              </a>
            ))}
          </div>

          {faq.area && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Área: {faq.area}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
