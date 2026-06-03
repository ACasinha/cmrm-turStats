// ============================================================
// login.js — UI de login e ciclo de sessão nas páginas
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Responsabilidade:
//   • Mostrar/esconder o overlay de login
//   • Submeter credenciais (delega em auth.js → apiAutenticar)
//   • Observar sessões persistidas e logout via apiObservarAuth
//   • Chamar onSucesso / onSessaoTerminada das páginas
//
// NÃO contém: Firebase init, JWT, gestão de sessão (auth.js),
// lógica de negócio (app.js).
// ============================================================

'use strict';

var _opcoesLogin       = null;
var _erroLoginPendente = '';

// ============================================================
// inicializarLogin — ponto de entrada de cada página
//
// opcoes = {
//   idWrap:            string | null
//   verificarAcesso:   fn(perfil) → bool
//   mensagemSemAcesso: string
//   onSucesso:         fn(perfil)
//   onSessaoTerminada: fn()
// }
// ============================================================

function inicializarLogin(opcoes) {
  _opcoesLogin = opcoes;

  // Ocultar overlay imediatamente se há sessão local válida,
  // para evitar o flash do ecrã de login durante a navegação.
  // O onAuthStateChanged confirma (ou desfaz) a seguir.
  if (typeof sessaoValida === 'function' && sessaoValida()) {
    var overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.visibility = 'hidden';
  }

  if (
  typeof sessaoValida === 'function' &&
  sessaoValida()
) {

   var perfilCache = sessionStorage.getItem('perfilUtilizador');

var cache = null;
var cacheValida = false;

if (perfilCache) {
  try {
    cache = JSON.parse(perfilCache);

    if (
      cache &&
      cache.uid &&
      cache.timestamp &&
      (Date.now() - cache.timestamp < 5 * 60 * 1000)
    ) {
      cacheValida = true;
    } else {
      sessionStorage.removeItem('perfilUtilizador');
    }

  } catch (e) {
    sessionStorage.removeItem('perfilUtilizador');
  }
} 

}

  // Usado apenas para sessões persistidas (refresh de página)
  // e para logout. O login activo é tratado em fazerLogin().
  apiObservarAuth(function (user) {
    if (!user) {
      _mostrarEcraLogin();
      return;
    }
    _processarUtilizador(user);
  });
}

// ============================================================
// fazerLogin — chamado pelo botão "Entrar" no HTML
// ============================================================

