'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ContentMeta } from '@/types/content';

interface FaqCardProps {
  faq: ContentMeta;
}

export function FaqCard({ faq }: FaqCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
      open
        ? 'border-cnci-blue/20 shadow-lg shadow-blue-100/50 ring-1 ring-cnci-blue/10'
        : 'border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300/80'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-6 py-5 flex justify-between items-center gap-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-cnci-blue/30 rounded-t-2xl"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
            open ? 'bg-cnci-blue' : 'bg-slate-300 group-hover:bg-cnci-blue/50'
          }`} />
          <h3 className={`font-semibold text-[15px] leading-snug transition-colors ${
            open ? 'text-cnci-blue' : 'text-slate-800 group-hover:text-slate-900'
          }`}>
            {faq.title}
          </h3>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-all duration-300 ${
            open ? 'rotate-180 text-cnci-blue' : 'text-slate-400 group-hover:text-slate-600'
          }`}
        />
      </button>

      {open && (
        <div className="px-6 pb-6 animate-fade-up">
          {faq.excerpt && (
            <p className="text-slate-600 text-[15px] leading-relaxed ml-5 mb-4">{faq.excerpt}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 ml-5">
            <Link
              href={`/help/${faq.category}/${faq.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-cnci-blue hover:text-cnci-dark bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-all"
            >
              Leer más <ArrowRight size={14} />
            </Link>

            {faq.suggestedActions?.slice(0, 2).map((action, i) => (
              <a
                key={i}
                href={action.href || '#'}
                target={action.href?.startsWith('http') ? '_blank' : undefined}
                rel={action.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
              >
                <ExternalLink size={11} />
                {action.label}
              </a>
            ))}
          </div>

          {faq.area && (
            <div className="ml-5 mt-4 pt-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {faq.area}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
