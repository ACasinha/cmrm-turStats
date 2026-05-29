// ============================================================
// api.js — Ligação à Cloud Function com Firebase Auth
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

// ▼ EDITAR ESTES DOIS VALORES ▼
var CLOUD_FUNCTION_URL = 'https://europe-west1-stats-tur.cloudfunctions.net/rmz-api';

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDk6jfWQC2C-5SEblLRZ5euNU6OHUusopU",
  authDomain: "stats-tur.firebaseapp.com",
  projectId: "stats-tur",
  storageBucket: "stats-tur.firebasestorage.app",
  messagingSenderId: "146563538068",
  appId: "1:146563538068:web:429757296c7ce85d64e881"
};
// ▲ EDITAR ESTES DOIS VALORES ▲

var SESSAO_MAX_MS      = 10 * 60 * 60 * 1000;  // 10 horas
var REQUEST_TIMEOUT_MS = 20000;
var CHAVE_LOGIN_TS     = 'rmz_login_ts';

var loginEmCurso = false;

// ============================================================
// INICIALIZAÇÃO DO FIREBASE
// ============================================================

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

var firebaseAuth = firebase.auth();

var _persistenciaPronte = firebaseAuth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(function(err) {
    console.warn('[Firebase] Erro persistência:', err);
  });

// ============================================================
// GESTÃO DE SESSÃO — 10 horas
// ============================================================

function registarInicioSessao() {
  localStorage.setItem(CHAVE_LOGIN_TS, Date.now().toString());
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
// OBTER TOKEN JWT
// ============================================================

function obterIdToken() {
  if (!sessaoValida()) {
    limparSessao();
    return firebaseAuth.signOut().then(function() {
      return Promise.reject(new Error('A sessão expirou após 10 horas. Por favor, faça login novamente.'));
    });
  }

  var user = firebaseAuth.currentUser;
  if (!user) {
    limparSessao();
    return Promise.reject(new Error('Sessão terminada. Por favor, faça login novamente.'));
  }

  return user.getIdToken(false).catch(function() {
    return user.getIdToken(true);
  });
}

// ============================================================
// FETCH PARA A CLOUD FUNCTION
// ============================================================

function chamarAPI(action, payload) {
  payload = payload || {};

  var timeoutId  = null;
  var controller = new AbortController();

  function limparTimeout() {
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
  }

  return obterIdToken()
    .then(function(idToken) {
      var corpo = JSON.stringify({ action: action, payload: payload, idToken: idToken });
      console.log('[API] →', action);

      timeoutId = setTimeout(function() { controller.abort(); }, REQUEST_TIMEOUT_MS);

      return fetch(CLOUD_FUNCTION_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    corpo,
        signal:  controller.signal
      });
    })
    .then(function(response) {
      limparTimeout();
      console.log('[API] ← HTTP', response.status);
      return response.json();
    })
    .then(function(data) {
      if (data.codigo === 401) {
        limparSessao();
        throw new Error('Não autorizado. Faça login novamente.');
      }
      return data;
    })
    .catch(function(err) {
      limparTimeout();
      if (err.name === 'AbortError') {
        throw new Error('Tempo limite excedido (' + (REQUEST_TIMEOUT_MS / 1000) + 's). Verifique a ligação.');
      }
      throw err;
    });
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

function apiAutenticar(email, password, onSuccess, onFailure) {

  var respondido = false;

  var timeoutId = setTimeout(function() {
    if (respondido) return;
    respondido = true;
    onFailure({ message: 'Sem resposta do servidor de autenticação.' });
  }, 15000);

  Promise.resolve()
    .then(function() {
      // GARANTE estado limpo, mas NÃO bloqueia fluxo
      return firebaseAuth.signOut().catch(function() {});
    })
    .then(function() {
      return firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    })
    .then(function() {
      return firebaseAuth.signInWithEmailAndPassword(email, password);
    })
    .then(function(credencial) {

      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);

      registarInicioSessao();

      onSuccess({
        sucesso: true,
        nomeFuncionario: credencial.user.displayName || credencial.user.email,
        email: credencial.user.email,
        uid: credencial.user.uid
      });

    })
    .catch(function(err) {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);

      onFailure({
        message: err.message
      });
    });
}

function apiLogout() {
  limparSessao();
  return firebaseAuth.signOut();
}

function apiObservarAuth(callback) {
  return firebaseAuth.onAuthStateChanged(function(user) {
    if (user && !sessaoValida()) {
      apiLogout();
      return;
    }
    callback(user);
  });
}

// ============================================================
// FUNÇÕES PÚBLICAS
// ============================================================

function apiVerificarDados(local, data, onSuccess, onFailure) {
  chamarAPI('verificarDados', { local: local, data: data })
    .then(onSuccess)
    .catch(function(err) { onFailure({ message: err.message }); });
}

function apiGuardarRegisto(payload, onSuccess, onFailure) {
  chamarAPI('guardarRegisto', payload)
    .then(onSuccess)
    .catch(function(err) { onFailure({ message: err.message }); });
}

function apiCriarUtilizador(payload, onSuccess, onFailure) {
  chamarAPI('criarUtilizador', payload)
    .then(onSuccess)
    .catch(function(err) { onFailure({ message: err.message }); });
}
