// ============================================================
// api.js — Ligação ao Apps Script com segurança via Firebase Auth
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// CONFIGURAÇÃO:
//   1. Substitua FIREBASE_CONFIG com os valores do seu projeto
//      Firebase Console → Definições → As suas apps → Web app
//   2. Substitua APPS_SCRIPT_URL com o URL do Web App publicado
// ============================================================

'use strict';

var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBwXXtMYm8AOCL1Gl3jBYUF1E1tEQpKb1ibDdiEe4iMZR3odHtSUYNK_TXtyz_s8rwAw/exec';

var FIREBASE_CONFIG = {
  apiKey: "AIzaSyDk6jfWQC2C-5SEblLRZ5euNU6OHUusopU",
  authDomain: "stats-tur.firebaseapp.com",
  projectId: "stats-tur",
  storageBucket: "stats-tur.firebasestorage.app",
  messagingSenderId: "146563538068",
  appId: "1:146563538068:web:429757296c7ce85d64e881"
};

var SESSAO_MAX_MS = 10 * 60 * 60 * 1000;  // 10 horas
var REQUEST_TIMEOUT_MS = 20000;

// ============================================================
// INICIALIZAÇÃO DO FIREBASE
// ============================================================

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const firebaseAuth = firebase.auth();

// setPersistence é assíncrono. Guardamos a Promise para que
// apiAutenticar aguarde a sua conclusão antes de fazer login.
// Sem isto, o primeiro signInWithEmailAndPassword pode falhar
// silenciosamente enquanto a persistência ainda não está definida.
//
// Usamos LOCAL (localStorage) em vez de SESSION para que o
// timestamp de 10h sobreviva a reloads da página — gerimos
// nós próprios a expiração de sessão em vez de depender do
// Firebase para isso.
const _persistenciaPronte = firebaseAuth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(err => console.warn('[Firebase] Erro ao definir persistência:', err));

// ============================================================
// GESTÃO DE SESSÃO — 10 horas
//
// Usamos localStorage (não sessionStorage) para que o timestamp
// sobreviva a reloads. A expiração de 10h é verificada por nós
// antes de cada pedido ao servidor.
// ============================================================

var CHAVE_LOGIN_TS = 'rmz_login_ts';

function registarInicioSessao() {
  localStorage.setItem(CHAVE_LOGIN_TS, Date.now().toString());
}

function sessaoValida() {
  const ts = localStorage.getItem(CHAVE_LOGIN_TS);
  if (!ts) return false;
  return (Date.now() - parseInt(ts, 10)) < SESSAO_MAX_MS;
}

function limparSessao() {
  localStorage.removeItem(CHAVE_LOGIN_TS);
}

// ============================================================
// OBTER TOKEN JWT
//
// Chamado antes de cada pedido ao Apps Script.
// firebaseAuth.currentUser está sempre disponível após login
// completo — não é necessário aguardar por observadores.
// getIdToken() renova automaticamente o JWT de 1h quando
// este está prestes a expirar.
// ============================================================

async function obterIdToken() {
  // Verificar expiração de 10h
  if (!sessaoValida()) {
    limparSessao();
    await firebaseAuth.signOut();
    throw new Error('A sessão expirou após 10 horas. Por favor, faça login novamente.');
  }

  const user = firebaseAuth.currentUser;
  if (!user) {
    // Pode acontecer após reload se o token Firebase tiver expirado
    // (distinto da nossa expiração de 10h)
    limparSessao();
    throw new Error('Sessão terminada. Por favor, faça login novamente.');
  }

  // false = usar cache se válido; SDK renova automaticamente se necessário
  return await user.getIdToken(false);
}

// ============================================================
// FETCH PARA O APPS SCRIPT
// ============================================================

