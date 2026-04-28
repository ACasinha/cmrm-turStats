// ============================================================
// ui.js — Construção e atualização da interface
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

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
  var tbody = document.getElementById('tabelaPaises');
  tbody.innerHTML = '';

  PAISES.forEach(function(pais) {
    var tr = document.createElement('tr');
    if (pais.destaque) tr.classList.add('row-destaque');
    tr.innerHTML = `
      <td>${esc(pais.nome)}</td>
      <td class="num-cell">
        <div class="num-stepper">
          <button type="button" class="btn-stepper btn-menos"
                  onclick="stepPais(this,-1)" aria-label="Menos">−</button>
          <input type="number" inputmode="numeric" class="num-input pais-input"
                 min="0" placeholder="0" data-pais="${esc(pais.nome)}"
                 oninput="atualizarTotais(this)">
          <button type="button" class="btn-stepper btn-mais"
                  onclick="stepPais(this,1)" aria-label="Mais">+</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function stepPais(btn, delta) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) return;
  var input = btn.closest('.num-stepper').querySelector('.pais-input');
  var atual = parseInt(input.value, 10) || 0;
  var novo  = Math.max(0, atual + delta);
  input.value = novo;
  atualizarTotais(input);
}

// Gera o HTML das <option> da lista de países
function opcoesNacionalidades(selecionada) {
  return PAISES.map(function(p) {
    var sel = p.nome === selecionada ? ' selected' : '';
    return '<option value="' + esc(p.nome) + '"' + sel + '>' + esc(p.nome) + '</option>';
  }).join('');
}

// ── Operadores ───────────────────────────────────────────────
// Cada linha tem: nome do operador | lista de entradas país+nº | total (auto)
// As entradas de nacionalidade são pares [select país] [input nº] com botão +.

function construirTabelaOperadores(n, dados) {
  var tbody = document.getElementById('tabelaOperadores');
  tbody.innerHTML = '';

  for (var i = 0; i < n; i++) {
    var op  = (dados && dados[i]) ? dados[i] : {};
    var cls = op.operador ? 'input-carregado' : '';

    // Converter string guardada "Alemanha: 3, França: 2" em array de pares
    var pares = parsearNacionalidades(op.nacionalidades || '');

    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="op-nome ${cls}" placeholder="Nome do operador..."
               value="${esc(op.operador || '')}">
      </td>
      <td class="op-nac-cell">
        <div class="op-nac-lista" data-idx="${i}"></div>
        <button type="button" class="btn-add-nac" onclick="adicionarNacOp(this)">+ Adicionar nacionalidade</button>
      </td>
      <td>
        <input type="number" inputmode="numeric" class="op-total ${cls}"
               min="0" placeholder="0" value="${esc(String(op.total || ''))}" readonly>
      </td>`;
    tbody.appendChild(tr);

    // Preencher pares existentes
    var lista = tr.querySelector('.op-nac-lista');
    if (pares.length > 0) {
      pares.forEach(function(par) { adicionarLinhaOp(lista, par.pais, par.num); });
    } else {
      adicionarLinhaOp(lista, '', ''); // linha em branco inicial
    }
    recalcularTotalOp(tr);
  }
}

function parsearNacionalidades(str) {
  if (!str) return [];
  return str.split(',').map(function(s) {
    var partes = s.trim().split(':');
    return { pais: (partes[0] || '').trim(), num: (partes[1] || '').trim() };
  }).filter(function(p) { return p.pais; });
}

function adicionarLinhaOp(lista, paisSel, num) {
  var div = document.createElement('div');
  div.className = 'op-nac-linha';
  div.innerHTML =
    '<select class="op-nac-select" onchange="recalcularTotalOpDeLista(this)">' +
      '<option value="">— País —</option>' +
      opcoesNacionalidades(paisSel) +
    '</select>' +
    '<input type="number" inputmode="numeric" class="op-nac-num" min="0" placeholder="0"' +
      ' value="' + esc(String(num || '')) + '"' +
      ' oninput="recalcularTotalOpDeLista(this)">' +
    '<button type="button" class="btn-rem-nac" onclick="removerLinhaOp(this)" aria-label="Remover">✕</button>';
  lista.appendChild(div);
}

function adicionarNacOp(btn) {
  var lista = btn.previousElementSibling;
  adicionarLinhaOp(lista, '', '');
}

function removerLinhaOp(btn) {
  var lista = btn.closest('.op-nac-lista');
  var tr    = btn.closest('tr');
  btn.closest('.op-nac-linha').remove();
  recalcularTotalOp(tr);
}

function recalcularTotalOpDeLista(el) {
  if (typeof sinalizarAlteracao === 'function') sinalizarAlteracao();
  recalcularTotalOp(el.closest('tr'));
}

