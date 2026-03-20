'use client';

import { useState } from 'react';
import { ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ContentMeta } from '@/types/content';

interface FaqCardProps {
  faq: ContentMeta;
}

export function FaqCard({ faq }: FaqCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border-b border-slate-100 last:border-0 ${open ? 'pb-4' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-3.5 flex justify-between items-start gap-3 group"
        aria-expanded={open}
      >
        <span className={`text-[14px] leading-relaxed transition-colors ${
          open ? 'text-cnci-navy font-medium' : 'text-slate-700 group-hover:text-slate-900'
        }`}>
          {faq.title}
        </span>
        <ChevronRight
          size={15}
          className={`mt-0.5 shrink-0 transition-transform text-slate-400 ${
            open ? 'rotate-90 text-cnci-navy' : 'group-hover:text-slate-600'
          }`}
        />
      </button>

      {open && (
        <div className="pl-0 pb-1 animate-fade-up">
          {faq.excerpt && (
            <p className="text-slate-500 text-[13px] leading-relaxed mb-3">{faq.excerpt}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/help/${faq.category}/${faq.slug}`}
              className="text-[12px] font-medium text-cnci-navy hover:text-cnci-dark flex items-center gap-1 transition-colors"
            >
              Leer más <ArrowRight size={11} />
            </Link>
            {faq.suggestedActions?.slice(0, 2).map((action, i) => (
              <a
                key={i}
                href={action.href || '#'}
                target={action.href?.startsWith('http') ? '_blank' : undefined}
                rel={action.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-[11px] text-slate-500 hover:text-cnci-navy bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded transition-colors"
              >
                {action.label}
              </a>
            ))}
          </div>
          {faq.area && (
            <span className="text-[10px] text-slate-300 mt-2 block">{faq.area}</span>
          )}
        </div>
      )}
    </div>
  );
}
