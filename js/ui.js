// ============================================================
// ui.js — Construção e atualização da interface
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

// ============================================================
// UTILITÁRIOS
// ============================================================

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

function construirTabelaPaises() {
  const tbody = document.getElementById('tabelaPaises');
  tbody.innerHTML = '';

  PAISES.forEach(pais => {
    const tr = document.createElement('tr');
    if (pais.destaque) tr.classList.add('row-destaque');
    tr.innerHTML = `
      <td>${esc(pais.nome)}</td>
      <td class="num-cell">
        <input type="number" inputmode="numeric" class="num-input pais-input"
               min="0" placeholder="0" data-pais="${esc(pais.nome)}"
               oninput="atualizarTotais(this)">
      </td>`;
    tbody.appendChild(tr);
  });
}

function construirTabelaOperadores(n, dados) {
  const tbody = document.getElementById('tabelaOperadores');
  tbody.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const op  = (dados && dados[i]) ? dados[i] : {};
    const cls = op.operador ? 'input-carregado' : '';
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="op-nome ${cls}" placeholder="Nome do operador..."
                 value="${esc(op.operador || '')}"></td>
      <td><input type="text" class="op-nac ${cls}" placeholder="Ex: Alemanha: 3, França: 2..."
                 value="${esc(op.nacionalidades || '')}"></td>
      <td><input type="number" inputmode="numeric" class="op-total ${cls}"
                 min="0" placeholder="0" value="${esc(String(op.total || ''))}"></td>`;
    tbody.appendChild(tr);
  }
}

function construirTabelaSugestoes(n, dados) {
  const tbody = document.getElementById('tabelaSugestoes');
  tbody.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const s   = (dados && dados[i]) ? dados[i] : {};
    const cls = s.sugestao ? 'input-carregado' : '';
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="sug-texto ${cls}" placeholder="Escreva aqui..."
                 value="${esc(s.sugestao || '')}"></td>
      <td><input type="text" class="sug-nac ${cls}" placeholder="País..."
                 value="${esc(s.nacionalidade || '')}"></td>`;
    tbody.appendChild(tr);
  }
}

// ============================================================
// TOTAIS
// ============================================================

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
  recalcularTotais();
}

function recalcularTotais() {
  let total = 0, count = 0;
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

function mostrarBanner(tipo, texto) {
  const banner  = document.getElementById('estadoBanner');
  const spinner = document.getElementById('estadoSpinner');
  const textoEl = document.getElementById('estadoTexto');
  banner.className      = 'estado-banner' + (tipo ? ' ' + tipo : '');
  spinner.style.display = tipo === 'verificando' ? 'block' : 'none';
  textoEl.textContent   = texto;
}

// ============================================================
// TOAST
// ============================================================

function mostrarToast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + tipo + ' show';
  setTimeout(() => t.classList.remove('show'), 3800);
}

// ============================================================
// RECOLHA DE DADOS DO FORMULÁRIO
// ============================================================

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
// LIMPAR
// ============================================================

function limparFormularioParcial() {
  document.querySelectorAll('.pais-input').forEach(inp => {
    inp.value = ''; inp.style.cssText = ''; inp.classList.remove('input-carregado');
  });
  document.getElementById('totalDiario').textContent = '0';
  document.getElementById('totalGeral').textContent  = '0';
  document.getElementById('contadorPaises').textContent = '0 entradas';
  construirTabelaOperadores(NUM_LINHAS_OP);
  construirTabelaSugestoes(NUM_LINHAS_SUG);
  document.getElementById('observacoes').value = '';
}

function limparFormulario() {
  if (!confirm('Tem a certeza que deseja limpar todos os dados?')) return;
  limparFormularioParcial();
  document.getElementById('data').valueAsDate = new Date();
  document.getElementById('local').value = '';
  mostrarBanner('', '');
  ultimoLocalVerificado = '';
  ultimaDataVerificada  = '';
  mostrarToast('Formulário limpo.', 'sucesso');
}

// ============================================================
// CARREGAR DADOS EXISTENTES
// ============================================================

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
  const nObs  = Math.max(NUM_LINHAS_OBS,  (resp.observacoes || []).length + 1);
  construirTabelaOperadores(nOp,  resp.operadores || []);
  construirTabelaSugestoes(nSug,  resp.sugestoes  || []);
  construirTabelaObservacoes(nSug,  resp.observacoes  || []);
  recalcularTotais();
}
