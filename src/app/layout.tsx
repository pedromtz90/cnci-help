import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import { SessionProvider } from '@/components/layout/session-provider';
import { PWARegister } from '@/components/layout/pwa-register';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '900'],
  display: 'swap',
  variable: '--font-poppins',
});

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Centro de Ayuda CNCI',
  description: 'Plataforma de orientación y soporte para alumnos de la Universidad Virtual CNCI.',
  keywords: 'CNCI, Universidad Virtual, ayuda, soporte, FAQ, Blackboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ana CNCI',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={poppins.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
        <SessionProvider>{children}</SessionProvider>
        <PWARegister />
      </body>
    </html>
  );
}
