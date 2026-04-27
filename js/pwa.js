// ============================================================
// pwa.js — Service Worker e banner de instalação
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
        console.log('[PWA] Service Worker registado. Scope:', reg.scope);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              mostrarToast('🔄 Nova versão disponível. Recarregue a página.', 'info');
            }
          });
        });
      })
      .catch(err => console.warn('[PWA] Falha no registo do SW:', err));
  });
}

// ============================================================
// BANNER DE INSTALAÇÃO
// ============================================================

let deferredPrompt = null;
const CHAVE_BANNER_DISPENSADO = 'rmz_banner_dispensado';

function bannerFoiDispensado() {
  return localStorage.getItem(CHAVE_BANNER_DISPENSADO) === '1';
}

function dispensarBanner() {
  localStorage.setItem(CHAVE_BANNER_DISPENSADO, '1');
  document.getElementById('installBanner').classList.remove('visivel');
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  // Não mostrar se: já instalada, já em standalone, ou utilizador já dispensou
  const jaInstalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!jaInstalada && !bannerFoiDispensado()) {
    document.getElementById('installBanner').classList.add('visivel');
  }
});

document.getElementById('btnInstalar').addEventListener('click', () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    console.log('[PWA] Resposta:', choice.outcome);
    deferredPrompt = null;
    dispensarBanner();
  });
});

// Botão fechar (✕) — dispensar e não voltar a mostrar
document.getElementById('installBanner')
  .querySelector('.btn-instalar-fechar')
  .addEventListener('click', () => dispensarBanner());

// Ocultar imediatamente se já instalada
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  document.getElementById('installBanner').classList.remove('visivel');
}

// ============================================================
// RODAPÉ — INSTALAÇÃO E ATUALIZAÇÃO
// ============================================================

function instalarDoRodape() {
  if (!deferredPrompt) {
    mostrarToast('ℹ️ A app já está instalada ou o instalador não está disponível.', 'info');
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    console.log('[PWA] Instalação via rodapé:', choice.outcome);
    deferredPrompt = null;
  });
}

function verificarAtualizacao() {
  if (!('serviceWorker' in navigator)) {
    mostrarToast('⚠️ Service Worker não disponível.', 'aviso');
    return;
  }
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) {
      mostrarToast('⚠️ Nenhum Service Worker registado.', 'aviso');
      return;
    }
    reg.update().then(() => {
      mostrarToast('✅ A verificar atualizações...', 'sucesso');
      // O Service Worker vai emitir o evento updatefound se houver nova versão
    }).catch(err => {
      mostrarToast('❌ Erro ao verificar atualização: ' + err.message, 'erro');
    });
  });
}

// Ocultar botão instalar no rodapé se já instalada
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  const btnInstalarFooter = document.getElementById('btnInstalarFooter');
  if (btnInstalarFooter) btnInstalarFooter.style.display = 'none';
}
