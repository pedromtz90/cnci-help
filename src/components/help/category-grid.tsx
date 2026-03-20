import Link from 'next/link';
import * as Icons from 'lucide-react';
import type { Category } from '@/types/content';

interface CategoryGridProps {
  categories: Category[];
  activeCategory?: string;
}

export function CategoryGrid({ categories, activeCategory }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {categories.map((cat) => {
        const Icon = (Icons as any)[cat.icon] || Icons.HelpCircle;
        const active = activeCategory === cat.id;

        return (
          <Link
            key={cat.id}
            href={`/help/${cat.id}`}
            className={`group flex items-center gap-3 p-3.5 rounded-lg border transition-colors ${
              active
                ? 'border-cnci-navy/20 bg-cnci-navy/[0.03]'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              active
                ? 'bg-cnci-navy text-white'
                : 'bg-slate-100 text-slate-500 group-hover:text-cnci-navy group-hover:bg-slate-50'
            }`}>
              <Icon size={18} strokeWidth={1.8} />
            </div>
            <span className={`text-xs font-medium leading-tight ${
              active ? 'text-cnci-navy' : 'text-slate-700'
            }`}>
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
