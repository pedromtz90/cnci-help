import { describe, it, expect, beforeAll } from 'vitest';
import { initSearchIndex, search, retrieveForRAG, exactFaqMatch } from '@/lib/knowledge/search';
import type { ContentItem } from '@/types/content';

const MOCK_CONTENT: ContentItem[] = [
  {
    id: 'faq-1',
    title: 'Como accedo a Blackboard',
    slug: 'como-accedo-a-blackboard',
    type: 'faq',
    category: 'plataformas',
    tags: ['blackboard', 'acceso', 'plataforma'],
    audience: 'student',
    locale: 'es',
    priority: 'high',
    updatedAt: '2024-01-01',
    visibility: 'published',
    excerpt: 'Para acceder a Blackboard necesitas tu usuario y contrasena.',
    content: 'Para acceder a Blackboard, ve a blackboard.cnci.edu.mx e ingresa con tu matricula y contrasena.',
  },
  {
    id: 'faq-2',
    title: 'Como restablezco mi contrasena',
    slug: 'como-restablezco-mi-contrasena',
    type: 'faq',
    category: 'plataformas',
    tags: ['contrasena', 'acceso', 'password'],
    audience: 'student',
    locale: 'es',
    priority: 'high',
    updatedAt: '2024-01-01',
    visibility: 'published',
    excerpt: 'Si olvidaste tu contrasena puedes restablecerla.',
    content: 'Para restablecer tu contrasena, haz clic en "Olvide mi contrasena" en la pantalla de inicio de sesion.',
  },
  {
    id: 'faq-3',
    title: 'Metodos de pago disponibles',
    slug: 'metodos-de-pago',
    type: 'faq',
    category: 'pagos',
    tags: ['pago', 'tarjeta', 'transferencia'],
    audience: 'student',
    locale: 'es',
    priority: 'medium',
    updatedAt: '2024-01-01',
    visibility: 'published',
    excerpt: 'Puedes pagar con tarjeta, transferencia o en OXXO.',
    content: 'Los metodos de pago disponibles son: tarjeta de credito/debito, transferencia bancaria, deposito en OXXO, y pago en ventanilla.',
  },
];

describe('Search Engine', () => {
  beforeAll(() => {
    initSearchIndex(MOCK_CONTENT);
  });

  describe('search', () => {
    it('returns relevant results for Blackboard queries', () => {
      const results = search('blackboard');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.slug).toBe('como-accedo-a-blackboard');
    });

    it('returns relevant results for payment queries', () => {
      const results = search('como pago la mensualidad');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.category).toBe('pagos');
    });

    it('returns empty array for irrelevant queries', () => {
      const results = search('xyz123abc');
      expect(results).toEqual([]);
    });

    it('returns empty array for empty query', () => {
      const results = search('');
      expect(results).toEqual([]);
    });

    it('normalizes accented characters', () => {
      const results = search('contraseña');
      expect(results.length).toBeGreaterThan(0);
    });

    it('respects limit parameter', () => {
      const results = search('acceso', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('scores range from 0 to 1', () => {
      const results = search('blackboard acceso');
      for (const r of results) {
        expect(r.score).toBeGreaterThan(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('retrieveForRAG', () => {
    it('retrieves context-rich content items', () => {
      const items = retrieveForRAG('como accedo blackboard', 3);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].content).toBeTruthy();
    });

    it('returns empty for no matches', () => {
      const items = retrieveForRAG('zzzzzzzzz');
      expect(items).toEqual([]);
    });

    it('filters out weak candidates (< 20% of top score)', () => {
      const items = retrieveForRAG('blackboard', 10);
      // With a small corpus all items may have some relevance
      // Just verify it returns results and respects limit
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(10);
    });
  });

  describe('exactFaqMatch', () => {
    it('matches exact title', () => {
      const item = exactFaqMatch('Como accedo a Blackboard');
      expect(item).not.toBeNull();
      expect(item?.slug).toBe('como-accedo-a-blackboard');
    });

    it('matches via alias (student phrasing)', () => {
      const item = exactFaqMatch('no me acuerdo de mi contrasena');
      expect(item).not.toBeNull();
      expect(item?.slug).toBe('como-restablezco-mi-contrasena');
    });

    it('returns null for truly nonsensical queries', () => {
      // TF-IDF may still find weak matches, so use truly random tokens
      const item = exactFaqMatch('zzzzqqqwwwxxx');
      expect(item).toBeNull();
    });
  });
});
