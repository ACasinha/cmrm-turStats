// ============================================================
// sw.js — Service Worker
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// VERSÃO: incrementar CACHE_NAME a cada deploy para forçar update.
// O pwa.js lê esta constante para mostrar a versão no rodapé.
// ============================================================

const CACHE_NAME   = 'rmz-nacionalidades-v1.2.1';
const CACHE_STATIC = 'rmz-static-v1.2.1';

// Todos os assets necessários para a app funcionar offline.
// Adicionar aqui qualquer novo ficheiro que seja criado.
const STATIC_ASSETS = [
  './index.html',
  './admin.html',
  './manifest.json',
  './css/style.css',
  './css/style-admin.css',
  './js/data.js',
  './js/ui.js',
  './js/api.js',
  './js/app.js',
  './js/pwa.js',
  './js/sw-update.js',
  './js/offline.js',
  './js/users.js',
  './js/cloud-function-users.js',
  './img/logo.png',
  './img/logo-turismo.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
];

// ── Pedidos que NUNCA devem ser interceptados pelo SW ────────
// (requerem sempre rede — falham graciosamente se offline)
function ehPedidoDeRede(url) {
  return url.includes('cloudfunctions.net')      // Cloud Function
      || url.includes('identitytoolkit.googleapis.com') // Firebase Auth API
      || url.includes('securetoken.googleapis.com')      // Firebase token refresh
      || url.includes('firebaseauth.googleapis.com');
}

// ============================================================
// INSTALL — pré-cachear todos os assets
// ============================================================
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function(cache) {
        // addAll falha se qualquer recurso não carregar.
        // Usamos Promise.allSettled para não bloquear em assets opcionais.
        return Promise.allSettled(
          STATIC_ASSETS.map(function(url) {
            return cache.add(url).catch(function(err) {
              console.warn('[SW] Falha ao cachear:', url, err.message);
            });
          })
        );
      })
      .then(function() { return self.skipWaiting(); })
  );
});

// ============================================================
// ACTIVATE — limpar caches de versões anteriores
// ============================================================
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(k) { return k !== CACHE_NAME && k !== CACHE_STATIC; })
            .map(function(k) {
              console.log('[SW] A apagar cache antiga:', k);
              return caches.delete(k);
            })
        );
      })
      .then(function() { return self.clients.claim(); })
  );
});

// ============================================================
// FETCH — estratégias por tipo de pedido
// ============================================================
self.addEventListener('fetch', function(e) {
  // Ignorar métodos não-GET (POST, etc.)
  if (e.request.method !== 'GET') return;

  var url = e.request.url;

  // ── 1. Pedidos de rede pura — nunca interceptar ──────────
  // Se offline, o browser recebe o erro de rede normalmente
  // e o offline.js trata de bloquear a UI.
  if (ehPedidoDeRede(url)) return;

  // ── 2. Firebase SDK e Google Fonts — cache-first ─────────
  // Recursos externos essenciais: cachear na primeira visita,
  // servir da cache offline.
  if (url.includes('gstatic.com') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(resp) {
          var clone = resp.clone();
          caches.open(CACHE_STATIC).then(function(c) { c.put(e.request, clone); });
          return resp;
        });
      })
    );
    return;
  }

  // ── 3. Assets estáticos locais — cache-first ─────────────
  // CSS, JS, imagens, icons, manifest: servir da cache,
  // actualizar em background (stale-while-revalidate).
  if (url.includes('/css/')      ||
      url.includes('/js/')       ||
      url.includes('/img/')      ||
      url.includes('/icons/')    ||
      url.endsWith('manifest.json')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        // Actualizar em background mesmo servindo da cache
        var fetchPromise = fetch(e.request).then(function(resp) {
          var clone = resp.clone();
          caches.open(CACHE_STATIC).then(function(c) { c.put(e.request, clone); });
          return resp;
        }).catch(function() { return cached; });

        // Servir imediatamente da cache se disponível
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── 4. HTML principal — network-first com fallback ───────
  // Tentar rede primeiro para ter sempre conteúdo actualizado.
  // Se offline, servir da cache (a app abre na mesma).
  e.respondWith(
    fetch(e.request)
      .then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
        return resp;
      })
      .catch(function() {
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});

// ============================================================
// MENSAGENS — comunicação com o cliente (pwa.js)
// ============================================================
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
