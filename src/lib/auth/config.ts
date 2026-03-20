import type { NextAuthOptions } from 'next-auth';
import { getStaffEmails, getDirectorEmails, getConfig } from '@/lib/settings/service';
import { getDb } from '@/lib/db/database';

export type UserRole = 'student' | 'staff' | 'director';

export function getUserRole(email: string): UserRole {
  // Ensure DB is initialized before reading settings
  try { getDb(); } catch {}
  const lower = email.toLowerCase();
  if (getDirectorEmails().has(lower)) return 'director';
  if (getStaffEmails().has(lower)) return 'staff';
  return 'student';
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Microsoft Azure AD SSO — only active when configured
    ...(process.env.AZURE_AD_CLIENT_ID || (() => { try { getDb(); return getConfig('azure_ad_client_id'); } catch { return ''; } })()
      ? [
          {
            id: 'azure-ad',
            name: 'Microsoft CNCI',
            type: 'oauth' as const,
            wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || (() => { try { return getConfig('azure_ad_tenant_id'); } catch { return 'common'; } })()}/v2.0/.well-known/openid-configuration`,
            authorization: { params: { scope: 'openid email profile User.Read' } },
            clientId: process.env.AZURE_AD_CLIENT_ID || (() => { try { return getConfig('azure_ad_client_id'); } catch { return ''; } })(),
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET || (() => { try { return getConfig('azure_ad_client_secret'); } catch { return ''; } })(),
            idToken: true,
            profile(profile: any) {
              return {
                id: profile.sub || profile.oid,
                name: profile.name || profile.preferred_username,
                email: profile.email || profile.preferred_username,
                image: null,
              };
            },
          },
        ]
      : []),
    // Fallback credentials
    {
      id: 'credentials',
      name: 'Correo CNCI',
      type: 'credentials' as const,
      credentials: {
        email: { label: 'Correo institucional', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (
          credentials.email === (process.env.ADMIN_EMAIL || 'admin@cncivirtual.mx') &&
          credentials.password === (process.env.ADMIN_PASSWORD || 'cnci2026admin')
        ) {
          return { id: 'admin-local', name: 'Administrador CNCI', email: credentials.email };
        }
        return null;
      },
    },
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        token.role = getUserRole(user.email);
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).email = token.email;
      }
      return session;
    },
  },
  pages: { signIn: '/auth/login', error: '/auth/login' },
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
