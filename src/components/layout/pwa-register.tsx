'use client';

import { useEffect } from 'react';

/**
 * PWARegister — registra el service worker de forma silenciosa.
 * Se monta una sola vez en el RootLayout y no renderiza nada visible.
 * Solo actúa en navegadores que soportan service workers (todos los modernos).
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Nueva versión disponible — no forzar activación inmediata
              // para no romper el estado del usuario si está en medio de un chat
              console.info('[Ana PWA] Nueva versión disponible. Se activará en la próxima visita.');
            }
          });
        });

        console.info('[Ana PWA] Service worker registrado:', registration.scope);
      } catch (error) {
        // No bloquear la app si el SW falla — solo registrar en consola
        console.warn('[Ana PWA] No se pudo registrar el service worker:', error);
      }
    };

    // Registrar después de que la página cargue para no competir con recursos críticos
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW, { once: true });
    }
  }, []);

  // No renderiza nada — componente de efectos puro
  return null;
}
