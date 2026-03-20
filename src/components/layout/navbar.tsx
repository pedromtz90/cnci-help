'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Office 365', href: 'https://www.office.com/', external: true },
  { label: 'Biblioteca Virtual', href: 'https://cnci.unlimitedlearning.io/', external: true },
  { label: 'Blackboard', href: 'https://cnci.blackboard.com/ultra/', external: true },
  { label: 'Mis Solicitudes', href: '/tickets', external: false },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <img
              src="https://i.ibb.co/m5QcyKWg/Logo-CNCI.png"
              alt="CNCI"
              className="h-12 w-auto object-contain"
            />
            <h1 className="font-semibold text-lg sm:text-xl tracking-tight text-gray-800">
              Centro de Ayuda <span className="text-cnci-blue">CNCI</span>
            </h1>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-sm font-medium text-gray-600 hover:text-cnci-blue transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-600 hover:text-cnci-blue transition-colors p-2"
            aria-label="Menú"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-20 inset-x-0 bg-white border-b shadow-xl z-40 animate-in slide-in-from-top-2">
          <div className="flex flex-col px-6 py-5 gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-bold text-slate-700 hover:text-cnci-blue py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