function fazerLogin() {
  var email = ((document.getElementById('loginUser') || {}).value || '').trim();
  var pass  =  (document.getElementById('loginPass') || {}).value || '';
  var erro  = document.getElementById('loginErro');
  var btn   = document.getElementById('btnLogin');

  if (!email || !pass) {
    _mostrarErroCampo(erro, 'Por favor preencha todos os campos.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'A autenticar...'; }
  if (erro) erro.classList.remove('visivel');

  apiAutenticar(
    email,
    pass,
    function onSuccess(dados) {
      // apiAutenticar já registou a sessão; agora só precisamos
      // de obter o perfil Firestore e desbloquear a página.
      // Não dependemos do onAuthStateChanged para este caminho.
      _processarUtilizador(dados);
    },
    function onFailure(err) {
      if (btn) { btn.disabled = false; btn.textContent = 'Entrar →'; }
      _mostrarErroCampo(erro, err.message);
      var passEl = document.getElementById('loginPass');
      if (passEl) { passEl.value = ''; passEl.focus(); }
    }
  );
}

// ============================================================
// logout — chamado pelas páginas
// ============================================================

function logout(temAlteracoes) {
  if (temAlteracoes) {
    if (!confirm('Tem alterações por guardar. Tem a certeza que quer sair?')) return;
  } else {
    if (!confirm('Deseja terminar a sessão?')) return;
  }

  if (typeof limparCacheUtilizador === 'function') limparCacheUtilizador();

  if (_opcoesLogin && typeof _opcoesLogin.onSessaoTerminada === 'function') {
    _opcoesLogin.onSessaoTerminada();
  }

  sessionStorage.removeItem('perfilUtilizador');
  // Após apiLogout, o onAuthStateChanged dispara com user=null
  // e _mostrarEcraLogin() é chamado automaticamente.
  apiLogout();
}

// ============================================================
// _processarUtilizador — partilhado pelo login activo e pelo
// listener de sessões persistidas
// ============================================================

function _processarUtilizador(userOuDados) {

  // 1. Tentar usar cache imediatamente
  var perfilCache =
  sessionStorage.getItem('perfilUtilizador');

var perfil = null;
var cacheValida = false;

if (perfilCache) {
  try {
    var cache = JSON.parse(perfilCache);

    if (
      cache &&
      cache.perfil &&
      cache.timestamp &&
      (Date.now() - cache.timestamp < 5 * 60 * 1000) // 5 min
    ) {
      perfil = cache.perfil;
      cacheValida = true;
    } else {
      sessionStorage.removeItem('perfilUtilizador');
    }

  } catch (e) {
    sessionStorage.removeItem('perfilUtilizador');
  }
}

  if (cacheValida) {

  if (
    perfil.ativo &&
    _opcoesLogin.verificarAcesso(perfil)
  ) {

    _esconderEcraLogin();
    _opcoesLogin.onSucesso(perfil);

  }
}

  // 2. Atualizar sempre a partir do Firestore
  obterPerfilUtilizador()
    .then(function(perfil) {

      sessionStorage.setItem(
  'perfilUtilizador',
  JSON.stringify({
    uid: perfil.uid,
    nome: perfil.nome,
    email: perfil.email,
    timestamp: Date.now()
  })
 );

      if (!perfil.ativo) {

        sessionStorage.removeItem(
          'perfilUtilizador'
        );

        _mostrarErroLogin(
          'Esta conta foi desativada. Contacte o administrador.'
        );

        _fazerSignOut();

        return;
      }

      if (!_opcoesLogin.verificarAcesso(perfil)) {

        sessionStorage.removeItem(
          'perfilUtilizador'
        );

        _mostrarErroLogin(
          _opcoesLogin.mensagemSemAcesso ||
          'Acesso negado.'
        );

        _fazerSignOut();

        return;
      }

      // Atualizar cache
      sessionStorage.setItem(
      'perfilUtilizador',
      JSON.stringify({
      timestamp: Date.now(),
      perfil: perfil
      })
        );

      // Só atualizar UI se ainda não foi mostrada
      var overlay =
        document.getElementById('loginOverlay');

      var loginVisivel =
        overlay &&
        !overlay.classList.contains('hidden');

      if (loginVisivel) {

        _esconderEcraLogin();

        _opcoesLogin.onSucesso(perfil);

      }

    })
    .catch(function() {

      // Se não havia cache, mostrar login
      if (!perfilCache) {

        _mostrarEcraLogin();

      }

    });

}

// ============================================================
// Auxiliares de UI — privados
// ============================================================

function _esconderEcraLogin() {
  var overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.add('hidden');

  if (_opcoesLogin && _opcoesLogin.idWrap) {
    var wrap = document.getElementById(_opcoesLogin.idWrap);
    if (wrap) wrap.style.display = '';
  }
}

function _mostrarEcraLogin() {
  var overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.remove('hidden');

  if (_opcoesLogin && _opcoesLogin.idWrap) {
    var wrap = document.getElementById(_opcoesLogin.idWrap);
    if (wrap) wrap.style.display = 'none';
  }

  var passEl = document.getElementById('loginPass');
  if (passEl) passEl.value = '';

  var btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = false; btn.textContent = 'Entrar →'; }

  var erro = document.getElementById('loginErro');
  if (erro) {
    erro.classList.remove('visivel');
    if (_erroLoginPendente) {
      _mostrarErroCampo(erro, _erroLoginPendente);
      _erroLoginPendente = '';
    }
  }
}

function _mostrarErroLogin(mensagem) {
  _erroLoginPendente = mensagem;
}

function _mostrarErroCampo(erroEl, mensagem) {
  if (!erroEl) return;
  erroEl.textContent = mensagem;
  erroEl.classList.add('visivel');
}

function _fazerSignOut() {
  sessionStorage.removeItem('perfilUtilizador');
  if (typeof limparCacheUtilizador === 'function') limparCacheUtilizador();
  firebaseAuth.signOut();
}
