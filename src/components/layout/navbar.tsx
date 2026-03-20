'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X, FileText, BarChart3, LogOut, LogIn, Brain, ChevronDown } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (session?.user as any)?.role as string | undefined;
  const isStaff = role === 'staff' || role === 'director';
  const isDirector = role === 'director';
  const userName = session?.user?.name || '';
  const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-14 items-center">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-cnci.png" alt="CNCI" className="h-8 w-auto" />
            <span className="font-semibold text-slate-800 text-sm hidden sm:block">Centro de Ayuda</span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-0.5 text-[13px]">
            <a href="https://cnci.blackboard.com/ultra/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">Blackboard</a>
            <a href="https://www.office.com/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">Office 365</a>

            <div className="w-px h-4 bg-slate-200 mx-2" />

            {session ? (
              <>
                <Link href="/tickets" className="text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1">
                  <FileText size={13} /> Solicitudes
                </Link>
                {isStaff && (
                  <Link href="/admin/content" className="text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1">
                    <Brain size={13} /> Contenido
                  </Link>
                )}
                {isDirector && (
                  <Link href="/admin" className="text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1">
                    <BarChart3 size={13} /> Métricas
                  </Link>
                )}
                <div className="w-px h-4 bg-slate-200 mx-2" />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-cnci-navy text-white text-[10px] font-bold flex items-center justify-center">{initials}</div>
                  <button onClick={() => signOut({ callbackUrl: '/' })} className="text-slate-400 hover:text-red-500 transition-colors" title="Salir">
                    <LogOut size={14} />
                  </button>
                </div>
              </>
            ) : (
              <Link href="/auth/login" className="text-cnci-navy font-medium px-3 py-1.5 rounded-md hover:bg-cnci-navy/5 transition-colors flex items-center gap-1">
                <LogIn size={13} /> Entrar
              </Link>
            )}
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-slate-500 p-1.5" aria-label="Menú">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="flex flex-col py-2 px-4 text-sm">
            <a href="https://cnci.blackboard.com/ultra/" target="_blank" rel="noopener noreferrer" className="py-2.5 text-slate-600 border-b border-slate-50">Blackboard</a>
            <a href="https://www.office.com/" target="_blank" rel="noopener noreferrer" className="py-2.5 text-slate-600 border-b border-slate-50">Office 365</a>
            {session ? (
              <>
                <Link href="/tickets" className="py-2.5 text-slate-600 border-b border-slate-50" onClick={() => setMobileOpen(false)}>Mis solicitudes</Link>
                {isStaff && <Link href="/admin/content" className="py-2.5 text-slate-600 border-b border-slate-50" onClick={() => setMobileOpen(false)}>Gestionar contenido</Link>}
                <button onClick={() => signOut({ callbackUrl: '/' })} className="py-2.5 text-red-500 text-left">Cerrar sesión</button>
              </>
            ) : (
              <Link href="/auth/login" className="py-2.5 text-cnci-navy font-medium" onClick={() => setMobileOpen(false)}>Iniciar sesión</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
