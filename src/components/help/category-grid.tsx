import Link from 'next/link';
import * as Icons from 'lucide-react';
import type { Category } from '@/types/content';

interface CategoryGridProps {
  categories: Category[];
  activeCategory?: string;
}

export function CategoryGrid({ categories, activeCategory }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {categories.map((cat) => {
        const IconComponent = (Icons as any)[cat.icon] || Icons.HelpCircle;
        const isActive = activeCategory === cat.id;

        return (
          <Link
            key={cat.id}
            href={`/help/${cat.id}`}
            className={`flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all duration-200 group ${
              isActive
                ? 'border-cnci-blue bg-blue-50/50 text-cnci-blue shadow-md'
                : 'border-slate-100 bg-white text-slate-500 hover:border-cnci-blue/30 hover:shadow-premium'
            }`}
          >
            <div className={`w-14 h-14 flex items-center justify-center mb-3 rounded-2xl transition-all group-hover:scale-110 ${
              isActive
                ? 'bg-cnci-blue text-white shadow-md'
                : 'bg-slate-100 text-slate-400 group-hover:text-cnci-blue group-hover:bg-blue-50'
            }`}>
              <IconComponent size={24} />
            </div>
            <span className="text-sm font-bold text-center leading-tight">
              {cat.name}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 text-center leading-snug hidden sm:block">
              {cat.description}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
