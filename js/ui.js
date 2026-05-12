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
// CONSTRUÇÃO DA SECÇÃO DE PAÍSES
//
// Arquitectura:
//   1. Tabela de destaque  — sempre visível (Portugal, Espanha…)
//   2. Zona de adicionados — países escolhidos via busca
//   3. Painel de busca     — campo + lista filtrada
// ============================================================

// Estado dos países adicionados via pesquisa
var _paisesAdicionados = []; // [ { nome, valor } ]

function construirTabelaPaises() {
  var local  = (document.getElementById('local') || {}).value || '';
  var simples = (typeof modoSimplificado === 'function') && modoSimplificado(local);

  // Actualizar título da secção
  var titulo = document.getElementById('tituloPaises');
  if (titulo) {
    titulo.textContent = simples
      ? 'Nacionais / Estrangeiros'
      : 'Países — Turistas e Visitantes';
  }

  if (simples) {
    _construirModoSimples();
  } else {
    _construirModoDetalhado();
  }
}

// ── Modo simplificado (Nacionais / Estrangeiros) ─────────────
function _construirModoSimples() {
  var container = document.getElementById('paisesContainer');
  container.innerHTML = '';

  // Ocultar zona de pesquisa
  var zonaPesquisa = document.getElementById('zonaPesquisaPaises');
  if (zonaPesquisa) zonaPesquisa.style.display = 'none';

  var tbody = document.createElement('tbody');
  tbody.id = 'tabelaPaises';

  PAISES_SIMPLES.forEach(function(pais) {
    tbody.appendChild(_criarLinhaPais(pais.nome, pais.destaque));
  });

  var table = document.createElement('table');
  table.className = 'paises-table';
  table.innerHTML =
    '<thead><tr>' +
      '<th>Tipo</th>' +
      '<th style="text-align:center">Turistas / Visitantes</th>' +
    '</tr></thead>';
  table.appendChild(tbody);

  var scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  scroll.appendChild(table);
  container.appendChild(scroll);
}

// ── Modo detalhado (lista completa com pesquisa) ─────────────
function _construirModoDetalhado() {
  var container = document.getElementById('paisesContainer');
  container.innerHTML = '';

  // ── Tabela de destaque ────────────────────────────────────
  var tbodyDestaque = document.createElement('tbody');
  tbodyDestaque.id = 'tabelaPaises'; // mantido para compatibilidade com o resto do código

  PAISES.filter(function(p) { return p.destaque; }).forEach(function(pais) {
    tbodyDestaque.appendChild(_criarLinhaPais(pais.nome, true));
  });

  var tableDestaque = document.createElement('table');
  tableDestaque.className = 'paises-table';
  tableDestaque.innerHTML =
    '<thead><tr>' +
      '<th>País</th>' +
      '<th style="text-align:center">Turistas / Visitantes</th>' +
    '</tr></thead>';
  tableDestaque.appendChild(tbodyDestaque);

  var scrollDestaque = document.createElement('div');
  scrollDestaque.className = 'table-scroll';
  scrollDestaque.appendChild(tableDestaque);
  container.appendChild(scrollDestaque);

  // ── Zona de países adicionados via pesquisa ───────────────
  var zonaAdicionados = document.createElement('div');
  zonaAdicionados.id = 'zonaAdicionados';
  zonaAdicionados.style.display = _paisesAdicionados.length ? '' : 'none';

  var tbodyExtra = document.createElement('tbody');
  tbodyExtra.id = 'tabelaPaisesExtra';

  _paisesAdicionados.forEach(function(p) {
    tbodyExtra.appendChild(_criarLinhaPaisExtra(p.nome));
  });

  var tableExtra = document.createElement('table');
  tableExtra.className = 'paises-table paises-table-extra';
  tableExtra.innerHTML =
    '<thead><tr>' +
      '<th>Outros países</th>' +
      '<th style="text-align:center">Turistas / Visitantes</th>' +
    '</tr></thead>';
  tableExtra.appendChild(tbodyExtra);

  var scrollExtra = document.createElement('div');
  scrollExtra.className = 'table-scroll';
  scrollExtra.appendChild(tableExtra);
  zonaAdicionados.appendChild(scrollExtra);
  container.appendChild(zonaAdicionados);

  // ── Painel de pesquisa ────────────────────────────────────
  var zonaPesquisa = document.getElementById('zonaPesquisaPaises');
  if (zonaPesquisa) {
    zonaPesquisa.style.display = '';
    _inicializarPesquisa();
  }

  // Restaurar valores guardados nos adicionados
  _paisesAdicionados.forEach(function(p) {
    var inp = document.querySelector('.pais-input[data-pais="' + p.nome + '"]');
    if (inp && p.valor > 0) {
      inp.value = p.valor;
      _aplicarEstiloValor(inp);
    }
  });
}

