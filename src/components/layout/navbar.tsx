'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Menu, X, LogOut, LogIn, Brain, BarChart3, FileText } from 'lucide-react';

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (session?.user as any)?.role as string | undefined;
  const isStaff = role === 'staff' || role === 'director';
  const isDirector = role === 'director';

  return (
    <nav className="bg-white sticky top-0 z-50 border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img className="h-8 sm:h-10 w-auto" src="/logo-cnci.png" alt="CNCI" />
          <span className="text-lg font-bold text-slate-800 hidden lg:block tracking-tight">Centro de Ayuda</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold text-slate-600">
          <a href="https://www.office.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors">Office 365</a>
          <a href="https://cnci.unlimitedlearning.io/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors">Biblioteca</a>
          <a href="https://cnci.blackboard.com/ultra/" target="_blank" rel="noopener noreferrer"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95">
            Blackboard
          </a>

          {session && (
            <div className="flex items-center gap-4 border-l border-slate-200 pl-6 ml-2">
              <Link href="/tickets" className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-bold">
                <FileText size={14} /> Solicitudes
              </Link>
              {isStaff && (
                <>
                  <Link href="/admin/content" className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-bold">
                    <Brain size={14} /> Contenido
                  </Link>
                  <Link href="/admin/training" className="text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1.5 text-xs font-bold">
                    <Brain size={14} /> Entrenar
                  </Link>
                </>
              )}
              {isDirector && (
                <Link href="/admin" className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-bold">
                  <BarChart3 size={14} /> Dashboard
                </Link>
              )}
              <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase">
                {isDirector ? 'Dir' : isStaff ? 'Staff' : 'Alumno'}
              </span>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="text-red-500 hover:underline text-xs font-bold flex items-center gap-1">
                <LogOut size={12} /> Salir
              </button>
            </div>
          )}

          {!session && (
            <Link href="/auth/login" className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-bold border-l border-slate-200 pl-6 ml-2">
              <LogIn size={14} /> Entrar
            </Link>
          )}
        </div>

        {/* Mobile */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-slate-600 p-2">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b shadow-xl px-6 py-4 flex flex-col gap-3 z-40">
          <a href="https://www.office.com/" target="_blank" rel="noopener noreferrer" className="py-3 border-b border-slate-100 font-semibold text-slate-600" onClick={() => setMobileOpen(false)}>Office 365</a>
          <a href="https://cnci.unlimitedlearning.io/" target="_blank" rel="noopener noreferrer" className="py-3 border-b border-slate-100 font-semibold text-slate-600" onClick={() => setMobileOpen(false)}>Biblioteca</a>
          <a href="https://cnci.blackboard.com/ultra/" target="_blank" rel="noopener noreferrer" className="py-3 bg-blue-600 text-white text-center rounded-xl font-bold" onClick={() => setMobileOpen(false)}>Ir a Blackboard</a>
          {session ? (
            <>
              <Link href="/tickets" className="py-3 border-b border-slate-100 font-semibold text-slate-600" onClick={() => setMobileOpen(false)}>Mis solicitudes</Link>
              {isStaff && <Link href="/admin/content" className="py-3 border-b border-slate-100 font-semibold text-slate-600" onClick={() => setMobileOpen(false)}>Contenido</Link>}
              <button onClick={() => signOut({ callbackUrl: '/' })} className="py-3 text-red-500 font-bold text-left">Cerrar sesión</button>
            </>
          ) : (
            <Link href="/auth/login" className="py-3 text-blue-600 font-bold" onClick={() => setMobileOpen(false)}>Iniciar sesión</Link>
          )}
        </div>
      )}
    </nav>
  );
}
