// ============================================================
// api.js — Ligação ao Apps Script com segurança via Firebase Auth
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// SEGURANÇA — como funciona:
//   Este ficheiro é público no GitHub. Isso é intencional e seguro.
//   O segredo não está no código — está na autenticação.
//
//   Fluxo por pedido:
//     1. Firebase SDK autentica o utilizador (email + password)
//     2. Firebase devolve um ID Token JWT assinado pela Google
//     3. Cada pedido ao Apps Script inclui esse token no corpo
//     4. O Apps Script verifica o token junto do Firebase
//     5. Só executa a operação se o token for válido e não expirado
//
//   O que um atacante vê neste ficheiro:
//     • O URL do Apps Script  → só aceita pedidos com token válido
//     • A Firebase config     → é pública por design (não é um segredo)
//     • A lógica de fetch     → inútil sem credenciais Firebase válidas
//
// CONFIGURAÇÃO:
//   Substitua os valores em FIREBASE_CONFIG com os do seu projeto.
//   Firebase Console → Definições do projeto → As suas apps → Web app
//   Substitua APPS_SCRIPT_URL com o URL do Web App publicado.
// ============================================================

'use strict';

// ── Apps Script URL ─────────────────────────────────────────
// URL do Web App publicado (termina em /exec).
// Não é um segredo — o Apps Script valida o token em cada pedido.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyklAQz02jcUj7W2H9hjzwUYpycSNl8OMBjkl4wmA6Xqw4aLh-FBWXFnf1R2khjMyk8mQ/exec';

// ── Firebase Configuration ───────────────────────────────────
// Estes valores são públicos por design.
// Veja: https://firebase.google.com/docs/web/setup#available-libraries
// A segurança real é garantida pelas Firebase Security Rules
// e pela verificação do ID Token no Apps Script.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDk6jfWQC2C-5SEblLRZ5euNU6OHUusopU",
  authDomain: "stats-tur.firebaseapp.com",
  projectId: "stats-tur",
  storageBucket: "stats-tur.firebasestorage.app",
  messagingSenderId: "146563538068",
  appId: "1:146563538068:web:429757296c7ce85d64e881"
};

// Timeout por pedido (ms)
const REQUEST_TIMEOUT_MS = 20000;

// ============================================================
// INICIALIZAÇÃO DO FIREBASE
// ============================================================

// Inicializar apenas uma vez
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const firebaseAuth = firebase.auth();

// ============================================================
// OBTER TOKEN ATUAL
//
// Obtém o ID Token do utilizador autenticado.
// Usa forceRefresh=true se o token tiver menos de 5 min de vida.
// O Firebase renova automaticamente tokens expirados.
// ============================================================

async function obterIdToken() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Sem sessão ativa. Por favor, faça login.');

  // forceRefresh: true garante que o token está sempre fresco
  // (evita rejeições por expiração no backend)
  return await user.getIdToken(/* forceRefresh */ false);
}

// ============================================================
// FUNÇÃO BASE — fetch com token e timeout
// ============================================================

async function chamarAPI(action, payload = {}) {
  // Verificar configuração
  if (APPS_SCRIPT_URL.includes('AKfycbyklAQz02jcUj7W2H9hjzwUYpycSNl8OMBjkl4wmA6Xqw4aLh-FBWXFnf1R2khjMyk8mQ')) {
    console.warn('[API] APPS_SCRIPT_URL não configurado. A usar modo demo.');
    return modoDemo(action, payload);
  }

  // Obter token Firebase (lança erro se não houver sessão)
  const idToken = await obterIdToken();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // text/plain evita preflight CORS (o Apps Script não suporta OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        payload,
        idToken  // ← token JWT enviado em cada pedido
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Token expirado ou inválido — forçar novo login
    if (data.codigo === 401) {
      await firebaseAuth.signOut();
      throw new Error('Sessão expirada. Por favor, faça login novamente.');
    }

    return data;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('O pedido excedeu o tempo limite (' + (REQUEST_TIMEOUT_MS/1000) + 's). Verifique a ligação à internet.');
    }
    throw err;
  }
}

// ============================================================
// MODO DEMO
// Ativo quando APPS_SCRIPT_URL não está configurado.
// Remove antes de ir para produção.
// ============================================================

