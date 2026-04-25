// ============================================================
// api.js — Ligação real ao Google Apps Script via fetch REST
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// CONFIGURAÇÃO OBRIGATÓRIA:
//   1. Publique o Code.gs como Web App no Google Apps Script
//      (Execute as: Me | Who has access: Anyone)
//   2. Copie o URL gerado (termina em /exec)
//   3. Cole-o na constante APPS_SCRIPT_URL abaixo
// ============================================================
 
'use strict';
 
// ▼▼▼ COLOQUE AQUI O URL DO SEU WEB APP PUBLICADO ▼▼▼
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/1zBhqr5yH3g0nY5zuuRmMBFBiUJhCcAYvrOgWs2Qalzs/exec';
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
 
// Timeout para cada pedido (ms)
const REQUEST_TIMEOUT_MS = 15000;
 
// ============================================================
// FUNÇÃO BASE — fetch com timeout e tratamento de erros
// ============================================================
 
/**
 * Envia um pedido POST ao Apps Script com a ação e payload indicados.
 * Devolve uma Promise com o objeto de resposta JSON.
 *
 * @param {string} action   - Nome da ação ('autenticar' | 'verificarDados' | 'guardarRegisto')
 * @param {Object} payload  - Dados a enviar
 * @returns {Promise<Object>}
 */
async function chamarAPI(action, payload) {
  // Verificar se o URL foi configurado
  if (APPS_SCRIPT_URL.includes('SEU_ID_AQUI')) {
    console.warn('[API] APPS_SCRIPT_URL não configurado. A usar modo demo.');
    return modoDemo(action, payload);
  }
 
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
 
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      // O Apps Script não aceita Content-Type: application/json em CORS simples.
      // Usamos text/plain para evitar o preflight OPTIONS (que o Apps Script não suporta).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action, payload }),
      signal:  controller.signal,
      // 'no-cors' NÃO serve aqui — precisamos de ler a resposta.
      // O Apps Script com "Anyone" já envia os headers CORS corretos.
    });
 
    clearTimeout(timeoutId);
 
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
 
    const data = await response.json();
    return data;
 
  } catch (err) {
    clearTimeout(timeoutId);
 
    if (err.name === 'AbortError') {
      throw new Error('O pedido excedeu o tempo limite. Verifique a ligação à internet.');
    }
 
    // Erro de rede (offline, CORS, etc.)
    throw new Error('Sem ligação ao servidor. Verifique a internet e tente novamente. (' + err.message + ')');
  }
}
 
// ============================================================
// MODO DEMO — usado quando o URL não está configurado
// ============================================================
 
/**
 * Simula respostas do backend para desenvolvimento/pré-visualização local.
 * Remove esta função (ou o aviso) quando o URL estiver configurado.
 */
function modoDemo(action, payload) {
  console.log('[Demo] Ação:', action, '| Payload:', payload);
 
  switch (action) {
    case 'autenticar':
      // Aceita qualquer credencial não vazia em modo demo
      if (payload.username && payload.password) {
        return Promise.resolve({
          sucesso: true,
          nomeFuncionario: 'Utilizador Demo',
          username: payload.username
        });
      }
      return Promise.resolve({ sucesso: false, mensagem: 'Preencha os campos.' });
 
    case 'verificarDados':
      return Promise.resolve({
        sucesso: true, existe: false,
        paises: {}, operadores: [], sugestoes: []
      });
 
    case 'guardarRegisto':
      return Promise.resolve({ sucesso: true, mensagem: '[Demo] Dados prontos para guardar.' });
 
    default:
      return Promise.resolve({ sucesso: false, mensagem: 'Ação desconhecida.' });
  }
}
 
// ============================================================
// FUNÇÕES PÚBLICAS — usadas por app.js
// ============================================================
 
/**
 * Autentica o utilizador.
 * @param {string}   username
 * @param {string}   password
 * @param {Function} onSuccess
 * @param {Function} onFailure
 */
function apiAutenticar(username, password, onSuccess, onFailure) {
  chamarAPI('autenticar', { username, password })
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}
 
/**
 * Verifica se existem dados para o local e data indicados.
 * @param {string}   local
 * @param {string}   data      - yyyy-MM-dd
 * @param {Function} onSuccess
 * @param {Function} onFailure
 */
function apiVerificarDados(local, data, onSuccess, onFailure) {
  chamarAPI('verificarDados', { local, data })
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}
 
/**
 * Guarda o registo completo no Google Sheets.
 * @param {Object}   payload   - { data, local, paises, operadores, sugestoes, observacoes, funcionario }
 * @param {Function} onSuccess
 * @param {Function} onFailure
 */
function apiGuardarRegisto(payload, onSuccess, onFailure) {
  chamarAPI('guardarRegisto', payload)
    .then(onSuccess)
    .catch(err => onFailure({ message: err.message }));
}
