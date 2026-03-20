import Link from 'next/link';
import * as Icons from 'lucide-react';
import type { Category } from '@/types/content';

interface CategoryGridProps {
  categories: Category[];
  activeCategory?: string;
}

export function CategoryGrid({ categories, activeCategory }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {categories.map((cat) => {
        const IconComponent = (Icons as any)[cat.icon] || Icons.HelpCircle;
        const isActive = activeCategory === cat.id;

        return (
          <Link
            key={cat.id}
            href={`/help/${cat.id}`}
            className={`group relative flex flex-col items-center text-center p-6 rounded-2xl border transition-all duration-200 ${
              isActive
                ? 'border-cnci-blue bg-cnci-blue/5 shadow-md shadow-blue-100'
                : 'border-slate-200/80 bg-white hover:border-cnci-blue/30 hover:shadow-lg hover:shadow-slate-100 hover:-translate-y-0.5'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-200 ${
              isActive
                ? 'bg-cnci-blue text-white shadow-md shadow-blue-200'
                : 'bg-slate-100 text-slate-500 group-hover:bg-cnci-blue/10 group-hover:text-cnci-blue'
            }`}>
              <IconComponent size={22} strokeWidth={1.8} />
            </div>
            <span className={`text-[13px] font-bold leading-tight transition-colors ${
              isActive ? 'text-cnci-blue' : 'text-slate-700 group-hover:text-slate-900'
            }`}>
              {cat.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
