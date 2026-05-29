// ============================================================
// login.js — UI de login e ciclo de sessão nas páginas
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Responsabilidade:
//   • Mostrar/esconder o overlay de login
//   • Submeter credenciais (delega em auth.js → apiAutenticar)
//   • Observar mudanças de estado via apiObservarAuth (auth.js)
//   • Chamar onSucesso / onSessaoTerminada das páginas
//
// NÃO contém: Firebase init, JWT, gestão de sessão (auth.js),
// lógica de negócio (app.js).
// ============================================================

'use strict';

// Opções fornecidas por cada página ao chamar inicializarLogin()
var _opcoesLogin       = null;

// Mensagem de erro a mostrar depois de o overlay reaparecer
// (necessário porque o DOM pode ainda não estar visível)
var _erroLoginPendente = '';

// ============================================================
// inicializarLogin — ponto de entrada de cada página
//
// opcoes = {
//   idWrap:            string | null   — id do contentor principal da página
//   verificarAcesso:   fn(perfil)→bool — controlo de acesso por role
//   mensagemSemAcesso: string          — texto se sem permissão
//   onSucesso:         fn(perfil)      — callback após login válido
//   onSessaoTerminada: fn()            — callback após logout/expiração
// }
// ============================================================

function inicializarLogin(opcoes) {
  _opcoesLogin = opcoes;

  // Subscrever mudanças de autenticação (definido em auth.js).
  // Este listener é o único que decide se a UI de login aparece
  // ou se a página é desbloqueada.
  apiObservarAuth(function (user) {
    if (!user) {
      // Sem utilizador → mostrar ecrã de login
      _mostrarEcraLogin();
      return;
    }

    // Utilizador autenticado → obter perfil completo do Firestore
    obterPerfilUtilizador()
      .then(function (perfil) {
        if (!perfil.ativo) {
          _mostrarErroLogin('Esta conta foi desativada. Contacte o administrador.');
          _fazerSignOut();
          return;
        }

        if (!opcoes.verificarAcesso(perfil)) {
          _mostrarErroLogin(opcoes.mensagemSemAcesso || 'Acesso negado.');
          _fazerSignOut();
          return;
        }

        _esconderEcraLogin();
        opcoes.onSucesso(perfil);
      })
      .catch(function () {
        // Falha ao ler o perfil (ex.: sem ligação após refresh)
        _mostrarEcraLogin();
      });
  });
}

// ============================================================
// fazerLogin — chamado pelo botão "Entrar" no HTML
// ============================================================

function fazerLogin() {
  var email = (document.getElementById('loginUser')  || {}).value || '';
  var pass  = (document.getElementById('loginPass')  || {}).value || '';
  var erro  = document.getElementById('loginErro');
  var btn   = document.getElementById('btnLogin');

  email = email.trim();

  if (!email || !pass) {
    _mostrarErroCampo(erro, 'Por favor preencha todos os campos.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'A autenticar...'; }
  if (erro) erro.classList.remove('visivel');

  // Delega autenticação em auth.js.
  // O onAuthStateChanged em inicializarLogin() trata do resto.
  apiAutenticar(
    email,
    pass,
    function onSuccess() {
      // Não fazer nada aqui: apiObservarAuth irá disparar
      // com o utilizador já autenticado e chamar onSucesso.
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
// logout — chamado pelas páginas que precisam de sair
//
// temAlteracoes: true → pede confirmação antes de sair
// ============================================================

function logout(temAlteracoes) {
  if (temAlteracoes) {
    if (!confirm('Tem alterações por guardar. Tem a certeza que quer sair?')) return;
  } else {
    if (!confirm('Deseja terminar a sessão?')) return;
  }

  // Limpar cache de perfil (users.js) antes de sair
  if (typeof limparCacheUtilizador === 'function') limparCacheUtilizador();

  if (_opcoesLogin && typeof _opcoesLogin.onSessaoTerminada === 'function') {
    _opcoesLogin.onSessaoTerminada();
  }

  // apiLogout está em auth.js; o onAuthStateChanged re-mostrará o login
  apiLogout().then(function () {
    _mostrarEcraLogin();
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

  // Limpar password ao reabrir o login
  var passEl = document.getElementById('loginPass');
  if (passEl) passEl.value = '';

  // Repor botão
  var btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = false; btn.textContent = 'Entrar →'; }

  // Mostrar erro pendente (ex.: "conta desactivada")
  var erro = document.getElementById('loginErro');
  if (erro) {
    erro.classList.remove('visivel');
    if (_erroLoginPendente) {
      _mostrarErroCampo(erro, _erroLoginPendente);
      _erroLoginPendente = '';
    }
  }
}

// Mensagem de erro a apresentar assim que o overlay estiver visível.
// Útil quando o signOut ainda não propagou e o overlay está oculto.
function _mostrarErroLogin(mensagem) {
  _erroLoginPendente = mensagem;
}

function _mostrarErroCampo(erroEl, mensagem) {
  if (!erroEl) return;
  erroEl.textContent = mensagem;
  erroEl.classList.add('visivel');
}

// Faz signOut sem confirmação (usado por verificarAcesso falhado)
function _fazerSignOut() {
  if (typeof limparCacheUtilizador === 'function') limparCacheUtilizador();
  firebaseAuth.signOut();
}
