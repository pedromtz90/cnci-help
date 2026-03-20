'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, FileText, Shield, BarChart3, LogOut, LogIn, Brain, User } from 'lucide-react';
import Link from 'next/link';

const EXTERNAL_LINKS = [
  { label: 'Office 365', href: 'https://www.office.com/' },
  { label: 'Biblioteca', href: 'https://cnci.unlimitedlearning.io/' },
  { label: 'Blackboard', href: 'https://cnci.blackboard.com/ultra/' },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (session?.user as any)?.role as string | undefined;
  const isStaff = role === 'staff' || role === 'director';
  const isDirector = role === 'director';
  const userName = session?.user?.name?.split(' ')[0] || '';

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo-cnci.png" alt="CNCI" className="h-10 w-auto object-contain" />
            <div className="hidden sm:block">
              <span className="font-bold text-slate-800 text-[15px] leading-none">Centro de Ayuda</span>
              <span className="block text-cnci-blue font-black text-xs tracking-wider">CNCI</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {EXTERNAL_LINKS.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all">
                {link.label}
              </a>
            ))}

            <div className="w-px h-5 bg-slate-200 mx-1" />

            {/* Auth-dependent links */}
            {session ? (
              <>
                <Link href="/tickets" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-cnci-blue px-3 py-2 rounded-lg hover:bg-blue-50 transition-all">
                  <FileText size={14} /> Mis solicitudes
                </Link>

                {isStaff && (
                  <Link href="/admin/content" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-600 hover:text-violet-700 px-3 py-2 rounded-lg hover:bg-violet-50 transition-all">
                    <Brain size={14} /> Contenido
                  </Link>
                )}

                {isDirector && (
                  <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-600 hover:text-amber-700 px-3 py-2 rounded-lg hover:bg-amber-50 transition-all">
                    <BarChart3 size={14} /> Dashboard
                  </Link>
                )}

                {/* User menu */}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                  <div className="w-7 h-7 rounded-full bg-cnci-blue/10 flex items-center justify-center">
                    <User size={14} className="text-cnci-blue" />
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-xs font-semibold text-slate-700 leading-none">{userName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isDirector ? 'Directora' : isStaff ? 'Staff' : 'Alumno'}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Cerrar sesión"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </>
            ) : (
              <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-cnci-blue hover:text-cnci-dark px-4 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-all">
                <LogIn size={14} /> Iniciar sesión
              </Link>
            )}
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
            {EXTERNAL_LINKS.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-50" onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}

            <div className="h-px bg-slate-100 my-2" />

            {session ? (
              <>
                <div className="px-4 py-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-cnci-blue/10 flex items-center justify-center">
                    <User size={16} className="text-cnci-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{session.user?.name}</p>
                    <p className="text-[10px] text-slate-400">{session.user?.email}</p>
                  </div>
                </div>

                <Link href="/tickets" className="text-sm font-semibold text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <FileText size={16} /> Mis solicitudes
                </Link>

                {isStaff && (
                  <Link href="/admin/content" className="text-sm font-semibold text-violet-600 px-4 py-3 rounded-xl hover:bg-violet-50 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                    <Brain size={16} /> Gestionar contenido
                  </Link>
                )}

                {isDirector && (
                  <Link href="/admin" className="text-sm font-semibold text-amber-600 px-4 py-3 rounded-xl hover:bg-amber-50 flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                    <BarChart3 size={16} /> Dashboard
                  </Link>
                )}

                <button onClick={() => signOut({ callbackUrl: '/' })} className="text-sm font-semibold text-red-500 px-4 py-3 rounded-xl hover:bg-red-50 text-left flex items-center gap-2">
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="text-sm font-bold text-white bg-cnci-blue px-4 py-3 rounded-xl text-center" onClick={() => setMobileOpen(false)}>
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
