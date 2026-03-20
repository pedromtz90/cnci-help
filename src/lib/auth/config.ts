import type { NextAuthOptions } from 'next-auth';

/**
 * Auth configuration for CNCI Help Platform.
 *
 * Strategy: Microsoft Azure AD SSO
 * - All @cncivirtual.mx users can sign in
 * - Staff emails get admin role
 * - Director emails get director role
 * - Everyone else is a student
 *
 * To set up in Azure:
 * 1. Go to Azure Portal → Azure Active Directory → App registrations
 * 2. New registration → name: "Centro de Ayuda CNCI"
 * 3. Redirect URI: https://cncifaq.com/api/auth/callback/azure-ad
 * 4. Copy Application (client) ID → AZURE_AD_CLIENT_ID
 * 5. Create client secret → AZURE_AD_CLIENT_SECRET
 * 6. Copy Directory (tenant) ID → AZURE_AD_TENANT_ID
 */

// Staff emails — can manage content
const STAFF_EMAILS = new Set([
  'admin@cncivirtual.mx',
  'soporte@cncivirtual.mx',
  'servicios@cncivirtual.mx',
  'cobranza@cncivirtual.mx',
  'titulacion@cncivirtual.mx',
  'bienestar@cncivirtual.mx',
  // Add more staff emails here
]);

// Director emails — see analytics + everything staff can do
const DIRECTOR_EMAILS = new Set([
  'brenda@cncivirtual.mx',
  'director@cncivirtual.mx',
  // Add more director emails here
]);

export type UserRole = 'student' | 'staff' | 'director';

export function getUserRole(email: string): UserRole {
  const lower = email.toLowerCase();
  if (DIRECTOR_EMAILS.has(lower)) return 'director';
  if (STAFF_EMAILS.has(lower)) return 'staff';
  return 'student';
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Microsoft Azure AD SSO
    ...(process.env.AZURE_AD_CLIENT_ID
      ? [
          {
            id: 'azure-ad',
            name: 'Microsoft CNCI',
            type: 'oauth' as const,
            wellKnown: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/v2.0/.well-known/openid-configuration`,
            authorization: {
              params: {
                scope: 'openid email profile User.Read',
              },
            },
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
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
    // Fallback: credentials login for development / staff without Azure
    {
      id: 'credentials',
      name: 'Correo CNCI',
      type: 'credentials' as const,
      credentials: {
        email: { label: 'Correo institucional', type: 'email', placeholder: 'tu@cncivirtual.mx' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Admin fallback
        if (
          credentials.email === process.env.ADMIN_EMAIL &&
          credentials.password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: 'admin-local',
            name: 'Administrador CNCI',
            email: credentials.email,
          };
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
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
