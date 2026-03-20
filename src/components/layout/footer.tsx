import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 py-8 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-cnci.png" alt="CNCI" className="h-6 opacity-30 grayscale" />
            <span className="text-xs text-slate-400">&copy; 2026 Universidad Virtual CNCI</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <Link href="/help/contacto" className="hover:text-slate-600 transition-colors">Contacto</Link>
            <Link href="/tickets" className="hover:text-slate-600 transition-colors">Soporte</Link>
            <a href="https://www.facebook.com/UniversidadVirtualCNCIoficial" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Facebook</a>
            <a href="https://www.youtube.com/c/UniversidadVirtualCNCIOficial" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