// ── Criar linha de país (destaque / modo simples) ─────────────
function _criarLinhaPais(nomePais, destaque) {
  var tr = document.createElement('tr');
  if (destaque) tr.classList.add('row-destaque');
  tr.innerHTML =
    '<td>' + esc(nomePais) + '</td>' +
    '<td class="num-cell">' +
      '<div class="num-stepper">' +
        '<button type="button" class="btn-stepper btn-menos"' +
                ' onclick="stepPais(this,-1)" aria-label="Menos">−</button>' +
        '<input type="number" inputmode="numeric" class="num-input pais-input"' +
               ' min="0" placeholder="0" data-pais="' + esc(nomePais) + '"' +
               ' oninput="atualizarTotais(this)">' +
        '<button type="button" class="btn-stepper btn-mais"' +
                ' onclick="stepPais(this,1)" aria-label="Mais">+</button>' +
      '</div>' +
    '</td>';
  return tr;
}

// ── Criar linha de país adicionado (com botão remover) ────────
function _criarLinhaPaisExtra(nomePais) {
  var tr = document.createElement('tr');
  tr.dataset.paisNome = nomePais;
  tr.innerHTML =
    '<td>' +
      '<span>' + esc(nomePais) + '</span>' +
      '<button type="button" class="btn-remover-pais" ' +
              'onclick="removerPaisExtra(this)" ' +
              'aria-label="Remover ' + esc(nomePais) + '" ' +
              'title="Remover">✕</button>' +
    '</td>' +
    '<td class="num-cell">' +
      '<div class="num-stepper">' +
        '<button type="button" class="btn-stepper btn-menos"' +
                ' onclick="stepPais(this,-1)" aria-label="Menos">−</button>' +
        '<input type="number" inputmode="numeric" class="num-input pais-input"' +
               ' min="0" placeholder="0" data-pais="' + esc(nomePais) + '"' +
               ' oninput="atualizarTotais(this)">' +
        '<button type="button" class="btn-stepper btn-mais"' +
                ' onclick="stepPais(this,1)" aria-label="Mais">+</button>' +
      '</div>' +
    '</td>';
  return tr;
}

// ── Pesquisa de países ────────────────────────────────────────

function _inicializarPesquisa() {
  var input = document.getElementById('inputPesquisaPais');
  if (!input) return;

  // Mover o dropdown para o body (escapa qualquer overflow:hidden)
  var lista = document.getElementById('listaPesquisaPaises');
  if (lista && lista.parentNode !== document.body) {
    document.body.appendChild(lista);
  }
  if (!lista) return;

  // Posicionar o dropdown sob o input
  function posicionarDropdown() {
    var r = input.getBoundingClientRect();
    lista.style.position = 'fixed';
    lista.style.top      = (r.bottom) + 'px';
    lista.style.left     = r.left + 'px';
    lista.style.width    = r.width + 'px';
    lista.style.zIndex   = '9000';
  }

  // Limpar listeners antigos clonando o elemento
  var novoInput = input.cloneNode(true);
  input.parentNode.replaceChild(novoInput, input);
  input = novoInput;

  input.addEventListener('input', function() {
    posicionarDropdown();
    _filtrarPaises(input.value.trim());
  });
  input.addEventListener('focus', function() {
    if (input.value.trim()) {
      posicionarDropdown();
      _filtrarPaises(input.value.trim());
    }
  });

  // Reposicionar ao fazer scroll ou resize
  window.addEventListener('scroll', function() {
    if (lista.style.display === 'block') posicionarDropdown();
  }, { passive: true });
  window.addEventListener('resize', function() {
    if (lista.style.display === 'block') posicionarDropdown();
  }, { passive: true });

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', function(e) {
    if (e.target !== input && !lista.contains(e.target)) {
      lista.style.display = 'none';
    }
  });
}

