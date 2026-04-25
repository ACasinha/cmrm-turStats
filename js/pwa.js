// ============================================================
// pwa.js — Registo do Service Worker e banner de instalação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

// ============================================================
// SERVICE WORKER
// ============================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registado com sucesso. Scope:', reg.scope);

        // Verificar se existe uma nova versão disponível
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Existe uma atualização — informar o utilizador
              mostrarToast('🔄 Nova versão disponível. Recarregue a página.', 'info');
            }
          });
        });
      })
      .catch(err => {
        console.warn('[PWA] Falha no registo do Service Worker:', err);
      });

    // Recarregar automaticamente quando um novo SW toma controlo
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // Não forçar reload automático — deixar o utilizador decidir
      }
    });
  });
}

// ============================================================
// BANNER DE INSTALAÇÃO (Add to Home Screen)
// ============================================================

let deferredPrompt = null;

/**
 * Captura o evento beforeinstallprompt e mostra o banner de instalação.
 */
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.add('visivel');
});

/**
 * Ao clicar no botão "Instalar", abre o diálogo nativo do browser.
 */
document.getElementById('btnInstalar').addEventListener('click', () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  deferredPrompt.userChoice.then(choice => {
    console.log('[PWA] Resposta do utilizador:', choice.outcome);
    deferredPrompt = null;
    document.getElementById('installBanner').classList.remove('visivel');
  });
});

/**
 * Esconde o banner ao clicar em "✕" (definido inline no HTML).
 * O handler está no atributo onclick do botão no index.html.
 */

/**
 * Ocultar o banner se a app já foi instalada (standalone mode).
 */
if (window.matchMedia('(display-mode: standalone)').matches) {
  document.getElementById('installBanner').classList.remove('visivel');
}

/**
 * iOS Safari — verificar se já foi adicionada ao ecrã inicial.
 * (navigator.standalone é específico de Safari/iOS)
 */
if (navigator.standalone === true) {
  document.getElementById('installBanner').classList.remove('visivel');
}