function recalcularTotalOp(tr) {
  var total = 0;
  tr.querySelectorAll('.op-nac-num').forEach(function(inp) {
    total += parseInt(inp.value, 10) || 0;
  });
  tr.querySelector('.op-total').value = total > 0 ? total : '';
}

// Serializar as linhas de nacionalidade para guardar (formato "País: N, País: N")
function serializarNacOp(tr) {
  var pares = [];
  tr.querySelectorAll('.op-nac-linha').forEach(function(linha) {
    var pais = linha.querySelector('.op-nac-select').value;
    var num  = parseInt(linha.querySelector('.op-nac-num').value, 10) || 0;
    if (pais && num > 0) pares.push(pais + ': ' + num);
  });
  return pares.join(', ');
}

function construirTabelaSugestoes(n, dados) {
  var tbody = document.getElementById('tabelaSugestoes');
  tbody.innerHTML = '';

  for (var i = 0; i < n; i++) {
    var s   = (dados && dados[i]) ? dados[i] : {};
    var cls = s.sugestao ? 'input-carregado' : '';
    var tr  = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="sug-texto ' + cls + '" placeholder="Escreva aqui..."' +
           ' value="' + esc(s.sugestao || '') + '"></td>' +
      '<td>' +
        '<select class="sug-nac ' + cls + '">' +
          '<option value="">— País —</option>' +
          opcoesNacionalidades(s.nacionalidade || '') +
        '</select>' +
      '</td>';
    tbody.appendChild(tr);
  }
}

// ============================================================
// TOTAIS
// ============================================================

function atualizarTotais(input) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
    input.value = '';
    return;
  }
  if (typeof sinalizarAlteracao === 'function') sinalizarAlteracao();
  var val = parseInt(input.value, 10) || 0;
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
  var total = 0, count = 0;
  document.querySelectorAll('.pais-input').forEach(function(inp) {
    var v = parseInt(inp.value, 10) || 0;
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
  var banner  = document.getElementById('estadoBanner');
  var spinner = document.getElementById('estadoSpinner');
  var textoEl = document.getElementById('estadoTexto');
  banner.className      = 'estado-banner' + (tipo ? ' ' + tipo : '');
  spinner.style.display = tipo === 'verificando' ? 'block' : 'none';
  textoEl.textContent   = texto;
}

// ============================================================
// TOAST
// ============================================================

function mostrarToast(msg, tipo) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + tipo + ' show';
  setTimeout(function() { t.classList.remove('show'); }, 3800);
}

// ============================================================
// RECOLHA DE DADOS DO FORMULÁRIO
// ============================================================

function recolherOperadores() {
  var lista = [];
  document.querySelectorAll('#tabelaOperadores tr').forEach(function(tr) {
    var nome = tr.querySelector('.op-nome')?.value.trim() || '';
    var nac  = serializarNacOp(tr);
    var tot  = parseInt(tr.querySelector('.op-total')?.value, 10) || 0;
    if (nome) lista.push({ operador: nome, nacionalidades: nac, total: tot });
  });
  return lista;
}

function recolherSugestoes() {
  var lista = [];
  document.querySelectorAll('#tabelaSugestoes tr').forEach(function(tr) {
    var sug = tr.querySelector('.sug-texto')?.value.trim() || '';
    var nac = tr.querySelector('.sug-nac')?.value        || '';
    if (sug) lista.push({ sugestao: sug, nacionalidade: nac });
  });
  return lista;
}

// ============================================================
// LIMPAR
// ============================================================

function limparFormularioParcial() {
  document.querySelectorAll('.pais-input').forEach(function(inp) {
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
  document.querySelectorAll('.pais-input').forEach(function(inp) {
    var v = resp.paises[inp.dataset.pais];
    if (v && v > 0) {
      inp.value = v;
      inp.classList.add('input-carregado');
      inp.style.borderColor = 'var(--azul-light)';
      inp.style.background  = 'rgba(46,91,138,0.04)';
      inp.style.color       = 'var(--azul)';
      inp.style.fontWeight  = '600';
    }
  });
  var nOp  = Math.max(NUM_LINHAS_OP,  (resp.operadores || []).length + 1);
  var nSug = Math.max(NUM_LINHAS_SUG, (resp.sugestoes  || []).length + 1);
  construirTabelaOperadores(nOp,  resp.operadores || []);
  construirTabelaSugestoes(nSug,  resp.sugestoes  || []);
  // Carregar observações
  if (resp.observacoes) {
    document.getElementById('observacoes').value = resp.observacoes;
  }
  recalcularTotais();
}
// ============================================================
// SECÇÕES RECOLHÍVEIS
// ============================================================

function toggleSecao(idCorpo, idIcone) {
  var corpo  = document.getElementById(idCorpo);
  var icone  = document.getElementById(idIcone);
  var aberto = corpo.style.display !== 'none';
  corpo.style.display = aberto ? 'none' : '';
  icone.textContent   = aberto ? '▼' : '▲';
}