function _filtrarPaises(termo) {
  var lista = document.getElementById('listaPesquisaPaises');
  if (!lista) return;

  // Nomes já presentes (destaque + adicionados)
  var presentes = PAISES.filter(function(p) { return p.destaque; })
                        .map(function(p) { return p.nome; });
  _paisesAdicionados.forEach(function(p) { presentes.push(p.nome); });

  var disponiveis = PAISES.filter(function(p) {
    if (presentes.indexOf(p.nome) !== -1) return false;
    if (!termo) return false;
    return p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .indexOf(termo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) !== -1;
  });

  if (!disponiveis.length) {
    lista.style.display = 'none';
    return;
  }

  lista.innerHTML = '';
  disponiveis.forEach(function(pais) {
    var li = document.createElement('li');
    li.className = 'pais-sugestao';
    li.textContent = pais.nome;
    li.addEventListener('click', function() {
      adicionarPaisExtra(pais.nome);
      document.getElementById('inputPesquisaPais').value = '';
      lista.style.display = 'none';
    });
    lista.appendChild(li);
  });
  lista.style.display = 'block';
}

function adicionarPaisExtra(nomePais) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) return;

  // Evitar duplicados
  var jaExiste = _paisesAdicionados.some(function(p) { return p.nome === nomePais; });
  if (jaExiste) return;

  _paisesAdicionados.push({ nome: nomePais, valor: 0 });

  var tbody = document.getElementById('tabelaPaisesExtra');
  if (tbody) {
    tbody.appendChild(_criarLinhaPaisExtra(nomePais));
  }

  var zona = document.getElementById('zonaAdicionados');
  if (zona) zona.style.display = '';
}

function removerPaisExtra(btn) {
  var tr = btn.closest('tr');
  var nomePais = tr.dataset.paisNome;

  // Remover do estado
  _paisesAdicionados = _paisesAdicionados.filter(function(p) { return p.nome !== nomePais; });

  tr.remove();

  var zona = document.getElementById('zonaAdicionados');
  var tbody = document.getElementById('tabelaPaisesExtra');
  if (zona && tbody && tbody.rows.length === 0) {
    zona.style.display = 'none';
  }

  recalcularTotais();
}

function stepPais(btn, delta) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) return;
  var input = btn.closest('.num-stepper').querySelector('.pais-input');
  var atual = parseInt(input.value, 10) || 0;
  var novo  = Math.max(0, atual + delta);
  input.value = novo;
  atualizarTotais(input);
}

// Gera o HTML das <option> da lista de países (para operadores/sugestões)
function opcoesNacionalidades(selecionada) {
  return PAISES.map(function(p) {
    var sel = p.nome === selecionada ? ' selected' : '';
    return '<option value="' + esc(p.nome) + '"' + sel + '>' + esc(p.nome) + '</option>';
  }).join('');
}

// ── Operadores ───────────────────────────────────────────────

function construirTabelaOperadores(n, dados) {
  var tbody = document.getElementById('tabelaOperadores');
  tbody.innerHTML = '';

  for (var i = 0; i < n; i++) {
    var op  = (dados && dados[i]) ? dados[i] : {};
    var cls = op.operador ? 'input-carregado' : '';

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

    var lista = tr.querySelector('.op-nac-lista');
    if (pares.length > 0) {
      pares.forEach(function(par) { adicionarLinhaOp(lista, par.pais, par.num); });
    } else {
      adicionarLinhaOp(lista, '', '');
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
    '<select class="op-nac-select" onchange="guardaLocalERecalcula(this)">' +
      '<option value="">— País —</option>' +
      opcoesNacionalidades(paisSel) +
    '</select>' +
    '<input type="number" inputmode="numeric" class="op-nac-num" min="0" placeholder="0"' +
      ' value="' + esc(String(num || '')) + '"' +
      ' oninput="guardaLocalERecalcula(this)">' +
    '<button type="button" class="btn-rem-nac" onclick="removerLinhaOp(this)" aria-label="Remover">✕</button>';
  lista.appendChild(div);
}

function guardaLocalERecalcula(el) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
    el.value = (el.tagName === 'SELECT') ? '' : '';
    return;
  }
  if (typeof sinalizarAlteracao === 'function') sinalizarAlteracao();
  recalcularTotalOp(el.closest('tr'));
}

