/**
 * Service Worker — Ana CNCI PWA
 * Estrategias de caché:
 *   - App shell (HTML/CSS/JS): Cache First con revalidación en background
 *   - API calls (/api/*): Network First con fallback a caché
 *   - Activos estáticos (imágenes, fuentes): Cache First con TTL largo
 *   - Navegación: Network First con fallback a /offline.html
 */

const CACHE_VERSION = 'ana-cnci-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Recursos del app shell que se cachean en la instalación
const APP_SHELL_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/logo-cnci.png',
  '/favicon.ico',
];

// ── Instalación: precachear el app shell ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // addAll falla si algún recurso no carga — usamos add individual con try/catch
      return Promise.allSettled(
        APP_SHELL_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] No se pudo cachear ${url}:`, err);
          })
        )
      );
    })
  );
  // Activar inmediatamente sin esperar que se cierren las pestañas anteriores
  self.skipWaiting();
});

// ── Activación: limpiar cachés antiguas ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('ana-cnci-') && key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => {
            console.log('[SW] Eliminando caché obsoleta:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Tomar control de todas las pestañas abiertas inmediatamente
  self.clients.claim();
});

// ── Fetch: estrategias por tipo de recurso ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones de extensiones de navegador o chrome-extension
  if (!url.protocol.startsWith('http')) return;

  // Ignorar peticiones de terceros — no cachear cross-origin (riesgo de opaque responses)
  if (url.origin !== self.location.origin) {
    return;
  }

  // API calls → Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // Navegación HTML → Network First con fallback offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Activos estáticos (imágenes, CSS, JS, fuentes) → Cache First
  event.respondWith(cacheFirstWithNetworkFallback(request));
});

// ── Estrategia: Network First para API ───────────────────────────────────────
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Sin conexión. Por favor intenta más tarde.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ── Estrategia: Network First para navegación con fallback offline ────────────
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback a la raíz si está cacheada, si no, offline.html
    const root = await caches.match('/');
    if (root) return root;
    const offline = await caches.match('/offline.html');
    return offline || new Response('<h1>Sin conexión</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}

// ── Estrategia: Cache First para activos estáticos ───────────────────────────
async function cacheFirstWithNetworkFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── Estrategia: Network First genérica con caché ─────────────────────────────
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 408 });
  }
}

// ── Mensaje desde el cliente para forzar actualización ───────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
