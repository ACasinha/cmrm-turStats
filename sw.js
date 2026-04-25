// ============================================================
// SERVICE WORKER — Registo Diário de Nacionalidades
// Município de Reguengos de Monsaraz
// ============================================================

const CACHE_NAME    = 'rmz-nacionalidades-v2';
const CACHE_STATIC  = 'rmz-static-v2';

// Recursos a pré-cachear (shell da app)
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/ui.js',
  './js/api.js',
  './js/app.js',
  './js/pwa.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap'
];

// ============================================================
// INSTALL — pré-cachear o shell
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Falha no pré-cache:', err))
  );
});

// ============================================================
// ACTIVATE — limpar caches antigas
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — estratégia Network-first com fallback para cache
// Para chamadas ao Google Apps Script: network-only (precisam
// de autenticação e dados em tempo real).
// Para assets estáticos: cache-first.
// ============================================================
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignorar métodos que não sejam GET
  if (event.request.method !== 'GET') return;

  // Chamadas ao Apps Script — sempre network, nunca cachear
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets estáticos da app — cache-first
  if (
    url.includes('/css/') ||
    url.includes('/js/')  ||
    url.includes('/icons/') ||
    url.endsWith('manifest.json')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Google Fonts — cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Documento HTML principal — network-first com fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ============================================================
// MENSAGENS — permite forçar update a partir da app
// ============================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
