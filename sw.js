// ============================================================
// sw.js — Service Worker
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

const CACHE_NAME   = 'rmz-nacionalidades-v3.0.0.1';
const CACHE_STATIC = 'rmz-static-v3.0.0.1';

const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/ui.js',
  './js/api.js',
  './js/app.js',
  './js/pwa.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap',
];

// INSTALL
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Falha no pré-cache:', err))
  );
});

// ACTIVATE — limpar caches antigas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_STATIC).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // Chamadas ao Apps Script — sempre network, nunca cachear
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Google Fonts — cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // Assets estáticos (css, js, icons, manifest) — cache-first
  if (url.includes('/css/') || url.includes('/js/') || url.includes('/icons/') || url.endsWith('manifest.json')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_STATIC).then(c => c.put(e.request, clone));
        return resp;
      }))
    );
    return;
  }

  // HTML principal — network-first com fallback para cache
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// Mensagens (ex: forçar update)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
