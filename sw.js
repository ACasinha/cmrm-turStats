// ============================================================
// sw.js — Service Worker
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// VERSÃO: incrementar CACHE_NAME a cada deploy para forçar update.
// O sw-update.js lê esta constante para mostrar a versão no rodapé.
// ============================================================

const CACHE_NAME   = 'rmz-nacionalidades-v1.5.1.b';
const CACHE_STATIC = 'rmz-static-v1.5.1.b';

const STATIC_ASSETS = [
  './index.html',
  './admin.html',
  './dashboard.html',
  './editor.html',
  './manifest.json',
  './css/style.css',
  './css/style-admin.css',
  './css/style-dashboard.css',
  './css/style-editor.css',
  './css/nav-menu.css',
  './js/api.js',
  './js/auth.js',
  './js/users.js',
  './js/login.js',
  './js/app.js',
  './js/admin.js',
  './js/dashboard.js',
  './js/editor.js',
  './js/editor-sticky.js',
  './js/data.js',
  './js/ui.js',
  './js/offline.js',
  './js/pwa.js',
  './js/sync.js',
  './js/sw-update.js',
  './js/nav-menu.js',
  './img/logo.png',
  './img/logo-small.png',
  './img/logo-turismo.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
];

// ── Pedidos que NUNCA devem ser interceptados pelo SW ────────
function ehPedidoDeRede(url) {
  return url.includes('cloudfunctions.net')
      || url.includes('identitytoolkit.googleapis.com')
      || url.includes('securetoken.googleapis.com')
      || url.includes('firebaseauth.googleapis.com')
      || url.includes('firestore.googleapis.com');
}

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function(cache) {
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
// ACTIVATE
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
// FETCH
// ============================================================
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url = e.request.url;

  if (ehPedidoDeRede(url)) return;

  if (url.includes('gstatic.com') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('jsdelivr.net')) {
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

  if (url.includes('/css/')   ||
      url.includes('/js/')    ||
      url.includes('/img/')   ||
      url.includes('/icons/') ||
      url.endsWith('manifest.json')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        var fetchPromise = fetch(e.request).then(function(resp) {
          var clone = resp.clone();
          caches.open(CACHE_STATIC).then(function(c) { c.put(e.request, clone); });
          return resp;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }

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
// BACKGROUND SYNC
//
// Disparado automaticamente pelo browser quando a rede
// regressa (Android Chrome e outros que suportam SyncManager).
// iOS Safari não suporta — o fallback é o evento 'online'
// em offline.js que chama syncSincronizarFila() directamente.
//
// O SW não tem acesso ao IndexedDB do cliente directamente —
// delega a sincronização para o cliente via postMessage.
// O cliente (sync.js) é quem conhece a fila e sabe chamar
// a Cloud Function com o token JWT correcto.
// ============================================================
self.addEventListener('sync', function(e) {
  if (e.tag === 'rmz-sync') {
    console.log('[SW] Background Sync disparado:', e.tag);
    e.waitUntil(
      // Notificar todos os clientes abertos para executar a sincronização
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        .then(function(clients) {
          if (clients.length === 0) {
            // Nenhum cliente aberto — a sincronização vai acontecer
            // quando o utilizador abrir a app (evento 'online' + initSync)
            console.log('[SW] Sem clientes abertos — sincronização adiada para próxima abertura.');
            return;
          }
          // Enviar mensagem ao primeiro cliente activo
          clients[0].postMessage({ type: 'EXECUTAR_SYNC' });
          console.log('[SW] Mensagem EXECUTAR_SYNC enviada ao cliente.');
        })
    );
  }
});

// ============================================================
// MENSAGENS — comunicação com o cliente
// ============================================================
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
