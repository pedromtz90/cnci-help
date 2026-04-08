import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getDb and settings before importing the module
vi.mock('@/lib/db/database', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => null),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
    pragma: vi.fn(),
  })),
}));

vi.mock('@/lib/settings/service', () => ({
  getStaffEmails: vi.fn(() => new Set(['staff@cncivirtual.mx', 'admin@cncivirtual.mx'])),
  getDirectorEmails: vi.fn(() => new Set(['director@cncivirtual.mx'])),
  getConfig: vi.fn(() => ''),
}));

import { getUserRole } from '@/lib/auth/config';

describe('getUserRole', () => {
  it('returns director for director emails', () => {
    expect(getUserRole('director@cncivirtual.mx')).toBe('director');
  });

  it('returns staff for staff emails', () => {
    expect(getUserRole('staff@cncivirtual.mx')).toBe('staff');
    expect(getUserRole('admin@cncivirtual.mx')).toBe('staff');
  });

  it('returns student for unknown emails', () => {
    expect(getUserRole('alumno@ejemplo.com')).toBe('student');
  });

  it('is case-insensitive', () => {
    expect(getUserRole('DIRECTOR@cncivirtual.mx')).toBe('director');
    expect(getUserRole('Staff@cncivirtual.mx')).toBe('staff');
  });

  it('handles empty string', () => {
    expect(getUserRole('')).toBe('student');
  });
});

describe('AuthError', () => {
  it('can be imported and thrown', async () => {
    const { AuthError } = await import('@/lib/auth/session');
    const err = new AuthError(403, 'Forbidden');
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
    expect(err).toBeInstanceOf(Error);
  });
});
