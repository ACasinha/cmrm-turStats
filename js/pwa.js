// ============================================================
// pwa.js — Service Worker, instalação e actualizações
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var _swRegistration          = null;
var _deferredPrompt          = null;
var CHAVE_BANNER_DISPENSADO  = 'rmz_banner_dispensado';

// ── Versão (lida do sw.js via fetch) ─────────────────────────
function mostrarVersao() {
  fetch('sw.js', { cache: 'no-store' })
    .then(function(r) { return r.text(); })
    .then(function(txt) {
      var match = txt.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        var versao = match[1].replace('rmz-nacionalidades-', 'v');
        var el = document.getElementById('rodapeVersao');
        if (el) el.textContent = versao;
      }
    })
    .catch(function() {});
}

// ============================================================
// SERVICE WORKER
// ============================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js')
      .then(function(reg) {
        _swRegistration = reg;
        console.log('[PWA] SW registado. Scope:', reg.scope);
        mostrarVersao();

        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível
              mostrarToast('🔄 Nova versão disponível! Guarde os dados e clique em "Verificar atualização".', 'info');
            }
          });
        });
      })
      .catch(function(err) {
        console.warn('[PWA] Falha no registo do SW:', err);
      });

    // Recarregar quando novo SW toma controlo
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
  });
}

// ============================================================
// VERIFICAR ATUALIZAÇÃO (botão no rodapé)
// ============================================================

function verificarAtualizacao() {
  var btn = document.getElementById('btnVerificarUpdate');
  btn.disabled    = true;
  btn.textContent = '⏳ A verificar...';

  if (!_swRegistration) {
    mostrarToast('Service Worker não disponível.', 'info');
    btn.disabled    = false;
    btn.textContent = '🔄 Verificar atualização';
    return;
  }

  _swRegistration.update()
    .then(function() {
      var temNovo = _swRegistration.waiting || _swRegistration.installing;
      if (temNovo) {
        mostrarToast('🔄 Nova versão encontrada! Guarde os dados — a app irá atualizar.', 'info');
        setTimeout(function() {
          if (_swRegistration.waiting) {
            _swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }, 3000);
      } else {
        mostrarToast('✓ A app está atualizada.', 'sucesso');
      }
    })
    .catch(function(err) {
      mostrarToast('Erro ao verificar: ' + err.message, 'erro');
    })
    .finally(function() {
      btn.disabled    = false;
      btn.textContent = '🔄 Verificar atualização';
    });
}

// ============================================================
// BANNER DE INSTALAÇÃO (topo — primeira abertura)
// ============================================================

function bannerFoiDispensado() {
  return localStorage.getItem(CHAVE_BANNER_DISPENSADO) === '1';
}

function dispensarBanner() {
  localStorage.setItem(CHAVE_BANNER_DISPENSADO, '1');
  document.getElementById('installBanner').classList.remove('visivel');
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _deferredPrompt = e;

  // Banner topo — só se não dispensado e não em standalone
  var jaInstalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!jaInstalada && !bannerFoiDispensado()) {
    document.getElementById('installBanner').classList.add('visivel');
  }

  // Botão no rodapé — sempre visível se instalável
  var btnRodape = document.getElementById('btnInstalarRodape');
  if (btnRodape) btnRodape.style.display = '';
});

window.addEventListener('appinstalled', function() {
  _deferredPrompt = null;
  dispensarBanner();
  var btnRodape = document.getElementById('btnInstalarRodape');
  if (btnRodape) btnRodape.style.display = 'none';
  mostrarToast('✓ App instalada com sucesso!', 'sucesso');
});

// Botão instalar — topo
var btnInstalar = document.getElementById('btnInstalar');
if (btnInstalar) {
  btnInstalar.addEventListener('click', function() { instalarApp(); });
}

// Botão fechar — topo
var btnFechar = document.getElementById('btnInstalarFechar');
if (btnFechar) {
  btnFechar.addEventListener('click', function() { dispensarBanner(); });
}

// ============================================================
// INSTALAR APP (usado pelo botão do rodapé e do banner)
// ============================================================

function instalarApp() {
  if (!_deferredPrompt) {
    mostrarToast('A instalação não está disponível neste momento ou a app já está instalada.', 'info');
    return;
  }
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(function(choice) {
    console.log('[PWA] Resposta:', choice.outcome);
    _deferredPrompt = null;
    dispensarBanner();
    var btnRodape = document.getElementById('btnInstalarRodape');
    if (btnRodape) btnRodape.style.display = 'none';
  });
}

// Ocultar banner topo se já em standalone
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  var b = document.getElementById('installBanner');
  if (b) b.classList.remove('visivel');
}
