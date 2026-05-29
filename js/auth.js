// ============================================================
// auth.js — Autenticação Firebase e gestão de sessão
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Responsabilidade:
//   • Registar/encerrar sessão com limite de 10 horas
//   • Expor obterIdToken() para api.js
//   • Expor apiAutenticar() / apiLogout() / apiObservarAuth()
//     para login.js
//
// NÃO contém: configuração Firebase (api.js), UI (login.js),
// lógica de negócio (app.js / editor.js).
// ============================================================

'use strict';

// ── Constantes de sessão ─────────────────────────────────────

var SESSAO_MAX_MS  = 10 * 60 * 60 * 1000; // 10 horas
var CHAVE_LOGIN_TS = 'rmz_login_ts';

// ============================================================
// Gestão do timestamp de sessão
// Guardado em localStorage; expirado após SESSAO_MAX_MS.
// ============================================================

function registarInicioSessao() {
  localStorage.setItem(CHAVE_LOGIN_TS, String(Date.now()));
}

function sessaoValida() {
  var ts = localStorage.getItem(CHAVE_LOGIN_TS);
  if (!ts) return false;
  return (Date.now() - parseInt(ts, 10)) < SESSAO_MAX_MS;
}

function limparSessao() {
  localStorage.removeItem(CHAVE_LOGIN_TS);
}

// ============================================================
// obterIdToken — usado exclusivamente por api.js / chamarAPI()
//
// Valida a sessão local antes de pedir o JWT ao Firebase.
// Tenta primeiro o token em cache; forças refresh só se falhar.
// ============================================================

function obterIdToken() {
  if (!sessaoValida()) {
    limparSessao();
    return firebaseAuth.signOut().then(function () {
      return Promise.reject(
        new Error('A sessão expirou após 10 horas. Por favor faça login novamente.')
      );
    });
  }

  var user = firebaseAuth.currentUser;
  if (!user) {
    limparSessao();
    return Promise.reject(
      new Error('Sessão terminada. Por favor faça login novamente.')
    );
  }

  // getIdToken(false) → usa cache; (true) → força refresh no servidor
  return user.getIdToken(false).catch(function () {
    return user.getIdToken(true);
  });
}

// ============================================================
// apiAutenticar — chamado por login.js ao submeter o formulário
//
// Fluxo:
//   1. signOut preventivo (garante estado limpo)
//   2. signInWithEmailAndPassword
//   3. Regista timestamp de sessão
//   4. Chama onSuccess com dados básicos do utilizador
//
// O onAuthStateChanged em login.js detecta a mudança e obtém
// o perfil completo do Firestore (via users.js).
// ============================================================

function apiAutenticar(email, password, onSuccess, onFailure) {
  var respondido = false;

  var timeoutId = setTimeout(function () {
    if (respondido) return;
    respondido = true;
    onFailure({ message: 'Sem resposta do servidor de autenticação.' });
  }, 15000);

  firebaseAuth.signOut()
    .catch(function () {})                            // ignorar erro de signOut preventivo
    .then(function () {
      return firebaseAuth.signInWithEmailAndPassword(email, password);
    })
    .then(function (credencial) {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);

      registarInicioSessao();

      onSuccess({
        sucesso:         true,
        nomeFuncionario: credencial.user.displayName || credencial.user.email,
        email:           credencial.user.email,
        uid:             credencial.user.uid
      });
    })
    .catch(function (err) {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);
      onFailure({ message: _mensagemErroAuth(err) });
    });
}

// ============================================================
// apiLogout — chamado por login.js quando o utilizador sai
// ============================================================

function apiLogout() {
  limparSessao();
  return firebaseAuth.signOut();
}

// ============================================================
// apiObservarAuth — subscreve mudanças de estado de auth
//
// Antes de propagar o utilizador, verifica se a sessão local
// ainda é válida. Se não for, faz logout silencioso.
// Usado por login.js para reagir a login/logout/expiração.
// ============================================================

function apiObservarAuth(callback) {
  return firebaseAuth.onAuthStateChanged(function (user) {
    if (user && !sessaoValida()) {
      limparSessao();
      firebaseAuth.signOut();
      return; // onAuthStateChanged disparará novamente com user=null
    }
    callback(user);
  });
}

// ============================================================
// Auxiliares privados
// ============================================================

function _mensagemErroAuth(err) {
  // Traduzir os códigos de erro mais comuns para português
  var mapa = {
    'auth/user-not-found':      'Email não registado.',
    'auth/wrong-password':      'Password incorrecta.',
    'auth/invalid-email':       'Email inválido.',
    'auth/user-disabled':       'Conta desactivada. Contacte o administrador.',
    'auth/too-many-requests':   'Demasiadas tentativas. Aguarde uns momentos.',
    'auth/network-request-failed': 'Sem ligação à Internet.'
  };
  return mapa[err.code] || err.message;
}
