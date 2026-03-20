'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { ContentMeta } from '@/types/content';

interface FaqCardProps {
  faq: ContentMeta;
}

export function FaqCard({ faq }: FaqCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className="bg-white rounded-3xl shadow-premium border border-slate-100 overflow-hidden hover:-translate-y-0.5 hover:shadow-premium-hover transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-6 md:p-8 flex justify-between items-center group focus:outline-none focus:ring-2 focus:ring-cnci-blue/20 rounded-t-3xl"
        aria-expanded={open}
      >
        <h3 className="text-slate-800 font-bold text-base md:text-lg pr-4 group-hover:text-cnci-blue transition-colors leading-snug">
          {faq.title}
        </h3>
        <ChevronDown
          size={20}
          className={`text-slate-400 group-hover:text-cnci-blue transition-transform duration-300 flex-shrink-0 ${
            open ? 'rotate-180 text-cnci-blue' : ''
          }`}
        />
      </button>

      {open && (
        <div className="px-6 md:px-8 pb-6 md:pb-8 animate-in fade-in slide-in-from-top-2 duration-200">
          {faq.excerpt && (
            <p className="text-slate-600 leading-relaxed mb-4">{faq.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {/* View full article */}
            <Link
              href={`/help/${faq.category}/${faq.slug}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-cnci-blue hover:text-cnci-dark transition-colors"
            >
              Ver artículo completo
              <ExternalLink size={14} />
            </Link>

            {/* Suggested actions */}
            {faq.suggestedActions?.map((action, i) => (
              <a
                key={i}
                href={action.href || '#'}
                target={action.href?.startsWith('http') ? '_blank' : undefined}
                rel={action.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-50 text-slate-500 px-3 py-1.5 rounded-full border border-slate-100 hover:bg-blue-50 hover:text-cnci-blue hover:border-cnci-blue/20 transition-colors"
              >
                {action.label}
              </a>
            ))}
          </div>

          {/* Area tag */}
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
