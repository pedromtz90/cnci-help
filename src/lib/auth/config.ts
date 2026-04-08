import type { NextAuthOptions } from 'next-auth';
import { compare } from 'bcryptjs';
import { getStaffEmails, getDirectorEmails, getConfig } from '@/lib/settings/service';
import { getDb } from '@/lib/db/database';

export type UserRole = 'student' | 'staff' | 'director';

export function getUserRole(email: string): UserRole {
  // Ensure DB is initialized before reading settings
  try { getDb(); } catch (err) { console.error('[auth] DB init failed:', err); }
  const lower = email.toLowerCase();
  if (getDirectorEmails().has(lower)) return 'director';
  if (getStaffEmails().has(lower)) return 'staff';
  return 'student';
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Microsoft Azure AD SSO — only active when configured
    ...(process.env.AZURE_AD_CLIENT_ID || (() => { try { getDb(); return getConfig('azure_ad_client_id'); } catch (err) { console.error('[auth] Failed to read azure_ad_client_id from DB:', err); return ''; } })()
      ? [
          {
            id: 'azure-ad',
            name: 'Microsoft CNCI',
            type: 'oauth' as const,
            wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || (() => { try { return getConfig('azure_ad_tenant_id'); } catch (err) { console.error('[auth] Failed to read azure_ad_tenant_id:', err); return 'common'; } })()}/v2.0/.well-known/openid-configuration`,
            authorization: { params: { scope: 'openid email profile User.Read' } },
            clientId: process.env.AZURE_AD_CLIENT_ID || (() => { try { return getConfig('azure_ad_client_id'); } catch (err) { console.error('[auth] Failed to read azure_ad_client_id:', err); return ''; } })(),
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET || (() => { try { return getConfig('azure_ad_client_secret'); } catch (err) { console.error('[auth] Failed to read azure_ad_client_secret:', err); return ''; } })(),
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
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) return null; // Credentials auth disabled without env vars
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        if (adminPasswordHash) {
          const isValid = await compare(credentials.password, adminPasswordHash);
          if (credentials.email === adminEmail && isValid) {
            return { id: 'admin-local', name: 'Administrador CNCI', email: credentials.email };
          }
        } else {
          // Fallback: direct comparison for backward compat (log warning)
          console.warn('ADMIN_PASSWORD_HASH not set, using plaintext comparison (INSECURE)');
          const adminPassword = process.env.ADMIN_PASSWORD;
          if (!adminPassword) return null;
          if (credentials.email === adminEmail && credentials.password === adminPassword) {
            return { id: 'admin-local', name: 'Administrador CNCI', email: credentials.email };
          }
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
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 hours
  secret: process.env.NEXTAUTH_SECRET,
};
