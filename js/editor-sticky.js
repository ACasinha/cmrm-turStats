// ============================================================
// editor-sticky.js — Cabeçalho fixo da grelha mensal
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Problema a resolver:
//   position:sticky no <thead> não funciona para scroll vertical
//   quando o contentor pai tem overflow-x:auto (limitação CSS/browser).
//
// Solução:
//   1. Clonar o <thead> para um elemento fixed na viewport.
//   2. Mostrar/ocultar o clone conforme o thead original sai de vista.
//   3. Sincronizar o scroll horizontal do clone com o .grelha-wrapper.
//   4. A coluna de países (sticky left) e de total (sticky right)
//      já funcionam via CSS porque o scroll X é do .grelha-wrapper.
// ============================================================

'use strict';

(function() {

  var _clone        = null;   // o elemento fixed que aparece no topo
  var _wrapper      = null;   // .grelha-wrapper
  var _tabela       = null;   // .grelha-tabela
  var _theadOrig    = null;   // <thead> original
  var _headerGlobal = null;   // .header (sticky global da página)
  var _ativo        = false;  // true quando o clone está visível
  var _rafPendente  = false;  // controlo de requestAnimationFrame

  // ── Criar o clone do thead ────────────────────────────────
  function criarClone() {
    destruirClone();

    _wrapper      = document.getElementById('grelhaWrapper');
    _tabela       = _wrapper && _wrapper.querySelector('.grelha-tabela');
    _theadOrig    = _tabela  && _tabela.querySelector('thead');
    _headerGlobal = document.querySelector('.header');

    if (!_wrapper || !_tabela || !_theadOrig) return;

    // Contentor fixed
    var div = document.createElement('div');
    div.className = 'grelha-thead-clone';
    div.id        = 'grelhaTheadClone';

    // Tabela dentro do clone (mesma largura e colgroup que o original)
    var tbl = document.createElement('table');
    tbl.className = _tabela.className;

    // Copiar colgroup se existir (garante larguras idênticas)
    var cgOrig = _tabela.querySelector('colgroup');
    if (cgOrig) tbl.appendChild(cgOrig.cloneNode(true));

    // Clonar o thead
    tbl.appendChild(_theadOrig.cloneNode(true));
    div.appendChild(tbl);
    document.body.appendChild(div);
    _clone = div;

    // Sincronizar scroll horizontal imediatamente
    sincronizarScrollH();
  }

  function destruirClone() {
    var old = document.getElementById('grelhaTheadClone');
    if (old) old.parentNode.removeChild(old);
    _clone = null;
    _ativo = false;
  }

  // ── Actualizar posição e visibilidade ────────────────────
  function actualizar() {
    if (!_clone || !_wrapper || !_theadOrig) return;

    var headerH    = _headerGlobal ? _headerGlobal.getBoundingClientRect().bottom : 0;
    var wrapperRect = _wrapper.getBoundingClientRect();
    var theadRect   = _theadOrig.getBoundingClientRect();

    // O clone aparece quando o topo do thead original sai de vista
    // (passa acima do header global sticky)
    var deveEstarAtivo = theadRect.bottom < headerH + 4
                      && wrapperRect.bottom > headerH + 40;

    if (deveEstarAtivo !== _ativo) {
      _clone.style.display = deveEstarAtivo ? '' : 'none';
      _ativo = deveEstarAtivo;
    }

    if (!_ativo) return;

    // Posicionar o clone: topo = fundo do header global
    _clone.style.top = headerH + 'px';

    // Largura e posição horizontal do clone = do wrapper
    _clone.style.left  = wrapperRect.left + 'px';
    _clone.style.width = wrapperRect.width + 'px';

    // Sincronizar scroll horizontal
    sincronizarScrollH();
  }

  function sincronizarScrollH() {
    if (!_clone || !_wrapper) return;
    var tbl = _clone.querySelector('table');
    if (tbl) {
      // Deslocar a tabela interna do clone pelo mesmo scrollLeft do wrapper
      tbl.style.transform = 'translateX(-' + _wrapper.scrollLeft + 'px)';
      // A largura da tabela interna = largura total da tabela real
      tbl.style.width = _tabela.offsetWidth + 'px';
      tbl.style.minWidth = _tabela.offsetWidth + 'px';
    }
  }

  // ── Throttle via rAF ─────────────────────────────────────
  function agendarActualizacao() {
    if (_rafPendente) return;
    _rafPendente = true;
    requestAnimationFrame(function() {
      _rafPendente = false;
      actualizar();
    });
  }

  // ── Reconstruir o clone quando a grelha é (re)construída ─
  // A função construirGrelha() em editor.js reconstrói o DOM
  // da tabela — precisamos recriar o clone depois disso.
  function hookConstruirGrelha() {
    // Aguardar que o DOM esteja pronto e que construirGrelha exista
    if (typeof construirGrelha === 'undefined') {
      setTimeout(hookConstruirGrelha, 100);
      return;
    }

    var _orig = construirGrelha;
    construirGrelha = function() {
      // Chamar o original primeiro
      _orig.apply(this, arguments);
      // Depois de o DOM estar actualizado, recriar o clone
      // (setTimeout 0 garante que o browser pintou o novo DOM)
      setTimeout(function() {
        criarClone();
        actualizar();
      }, 0);
    };
  }

  // ── Event listeners ──────────────────────────────────────
  function ligarEventos() {
    window.addEventListener('scroll',  agendarActualizacao, { passive: true });
    window.addEventListener('resize',  agendarActualizacao, { passive: true });

    // Scroll horizontal do wrapper → actualizar translateX do clone
    document.addEventListener('scroll', function(e) {
      if (e.target === _wrapper) agendarActualizacao();
    }, { passive: true, capture: true });
  }

  // ── Inicialização ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    hookConstruirGrelha();
    ligarEventos();

    // Observar o wrapper para detectar quando a grelha aparece
    // (é criada dinamicamente após login + carregarMes)
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length) {
          var wrapper = document.getElementById('grelhaWrapper');
          if (wrapper && wrapper.querySelector('.grelha-tabela')) {
            // Pequeno delay para garantir que o layout está estável
            setTimeout(function() {
              criarClone();
              actualizar();
            }, 50);
            break;
          }
        }
      }
    });

    var areaPrincipal = document.getElementById('areaPrincipal');
    if (areaPrincipal) {
      observer.observe(areaPrincipal, { childList: true, subtree: true });
    }
  });

})();
