'use client';

import { useState } from 'react';
import { Menu, X, FileText } from 'lucide-react';
import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Office 365', href: 'https://www.office.com/', external: true },
  { label: 'Biblioteca', href: 'https://cnci.unlimitedlearning.io/', external: true },
  { label: 'Blackboard', href: 'https://cnci.blackboard.com/ultra/', external: true },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="https://i.ibb.co/m5QcyKWg/Logo-CNCI.png"
              alt="CNCI"
              className="h-10 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <span className="font-bold text-slate-800 text-[15px] leading-none">Centro de Ayuda</span>
              <span className="block text-cnci-blue font-black text-xs tracking-wider">CNCI</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all"
              >
                {link.label}
              </a>
            ))}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <Link
              href="/tickets"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-cnci-blue hover:text-cnci-dark px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
            >
              <FileText size={14} />
              Mis solicitudes
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-50 transition-all"
            aria-label="Menú"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 inset-x-0 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xl z-40">
          <div className="flex flex-col p-4 gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 hover:text-cnci-blue px-4 py-3 rounded-xl hover:bg-slate-50 transition-all"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/tickets"
              className="text-sm font-semibold text-cnci-blue px-4 py-3 rounded-xl hover:bg-blue-50 transition-all mt-1 border-t border-slate-100 pt-3"
              onClick={() => setMobileOpen(false)}
            >
              Mis solicitudes
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
