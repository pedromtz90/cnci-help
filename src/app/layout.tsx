import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { SessionProvider } from '@/components/layout/session-provider';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '900'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Centro de Ayuda CNCI',
  description: 'Plataforma de orientación y soporte para alumnos de la Universidad Virtual CNCI.',
  keywords: 'CNCI, Universidad Virtual, ayuda, soporte, FAQ, Blackboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={poppins.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
