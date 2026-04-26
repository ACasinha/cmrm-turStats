// ============================================================
// api.js — Ligação ao Apps Script com segurança via Firebase Auth
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// CONFIGURAÇÃO:
//   1. Substitua FIREBASE_CONFIG com os valores do seu projecto
//      Firebase Console → Definições → As suas apps → Web app
//   2. Substitua APPS_SCRIPT_URL com o URL /exec do Web App publicado
//      (nunca o URL /dev — esse faz redirect diferente)
// ============================================================

'use strict';

// ▼ EDITAR ESTES DOIS VALORES ▼
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqN-2l6Hr4_fuUHM---iONi24wl3B2SCmpY-V3jAf0J9OKZFsDcit1VJ5_WktFXMTmsA/exec';

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

// ============================================================
// INICIALIZAÇÃO DO FIREBASE
// ============================================================

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

var firebaseAuth = firebase.auth();

// Aguardar setPersistence antes de qualquer login.
// LOCAL: sessão sobrevive a reloads da página (gerimos nós a expiração de 10h).
var _persistenciaPronte = firebaseAuth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(function(err) {
    console.warn('[Firebase] Erro ao definir persistência:', err);
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
      throw new Error('A sessão expirou após 10 horas. Por favor, faça login novamente.');
    });
  }

  var user = firebaseAuth.currentUser;
  if (!user) {
    limparSessao();
    return Promise.reject(new Error('Sessão terminada. Por favor, faça login novamente.'));
  }

  // 🔥 proteção contra bloqueio
  return Promise.race([
    user.getIdToken(true),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao obter token')), 5000)
    )
  ]);
}

// ============================================================
// FETCH PARA O APPS SCRIPT
//
// O Apps Script /exec responde directamente ao POST sem redirect
// quando publicado correctamente com "Execute as: Me / Anyone".
// Se mesmo assim houver redirect, o body é preservado com
// redirect:'follow' e Content-Type:text/plain (sem preflight).
// ============================================================

function chamarAPI(action, payload) {
  payload = payload || {};

  if (APPS_SCRIPT_URL.includes('AKfycbwqN-2l6Hr4_fuUHM---iONi24wl3B2SCmpY-V3jAf0J9OKZFsDcit1VJ5_WktFXMTmsA')) {
    console.warn('[API] APPS_SCRIPT_URL não configurado — modo demo.');
    return Promise.resolve(modoDemo(action, payload));
  }

  return obterIdToken().then(function(idToken) {
    var corpo = JSON.stringify({ action: action, payload: payload, idToken: idToken });

    console.log('[API] →', action, '| token:', idToken.substring(0, 20) + '...');

    var controller = new AbortController();
    var timeoutId  = setTimeout(function() { controller.abort(); }, REQUEST_TIMEOUT_MS);

    return fetch(APPS_SCRIPT_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     corpo,
      signal:   controller.signal
    })
    .then(function(response) {
      clearTimeout(timeoutId);
      console.log('[API] ← HTTP', response.status, '| url:', response.url);
      return response.text();
    })
    .then(function(text) {
      console.log('[API] resposta raw:', text.substring(0, 200));

      if (!text || text.trim() === '') {
        // Resposta vazia = o POST foi convertido em GET pelo redirect
        // e o doGet devolveu algo diferente, ou não devolveu nada.
        throw new Error(
          'Resposta vazia do servidor. ' +
          'Verifique se o URL do Apps Script termina em /exec (não /dev) ' +
          'e se o Web App está publicado com "Execute as: Me / Anyone".'
        );
      }

      var data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        console.error('[API] resposta não-JSON:', text.substring(0, 300));
        throw new Error('Resposta inesperada do servidor (não é JSON).');
      }

      if (data.codigo === 401) {
        limparSessao();
        return firebaseAuth.signOut().then(function() {
          throw new Error('Sessão rejeitada pelo servidor. Por favor, faça login novamente.');
        });
      }

      return data;
    })
    .catch(function(err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Tempo limite excedido (' + (REQUEST_TIMEOUT_MS / 1000) + 's). Verifique a ligação.');
      }
      throw err;
    });
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
    console.error('[Firebase] Timeout 15s.');
    onFailure({ message: 'Sem resposta do servidor de autenticação. Verifique a ligação à internet.' });
  }, 15000);

  _persistenciaPronte
    .then(function() {
      return firebaseAuth.signInWithEmailAndPassword(email, password);
    })
    .then(function(credencial) {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);
      registarInicioSessao();
      var user = credencial.user;
      console.log('[Firebase] Login:', user.email);
      onSuccess({
        sucesso:         true,
        nomeFuncionario: user.displayName || user.email,
        email:           user.email,
        uid:             user.uid
      });
    })
    .catch(function(err) {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);
      console.error('[Firebase] Erro:', err.code, err.message);
      var msgs = {
        'auth/invalid-email':          'Endereço de email inválido.',
        'auth/user-disabled':          'Esta conta foi desativada.',
        'auth/user-not-found':         'Utilizador não encontrado.',
        'auth/wrong-password':         'Password incorreta.',
        'auth/invalid-credential':     'Email ou password incorretos.',
        'auth/too-many-requests':      'Demasiadas tentativas. Tente mais tarde.',
        'auth/network-request-failed': 'Sem ligação à internet.',
        'auth/operation-not-allowed':  'Autenticação por email não está ativa no Firebase Console.',
        'auth/unauthorized-domain':    'Domínio não autorizado — adicione em Firebase Console → Authentication → Authorized domains.'
      };
      onFailure({ message: msgs[err.code] || 'Erro (' + err.code + '): ' + err.message });
    });
}

function apiLogout() {
  limparSessao();
  return firebaseAuth.signOut();
}

function apiObservarAuth(callback) {
  return firebaseAuth.onAuthStateChanged(function(user) {
    if (user && !sessaoValida()) {
      console.log('[Sessão] 10 horas ultrapassadas — a terminar sessão.');
      apiLogout();
      return;
    }
    callback(user);
  });
}

// ============================================================
// FUNÇÕES PARA O APPS SCRIPT
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