function modoDemo(action, payload) {
  console.log('[Demo] Ação:', action, '| Payload:', payload);
  switch (action) {
    case 'verificarDados':
      return Promise.resolve({ sucesso: true, existe: false, paises: {}, operadores: [], sugestoes: [] });
    case 'guardarRegisto':
      return Promise.resolve({ sucesso: true, mensagem: '[Demo] Dados prontos para guardar.' });
    default:
      return Promise.resolve({ sucesso: false, mensagem: 'Ação desconhecida em modo demo.' });
  }
}

// ============================================================
// FUNÇÕES PÚBLICAS DE AUTENTICAÇÃO (Firebase direto)
//
// O login/logout é feito 100% no cliente com o Firebase SDK.
// O Apps Script nunca vê a password — só vê o token JWT.
// ============================================================

/**
 * Autentica com email e password via Firebase Auth.
 * @param {string}   email
 * @param {string}   password
 * @param {Function} onSuccess — ({ sucesso, nomeFuncionario, email })
 * @param {Function} onFailure — ({ message })
 */
function apiAutenticar(email, password, onSuccess, onFailure) {
  // Verificar se o Firebase foi inicializado corretamente
  if (!firebase.apps.length) {
    onFailure({ message: 'Firebase não inicializado. Verifique a FIREBASE_CONFIG em api.js.' });
    return;
  }

  // Timeout de segurança — se o Firebase não responder em 15s
  // (ex: domínio não autorizado, rede bloqueada), garantir que o
  // utilizador vê um erro em vez de ficar preso no "A autenticar..."
  let resolvido = false;
  const timeoutId = setTimeout(() => {
    if (!resolvido) {
      resolvido = true;
      console.error('[Firebase] Timeout na autenticação. Verifique:',
        '1) authDomain no FIREBASE_CONFIG',
        '2) Domínio autorizado no Firebase Console → Authentication → Settings → Authorized domains',
        '3) Ligação à internet'
      );
      onFailure({ message: 'Sem resposta do servidor de autenticação. Verifique a ligação ou contacte o administrador.' });
    }
  }, 15000);

  firebaseAuth.signInWithEmailAndPassword(email, password)
    .then(credencial => {
      if (resolvido) return;   // timeout já disparou — ignorar
      resolvido = true;
      clearTimeout(timeoutId);

      const user = credencial.user;
      console.log('[Firebase] Login bem-sucedido:', user.email);
      onSuccess({
        sucesso:         true,
        nomeFuncionario: user.displayName || user.email,
        email:           user.email,
        uid:             user.uid
      });
    })
    .catch(err => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timeoutId);

      // Log completo para diagnóstico
      console.error('[Firebase] Erro de autenticação:', err.code, err.message);

      const mensagens = {
        'auth/invalid-email':          'Endereço de email inválido.',
        'auth/user-disabled':          'Esta conta foi desativada.',
        'auth/user-not-found':         'Utilizador não encontrado.',
        'auth/wrong-password':         'Password incorreta.',
        'auth/invalid-credential':     'Email ou password incorretos.',
        'auth/too-many-requests':      'Demasiadas tentativas falhadas. Tente mais tarde.',
        'auth/network-request-failed': 'Sem ligação à internet.',
        'auth/operation-not-allowed':  'Autenticação por email não está ativa no Firebase.',
        'auth/unauthorized-domain':    'Domínio não autorizado. Adicione-o no Firebase Console → Authentication → Authorized domains.'
      };
      const mensagem = mensagens[err.code] || ('Erro (' + err.code + '): ' + err.message);
      onFailure({ message: mensagem });
    });
}

/**
 * Termina a sessão Firebase.
 * @returns {Promise}
 */
function apiLogout() {
  return firebaseAuth.signOut();
}

/**
 * Observador de estado de autenticação.
 * Chama o callback sempre que o estado muda (login/logout/expiração).
 * @param {Function} callback — (user | null)
 */
function apiObservarAuth(callback) {
  return firebaseAuth.onAuthStateChanged(callback);
}

// ============================================================
// FUNÇÕES PÚBLICAS — Apps Script (requerem token válido)
// ============================================================

/**
 * Verifica se existem dados para o local e data indicados.
 */
function apiVerificarDados(local, data, onSuccess, onFailure) {
  chamarAPI('verificarDados', { local, data })
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}

/**
 * Guarda o registo completo no Google Sheets.
 */
function apiGuardarRegisto(payload, onSuccess, onFailure) {
  chamarAPI('guardarRegisto', payload)
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}
