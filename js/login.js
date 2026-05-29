// ============================================================
// login.js — Lógica de autenticação centralizada
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var _erroLoginPendente = '';
var _opcoesLogin       = null;
var authInicializado = false;

function inicializarLogin(opcoes) {
  _opcoesLogin = opcoes;

  firebaseAuth.onAuthStateChanged(function(user) {

    if (!authInicializado) {
    authInicializado = true;
    if (!user) {
      _mostrarEcraLogin();
    }
    return;
    }
    
    if (user) {
      if (!sessaoValida()) {
            limparSessao();
            firebaseAuth.signOut();
            _mostrarEcraLogin();
            return;
          }
      obterPerfilUtilizador()
        .then(function(perfil) {

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
        .catch(function() {
          _mostrarEcraLogin();
        });

    } else {
      if (user) {
        limparSessao();
        firebaseAuth.signOut();
      }
      _mostrarEcraLogin();
    }
  });
}

function fazerLogin() {
  var email = document.getElementById('loginUser').value.trim();
  var pass  = document.getElementById('loginPass').value;
  var erro  = document.getElementById('loginErro');
  var btn   = document.getElementById('btnLogin');

  if (!email || !pass) {
    erro.textContent = 'Por favor preencha todos os campos.';
    erro.classList.add('visivel');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'A autenticar...';
  erro.classList.remove('visivel');

  apiAutenticar(email, pass,
    function onSuccess() {
      // onAuthStateChanged trata de tudo
    },
    function onFailure(err) {
      btn.disabled     = false;
      btn.textContent  = 'Entrar →';
      erro.textContent = err.message;
      erro.classList.add('visivel');
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }
  );
}

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

  apiLogout().then(function() {
    _mostrarEcraLogin();
  });
}

function _fazerSignOut() {
  if (typeof limparCacheUtilizador === 'function') limparCacheUtilizador();
  firebaseAuth.signOut();
}

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

  var loginPass = document.getElementById('loginPass');
  if (loginPass) loginPass.value = '';

  var erro = document.getElementById('loginErro');
  if (erro) {
    erro.classList.remove('visivel');
    if (_erroLoginPendente) {
      erro.textContent   = _erroLoginPendente;
      erro.classList.add('visivel');
      _erroLoginPendente = '';
    }
  }

  var btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = false; btn.textContent = 'Entrar →'; }
}

function _mostrarErroLogin(mensagem) {
  _erroLoginPendente = mensagem;
  var btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = false; btn.textContent = 'Entrar →'; }
}
