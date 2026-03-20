'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { GraduationCap, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cnci-navy" />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorParam ? 'Error al iniciar sesión. Verifica tus credenciales.' : '');

  const handleMicrosoft = () => {
    signIn('azure-ad', { callbackUrl });
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cnci-navy via-[#003a95] to-cnci-navy-deep flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/15 rounded-full blur-[100px]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cnci-accent/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Centro de Ayuda CNCI</h1>
          <p className="text-blue-200/70 text-sm mt-1">Inicia sesión con tu cuenta institucional</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Microsoft SSO - Primary */}
          <button
            onClick={handleMicrosoft}
            className="w-full flex items-center justify-center gap-3 bg-[#2F2F2F] text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-[#1a1a1a] transition-colors shadow-md text-sm"
          >
            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Continuar con Microsoft
          </button>

          <p className="text-center text-[11px] text-slate-400 mt-3">
            Usa tu correo <span className="font-semibold">@cncivirtual.mx</span> de Office 365
          </p>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">o acceso directo</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Credentials fallback */}
          <form onSubmit={handleCredentials} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo institucional"
                required
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/30 focus:border-cnci-blue transition-all"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cnci-blue/30 focus:border-cnci-blue transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs font-medium bg-red-50 px-4 py-2.5 rounded-xl">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cnci-blue text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cnci-blue/25 hover:bg-cnci-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Iniciar sesión
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-400 mt-6 leading-relaxed">
            Solo pueden acceder usuarios con cuenta institucional CNCI.<br />
            Si tienes problemas, contacta a <a href="mailto:soporte@cncivirtual.mx" className="text-cnci-blue font-medium">soporte@cncivirtual.mx</a>
          </p>
        </div>

        {/* Back */}
        <div className="text-center mt-6">
          <a href="/" className="text-sm text-blue-200/60 hover:text-white transition-colors font-medium">
            ← Volver al Centro de Ayuda
          </a>
        </div>
      </div>
    </div>
  );
}
