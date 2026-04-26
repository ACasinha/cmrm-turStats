// ============================================================
// api.js — Ligação ao Apps Script com segurança via Firebase Auth
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyklAQz02jcUj7W2H9hjzwUYpycSNl8OMBjkl4wmA6Xqw4aLh-FBWXFnf1R2khjMyk8mQ/exec';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDk6jfWQC2C-5SEblLRZ5euNU6OHUusopU",
  authDomain: "stats-tur.firebaseapp.com",
  projectId: "stats-tur",
  storageBucket: "stats-tur.firebasestorage.app",
  messagingSenderId: "146563538068",
  appId: "1:146563538068:web:429757296c7ce85d64e881"
};

const SESSAO_MAX_MS      = 10 * 60 * 60 * 1000;  // 10 horas
const REQUEST_TIMEOUT_MS = 20000;

// ── Inicialização ─────────────────────────────────────────────
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const firebaseAuth = firebase.auth();

// Persistência SESSION: sessão dura enquanto o separador estiver aberto.
firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
  .catch(err => console.warn('[Firebase] Erro persistência:', err));

// ── Gestão de sessão de 10 horas ─────────────────────────────
const CHAVE_LOGIN_TS = 'rmz_login_ts';

function registarInicioSessao() {
  sessionStorage.setItem(CHAVE_LOGIN_TS, Date.now().toString());
}

function sessaoValida() {
  const ts = sessionStorage.getItem(CHAVE_LOGIN_TS);
  if (!ts) return false;
  return (Date.now() - parseInt(ts, 10)) < SESSAO_MAX_MS;
}

function limparSessao() {
  sessionStorage.removeItem(CHAVE_LOGIN_TS);
}

// ── Obter token JWT ───────────────────────────────────────────
// Após signInWithEmailAndPassword() completar com sucesso,
// firebaseAuth.currentUser está sempre disponível de forma
// síncrona. getIdToken() renova o JWT automaticamente se
// o token de 1h estiver perto de expirar.
async function obterIdToken() {
  // Verificar limite de 10h antes de qualquer pedido
  if (!sessaoValida()) {
    await firebaseAuth.signOut();
    limparSessao();
    throw new Error('A sessão expirou após 10 horas. Por favor, faça login novamente.');
  }

  const user = firebaseAuth.currentUser;
  if (!user) {
    limparSessao();
    throw new Error('Sem sessão ativa. Por favor, faça login.');
  }

  try {
    return await user.getIdToken(false);
  } catch (err) {
    console.warn('[Firebase] getIdToken falhou, a tentar refresh:', err.code);
    return await user.getIdToken(true);
  }
}

// ── Fetch para o Apps Script ──────────────────────────────────
async function chamarAPI(action, payload = {}) {
  
  const idToken = await obterIdToken();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action, payload, idToken }),
      signal:  controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error('Erro de servidor: HTTP ' + response.status);

    const data = await response.json();

    if (data.codigo === 401) {
      await firebaseAuth.signOut();
      limparSessao();
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

// ── Autenticação pública ──────────────────────────────────────
function apiAutenticar(email, password, onSuccess, onFailure) {
  if (!firebase.apps.length) {
    onFailure({ message: 'Firebase não inicializado. Verifique a FIREBASE_CONFIG.' });
    return;
  }

  let respondido = false;
  const timeoutId = setTimeout(() => {
    if (respondido) return;
    respondido = true;
    console.error('[Firebase] Timeout. Verifique: authDomain, domínios autorizados, ligação.');
    onFailure({ message: 'Sem resposta do servidor de autenticação (15s). Verifique a ligação.' });
  }, 15000);

  firebaseAuth.signInWithEmailAndPassword(email, password)
    .then(credencial => {
      if (respondido) return;
      respondido = true;
      clearTimeout(timeoutId);
      const user = credencial.user;
      registarInicioSessao();
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
        'auth/unauthorized-domain':    'Domínio não autorizado. Adicione-o em Firebase Console → Authentication → Authorized domains.'
      };
      onFailure({ message: msgs[err.code] || 'Erro (' + err.code + '): ' + err.message });
    });
}

function apiLogout() {
  limparSessao();
  return firebaseAuth.signOut();
}

// Observador com verificação automática do limite de 10h
function apiObservarAuth(callback) {
  return firebaseAuth.onAuthStateChanged(user => {
    if (user && !sessaoValida()) {
      console.log('[Sessão] 10 horas atingidas, a terminar sessão.');
      apiLogout();
      return;
    }
    callback(user);
  });
}

// ── Apps Script ───────────────────────────────────────────────
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
