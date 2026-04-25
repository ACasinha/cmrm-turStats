// ============================================================
// ui.js — Construção e atualização da interface
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

// ============================================================
// UTILITÁRIOS
// ============================================================

/**
 * Escapa caracteres especiais HTML para uso em atributos/conteúdo inline.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// CONSTRUÇÃO DE TABELAS
// ============================================================

/**
 * (Re)constrói a tabela de países com inputs numéricos.
 * Usa a lista global PAISES definida em data.js.
 */
function construirTabelaPaises() {
  const tbody = document.getElementById('tabelaPaises');
  tbody.innerHTML = '';

  PAISES.forEach(pais => {
    const tr = document.createElement('tr');
    if (pais.destaque) tr.classList.add('row-destaque');

    tr.innerHTML = `
      <td>${esc(pais.nome)}</td>
      <td class="num-cell">
        <input
          type="number"
          inputmode="numeric"
          class="num-input pais-input"
          min="0"
          placeholder="0"
          data-pais="${esc(pais.nome)}"
          oninput="atualizarTotais(this)"
        >
      </td>`;

    tbody.appendChild(tr);
  });
}

/**
 * (Re)constrói a tabela de operadores/agências.
 * @param {number}   n      - Número de linhas a mostrar.
 * @param {Array}   [dados] - Dados a pré-preencher (opcional).
 */
function construirTabelaOperadores(n, dados) {
  const tbody = document.getElementById('tabelaOperadores');
  tbody.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const op  = (dados && dados[i]) ? dados[i] : {};
    const cls = op.operador ? 'input-carregado' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="op-nome ${cls}"
               placeholder="Nome do operador..."
               value="${esc(op.operador || '')}">
      </td>
      <td>
        <input type="text" class="op-nac ${cls}"
               placeholder="Ex: Alemanha: 3, França: 2..."
               value="${esc(op.nacionalidades || '')}">
      </td>
      <td>
        <input type="number" inputmode="numeric" class="op-total ${cls}"
               min="0" placeholder="0"
               value="${esc(String(op.total || ''))}">
      </td>`;

    tbody.appendChild(tr);
  }
}

/**
 * (Re)constrói a tabela de sugestões/críticas.
 * @param {number}   n      - Número de linhas a mostrar.
 * @param {Array}   [dados] - Dados a pré-preencher (opcional).
 */
function construirTabelaSugestoes(n, dados) {
  const tbody = document.getElementById('tabelaSugestoes');
  tbody.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const s   = (dados && dados[i]) ? dados[i] : {};
    const cls = s.sugestao ? 'input-carregado' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="sug-texto ${cls}"
               placeholder="Escreva aqui..."
               value="${esc(s.sugestao || '')}">
      </td>
      <td>
        <input type="text" class="sug-nac ${cls}"
               placeholder="País..."
               value="${esc(s.nacionalidade || '')}">
      </td>`;

    tbody.appendChild(tr);
  }
}

// ============================================================
// TOTAIS
// ============================================================

/**
 * Atualiza o contador de total diário, badge do header e contador de entradas.
 * Chamado em cada `oninput` nos campos de países.
 * @param {HTMLInputElement} input - O input que disparou o evento.
 */
function atualizarTotais(input) {
  const val = parseInt(input.value, 10) || 0;

  if (val > 0) {
    input.style.borderColor = 'var(--verde-light)';
    input.style.background  = 'rgba(61,90,62,0.05)';
    input.style.color       = 'var(--verde)';
    input.style.fontWeight  = '600';
  } else {
    input.style.cssText = '';
  }

  let total = 0;
  let count = 0;

  document.querySelectorAll('.pais-input').forEach(inp => {
    const v = parseInt(inp.value, 10) || 0;
    total += v;
    if (v > 0) count++;
  });

  document.getElementById('totalDiario').textContent = total;
  document.getElementById('totalGeral').textContent  = total;
  document.getElementById('contadorPaises').textContent =
    count + (count === 1 ? ' entrada' : ' entradas');
}

/**
 * Recalcula e apresenta os totais para todos os inputs de países
 * (usado após carregamento de dados).
 */
function recalcularTotais() {
  let total = 0;
  let count = 0;

  document.querySelectorAll('.pais-input').forEach(inp => {
    const v = parseInt(inp.value, 10) || 0;
    total += v;
    if (v > 0) count++;
  });

  document.getElementById('totalDiario').textContent = total;
  document.getElementById('totalGeral').textContent  = total;
  document.getElementById('contadorPaises').textContent =
    count + (count === 1 ? ' entrada' : ' entradas');
}

// ============================================================
// BANNER DE ESTADO
// ============================================================

