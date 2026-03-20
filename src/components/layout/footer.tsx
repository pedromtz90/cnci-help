import { Facebook, Instagram, Youtube, Linkedin } from 'lucide-react';

const SOCIALS = [
  { icon: Facebook, href: 'https://www.facebook.com/UniversidadVirtualCNCIoficial', label: 'Facebook', hoverBg: 'hover:bg-[#1877F2]' },
  { icon: Instagram, href: 'https://www.instagram.com/UniversidadVirtualCNCIoficial', label: 'Instagram', hoverBg: 'hover:bg-[#E4405F]' },
  { icon: Youtube, href: 'https://www.youtube.com/c/UniversidadVirtualCNCIOficial', label: 'YouTube', hoverBg: 'hover:bg-[#FF0000]' },
  { icon: Linkedin, href: 'https://www.linkedin.com/school/universidad-virtual-cnci/', label: 'LinkedIn', hoverBg: 'hover:bg-[#0A66C2]' },
];

export function Footer() {
  return (
    <footer className="bg-white mt-auto border-t border-gray-200/60 py-8 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-sm text-gray-500 font-medium order-2 md:order-1">
          &copy; 2026 Universidad Virtual CNCI
        </p>

        <div className="flex items-center gap-3 order-1 md:order-2">
          {SOCIALS.map(({ icon: Icon, href, label, hoverBg }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className={`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 ${hoverBg} hover:text-white transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1`}
            >
              <Icon size={18} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
