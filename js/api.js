// ============================================================
// api.js — Comunicação com o Google Apps Script
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Todas as chamadas ao backend passam por aqui.
// Em modo de pré-visualização (sem Apps Script), as funções
// degradam graciosamente com mensagens informativas.
// ============================================================

'use strict';

/**
 * Indica se o contexto do Google Apps Script está disponível.
 * @returns {boolean}
 */
function appsScriptDisponivel() {
  return typeof google !== 'undefined' && google.script && google.script.run;
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

/**
 * Autentica o utilizador contra a folha "Utilizadores" no Google Sheets.
 * @param {string}   username
 * @param {string}   password
 * @param {Function} onSuccess - Callback com { sucesso, nomeFuncionario, username } ou { sucesso: false, mensagem }
 * @param {Function} onFailure - Callback com objeto de erro
 */
function apiAutenticar(username, password, onSuccess, onFailure) {
  if (!appsScriptDisponivel()) {
    // Modo demo — aceita qualquer credencial não vazia
    onSuccess({ sucesso: true, nomeFuncionario: 'Utilizador Demo', username });
    return;
  }

  google.script.run
    .withSuccessHandler(onSuccess)
    .withFailureHandler(onFailure)
    .autenticarUtilizador(username, password);
}

// ============================================================
// VERIFICAR DADOS EXISTENTES
// ============================================================

/**
 * Verifica se já existem registos para o local e data indicados.
 * @param {string}   local
 * @param {string}   data       - Formato yyyy-MM-dd
 * @param {Function} onSuccess  - Callback com { sucesso, existe, paises, operadores, sugestoes }
 * @param {Function} onFailure  - Callback com objeto de erro
 */
function apiVerificarDados(local, data, onSuccess, onFailure) {
  if (!appsScriptDisponivel()) {
    // Modo demo — simula "sem dados"
    onSuccess({ sucesso: true, existe: false, paises: {}, operadores: [], sugestoes: [] });
    return;
  }

  google.script.run
    .withSuccessHandler(onSuccess)
    .withFailureHandler(onFailure)
    .verificarDadosExistentes(local, data);
}

// ============================================================
// GUARDAR REGISTO
// ============================================================

/**
 * Envia os dados do formulário para o Google Sheets.
 * @param {Object}   payload    - { data, local, paises, operadores, sugestoes, observacoes, funcionario }
 * @param {Function} onSuccess  - Callback com { sucesso, mensagem }
 * @param {Function} onFailure  - Callback com objeto de erro
 */
function apiGuardarRegisto(payload, onSuccess, onFailure) {
  if (!appsScriptDisponivel()) {
    // Modo demo — simula sucesso e imprime no console
    console.log('[Demo] Dados a guardar:', payload);
    onSuccess({ sucesso: true, mensagem: 'Modo demo: dados prontos para guardar.' });
    return;
  }

  google.script.run
    .withSuccessHandler(onSuccess)
    .withFailureHandler(onFailure)
    .guardarRegisto(payload);
}
