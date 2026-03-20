import Link from 'next/link';
import * as Icons from 'lucide-react';
import type { Category } from '@/types/content';

interface CategoryGridProps {
  categories: Category[];
  activeCategory?: string;
}

export function CategoryGrid({ categories, activeCategory }: CategoryGridProps) {
  return (
    <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar">
      {categories.map((cat) => {
        const Icon = (Icons as any)[cat.icon] || Icons.HelpCircle;
        const active = activeCategory === cat.id;

        return (
          <Link
            key={cat.id}
            href={`/help/${cat.id}`}
            className={`flex-shrink-0 flex flex-col items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 transition-all group ${
              active
                ? 'border-blue-600 bg-blue-50/50 text-blue-600 shadow-md'
                : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className={`w-12 h-12 flex items-center justify-center mb-2 rounded-full transition-all ${
              active
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'
            }`}>
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <span className="text-xs sm:text-sm font-bold text-center leading-tight px-2 line-clamp-2">
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