function adicionarNacOp(btn) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) return;
  var lista = btn.previousElementSibling;
  adicionarLinhaOp(lista, '', '');
}

function removerLinhaOp(btn) {
  var lista = btn.closest('.op-nac-lista');
  var tr    = btn.closest('tr');
  btn.closest('.op-nac-linha').remove();
  recalcularTotalOp(tr);
}

function recalcularTotalOp(tr) {
  var total = 0;
  tr.querySelectorAll('.op-nac-num').forEach(function(inp) {
    total += parseInt(inp.value, 10) || 0;
  });
  tr.querySelector('.op-total').value = total > 0 ? total : '';
}

function serializarNacOp(tr) {
  var pares = [];
  tr.querySelectorAll('.op-nac-linha').forEach(function(linha) {
    var pais = linha.querySelector('.op-nac-select').value;
    var num  = parseInt(linha.querySelector('.op-nac-num').value, 10) || 0;
    if (pais && num > 0) pares.push(pais + ': ' + num);
  });
  return pares.join(', ');
}

function onInputSugTexto(inp) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
    inp.value = ''; return;
  }
  if (typeof sinalizarAlteracao === 'function') sinalizarAlteracao();
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
           ' value="' + esc(s.sugestao || '') + '"' +
           ' oninput="onInputSugTexto(this)"></td>' +
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

function _aplicarEstiloValor(input) {
  var val = parseInt(input.value, 10) || 0;
  if (val > 0) {
    input.style.borderColor = 'var(--verde-light)';
    input.style.background  = 'rgba(61,90,62,0.05)';
    input.style.color       = 'var(--verde)';
    input.style.fontWeight  = '600';
  } else {
    input.style.cssText = '';
  }
}

function atualizarTotais(input) {
  if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
    input.value = '';
    return;
  }
  if (typeof sinalizarAlteracao === 'function') sinalizarAlteracao();
  _aplicarEstiloValor(input);
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
    count + (count === 1 ? ' registo' : ' registos');
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
  // Limpar países adicionados
  _paisesAdicionados = [];

  document.querySelectorAll('.pais-input').forEach(function(inp) {
    inp.value = ''; inp.style.cssText = ''; inp.classList.remove('input-carregado');
  });
  document.getElementById('totalDiario').textContent = '0';
  document.getElementById('totalGeral').textContent  = '0';
  document.getElementById('contadorPaises').textContent = '0 registos';

  // Reconstruir a secção de países (limpa os adicionados)
  construirTabelaPaises();

  construirTabelaOperadores(NUM_LINHAS_OP);
  construirTabelaSugestoes(NUM_LINHAS_SUG);
  document.getElementById('observacoes').value = '';

  // Limpar campo de pesquisa
  var inputPesquisa = document.getElementById('inputPesquisaPais');
  if (inputPesquisa) inputPesquisa.value = '';
  var listaPesquisa = document.getElementById('listaPesquisaPaises');
  if (listaPesquisa) listaPesquisa.style.display = 'none';
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
  // Identificar países extra (não destaque) que têm valores guardados
  var paisesDestaque = PAISES.filter(function(p) { return p.destaque; })
                             .map(function(p) { return p.nome; });
  var paisesSimples  = PAISES_SIMPLES.map(function(p) { return p.nome; });

  // Adicionar automaticamente países extra que têm valor
  _paisesAdicionados = [];
  Object.keys(resp.paises || {}).forEach(function(nomePais) {
    if (resp.paises[nomePais] > 0 &&
        paisesDestaque.indexOf(nomePais) === -1 &&
        paisesSimples.indexOf(nomePais) === -1) {
      _paisesAdicionados.push({ nome: nomePais, valor: resp.paises[nomePais] });
    }
  });

  // Reconstruir a tabela com os adicionados já no estado
  construirTabelaPaises();

  // Preencher valores
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