async function chamarAPI(action, payload = {}) {
  if (APPS_SCRIPT_URL.includes('AKfycbwBwXXtMYm8AOCL1Gl3jBYUF1E1tEQpKb1ibDdiEe4iMZR3odHtSUYNK_TXtyz_s8rwAw')) {
    console.warn('[API] APPS_SCRIPT_URL não configurado — modo demo.');
    return modoDemo(action, payload);
  }

  const idToken = await obterIdToken();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      // text/plain evita preflight CORS que o Apps Script não suporta
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action, payload, idToken }),
      signal:  controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Erro de servidor: HTTP ' + response.status);

    const data = await response.json();

    // Backend rejeitou token (revogado, projeto errado, etc.)
    if (data.codigo === 401) {
      limparSessao();
      await firebaseAuth.signOut();
      throw new Error('Sessão rejeitada pelo servidor. Por favor, faça login novamente.');
    }

    return data;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tempo limite excedido (' + (REQUEST_TIMEOUT_MS / 1000) + 's). Verifique a ligação.');
    }
    throw err;
  }
}

// ============================================================
// AUTENTICAÇÃO — funções públicas usadas por app.js
// ============================================================

/**
 * Login com email + password.
 * Aguarda _persistenciaPronte antes de tentar o login — garante
 * que a primeira tentativa não falha silenciosamente.
 */
function apiAutenticar(email, password, onSuccess, onFailure) {
  let respondido = false;

  const timeoutId = setTimeout(() => {
    if (respondido) return;
    respondido = true;
    console.error('[Firebase] Timeout 15s. Verifique authDomain, domínios autorizados e ligação.');
    onFailure({ message: 'Sem resposta do servidor de autenticação. Verifique a ligação à internet.' });
  }, 15000);

  // Aguardar persistência antes do login — corrige o bug da 1ª tentativa
  _persistenciaPronte
    .then(() => firebaseAuth.signInWithEmailAndPassword(email, password))
    .then(credencial => {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);
      registarInicioSessao();
      const user = credencial.user;
      console.log('[Firebase] Login:', user.email);
      onSuccess({
        sucesso:         true,
        nomeFuncionario: user.displayName || user.email,
        email:           user.email,
        uid:             user.uid
      });
    })
    .catch(err => {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);
      console.error('[Firebase] Erro:', err.code, err.message);
      const msgs = {
        'auth/invalid-email':          'Endereço de email inválido.',
        'auth/user-disabled':          'Esta conta foi desativada.',
        'auth/user-not-found':         'Utilizador não encontrado.',
        'auth/wrong-password':         'Password incorreta.',
        'auth/invalid-credential':     'Email ou password incorretos.',
        'auth/too-many-requests':      'Demasiadas tentativas. Tente mais tarde.',
        'auth/network-request-failed': 'Sem ligação à internet.',
        'auth/operation-not-allowed':  'Autenticação por email não está ativa no Firebase Console.',
        'auth/unauthorized-domain':    'Domínio não autorizado — adicione-o em Firebase Console → Authentication → Authorized domains.'
      };
      onFailure({ message: msgs[err.code] || 'Erro (' + err.code + '): ' + err.message });
    });
}

/**
 * Logout explícito.
 */
function apiLogout() {
  limparSessao();
  return firebaseAuth.signOut();
}

/**
 * Observador de estado de autenticação.
 * Verifica expiração de 10h sempre que o estado muda.
 */
function apiObservarAuth(callback) {
  return firebaseAuth.onAuthStateChanged(user => {
    if (user && !sessaoValida()) {
      console.log('[Sessão] 10 horas ultrapassadas — a terminar sessão.');
      apiLogout();
      return; // callback será chamado de novo com null pelo signOut
    }
    callback(user);
  });
}

// ============================================================
// FUNÇÕES PARA O APPS SCRIPT
// ============================================================

function apiVerificarDados(local, data, onSuccess, onFailure) {
  chamarAPI('verificarDados', { local, data })
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}

function apiGuardarRegisto(payload, onSuccess, onFailure) {
  chamarAPI('guardarRegisto', payload)
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}