/**
 * Mostra o banner de estado com o tipo e texto indicados.
 * @param {string} tipo   - '' | 'verificando' | 'carregado' | 'novo'
 * @param {string} texto  - Texto a mostrar.
 */
function mostrarBanner(tipo, texto) {
  const banner  = document.getElementById('estadoBanner');
  const spinner = document.getElementById('estadoSpinner');
  const textoEl = document.getElementById('estadoTexto');

  banner.className   = 'estado-banner' + (tipo ? ' ' + tipo : '');
  spinner.style.display = tipo === 'verificando' ? 'block' : 'none';
  textoEl.textContent   = texto;
}

// ============================================================
// TOAST
// ============================================================

/**
 * Mostra uma mensagem toast temporária.
 * @param {string} msg  - Mensagem a apresentar.
 * @param {string} tipo - 'sucesso' | 'erro' | 'info'
 */
function mostrarToast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + tipo + ' show';
  setTimeout(() => t.classList.remove('show'), 3800);
}

// ============================================================
// RECOLHA DE DADOS DO FORMULÁRIO
// ============================================================

/**
 * Lê a tabela de operadores e devolve um array de objetos.
 * @returns {{ operador: string, nacionalidades: string, total: number }[]}
 */
function recolherOperadores() {
  const lista = [];

  document.querySelectorAll('#tabelaOperadores tr').forEach(tr => {
    const nome = tr.querySelector('.op-nome')?.value.trim()  || '';
    const nac  = tr.querySelector('.op-nac')?.value.trim()   || '';
    const tot  = parseInt(tr.querySelector('.op-total')?.value, 10) || 0;

    if (nome) lista.push({ operador: nome, nacionalidades: nac, total: tot });
  });

  return lista;
}

/**
 * Lê a tabela de sugestões e devolve um array de objetos.
 * @returns {{ sugestao: string, nacionalidade: string }[]}
 */
function recolherSugestoes() {
  const lista = [];

  document.querySelectorAll('#tabelaSugestoes tr').forEach(tr => {
    const sug = tr.querySelector('.sug-texto')?.value.trim() || '';
    const nac = tr.querySelector('.sug-nac')?.value.trim()   || '';

    if (sug) lista.push({ sugestao: sug, nacionalidade: nac });
  });

  return lista;
}

// ============================================================
// LIMPAR FORMULÁRIO
// ============================================================

/**
 * Limpa apenas os campos de países, operadores, sugestões e observações,
 * sem alterar local/data nem o banner. Usado ao mudar local/data.
 */
function limparFormularioParcial() {
  document.querySelectorAll('.pais-input').forEach(inp => {
    inp.value = '';
    inp.style.cssText = '';
    inp.classList.remove('input-carregado');
  });

  document.getElementById('totalDiario').textContent = '0';
  document.getElementById('totalGeral').textContent  = '0';
  document.getElementById('contadorPaises').textContent = '0 entradas';

  construirTabelaOperadores(NUM_LINHAS_OP);
  construirTabelaSugestoes(NUM_LINHAS_SUG);

  document.getElementById('observacoes').value = '';
}

/**
 * Limpa todos os campos do formulário (com confirmação do utilizador).
 * Repõe também local, data, e o banner de estado.
 */
function limparFormulario() {
  if (!confirm('Tem a certeza que deseja limpar todos os dados?')) return;

  limparFormularioParcial();

  document.getElementById('data').valueAsDate  = new Date();
  document.getElementById('local').value = '';
  mostrarBanner('', '');

  // Reset do estado de verificação — permite verificar de novo ao escolher local/data
  ultimoLocalVerificado = '';
  ultimaDataVerificada  = '';

  mostrarToast('Formulário limpo.', 'sucesso');
}

// ============================================================
// CARREGAMENTO DE DADOS EXISTENTES
// ============================================================

/**
 * Preenche o formulário com dados já existentes para o local/data.
 * @param {Object} resp - Resposta de verificarDadosExistentes().
 */
function carregarDados(resp) {
  document.querySelectorAll('.pais-input').forEach(inp => {
    const v = resp.paises[inp.dataset.pais];
    if (v && v > 0) {
      inp.value = v;
      inp.classList.add('input-carregado');
      inp.style.borderColor = 'var(--azul-light)';
      inp.style.background  = 'rgba(46,91,138,0.04)';
      inp.style.color       = 'var(--azul)';
      inp.style.fontWeight  = '600';
    }
  });

  const nOp  = Math.max(NUM_LINHAS_OP,  (resp.operadores || []).length + 1);
  const nSug = Math.max(NUM_LINHAS_SUG, (resp.sugestoes  || []).length + 1);

  construirTabelaOperadores(nOp,  resp.operadores || []);
  construirTabelaSugestoes(nSug,  resp.sugestoes  || []);

  recalcularTotais();
}
