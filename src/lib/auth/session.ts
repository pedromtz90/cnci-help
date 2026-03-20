/**
 * Server-side session helpers for API route protection.
 */
import { getServerSession } from 'next-auth';
import { authOptions, getUserRole } from './config';
import type { NextRequest } from 'next/server';

export type UserRole = 'student' | 'staff' | 'director';

interface SessionInfo {
  authenticated: boolean;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Get current session from API route. Returns null if not authenticated.
 */
export async function getSession(): Promise<SessionInfo | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return {
    authenticated: true,
    email: session.user.email,
    name: session.user.name || '',
    role: getUserRole(session.user.email),
  };
}

/**
 * Require authentication. Returns session or throws 401.
 */
export async function requireAuth(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session) throw new AuthError(401, 'Inicia sesión para continuar.');
  return session;
}

/**
 * Require staff or director role. Returns session or throws 403.
 */
export async function requireStaff(): Promise<SessionInfo> {
  const session = await requireAuth();
  if (session.role !== 'staff' && session.role !== 'director') {
    throw new AuthError(403, 'No tienes permisos para esta acción.');
  }
  return session;
}

/**
 * Require director role. Returns session or throws 403.
 */
export async function requireDirector(): Promise<SessionInfo> {
  const session = await requireAuth();
  if (session.role !== 'director') {
    throw new AuthError(403, 'Acceso restringido a directora.');
  }
  return session;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
