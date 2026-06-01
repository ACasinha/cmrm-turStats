// ============================================================
// editor.js — Editor Mensal de Dados
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Acesso: administradores ou utilizadores com acessoEditor: true
// ============================================================

'use strict';

var _perfilAtual     = null;
var _isAdmin         = false;
var _isEditor        = false;
var _appInicializada = false;

var _localAtual      = '';
var _mesAtual        = '';   // 'YYYY-MM'
var _dadosMes        = {};   // { 'DD/MM/YYYY': { pais: valor, ... } }
var _alteracoes      = {};   // { 'DD/MM/YYYY': { pais: valor, ... } }
var _totalAlteracoes = 0;

var DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ============================================================
// HELPER — verifica se o perfil tem acesso ao editor
// ============================================================
function _temAcessoEditor(perfil) {
  return perfil.role === 'administrador' || perfil.acessoEditor === true;
}

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  // Preencher o mês actual no input
  var hoje   = new Date();
  var mesStr = hoje.getFullYear() + '-' +
               String(hoje.getMonth() + 1).padStart(2, '0');
  var inputMes = document.getElementById('inputMes');
  if (inputMes) inputMes.value = mesStr;

  inicializarLogin({
    idWrap:            'editorWrap',
    verificarAcesso:   function(perfil) {
      return _temAcessoEditor(perfil);
    },
    mensagemSemAcesso: 'Acesso negado. Não tem permissão para aceder ao editor mensal.',
    onSucesso:         function(perfil) {
      _perfilAtual = perfil;
      _isAdmin     = perfil.role === 'administrador';
      _isEditor    = true;
      activarEditor(perfil);
    },
    onSessaoTerminada: function() {
      _appInicializada = false;
    }
  });
});

function fazerLogout() {
  logout(_totalAlteracoes > 0);
}


// ============================================================
// ACTIVAR
// ============================================================

function activarEditor(perfil) {
  document.getElementById('headerNomeFuncionario').textContent =
    perfil.nome || perfil.email || '—';

  var badgeModo = document.getElementById('badgeModo');
  if (badgeModo) {
    badgeModo.className   = 'modo-badge ' + (_isAdmin ? 'admin' : 'editor');
    badgeModo.textContent = _isAdmin ? '🛡️ Administrador' : '✏️ Editor';
  }

  if (typeof construirMenuNav === 'function') construirMenuNav(perfil);

  _appInicializada = true;
}

// ============================================================
// CARREGAR DADOS DO MÊS — 1 única chamada à Cloud Function
// ============================================================

function carregarMes() {
  var local = document.getElementById('selectorLocal').value;
  var mes   = document.getElementById('inputMes').value;  // 'YYYY-MM'

  if (!local) {
    mostrarToast('Escolha um local / posto.', 'erro');
    document.getElementById('selectorLocal').focus();
    return;
  }
  if (!mes) {
    mostrarToast('Escolha o mês.', 'erro');
    document.getElementById('inputMes').focus();
    return;
  }
  if (_totalAlteracoes > 0) {
    if (!confirm('Tem alterações por guardar. Se continuar serão perdidas. Continuar?')) return;
  }

  _localAtual      = local;
  _mesAtual        = mes;
  _dadosMes        = {};
  _alteracoes      = {};
  _totalAlteracoes = 0;
  atualizarBarraAlteracoes();
  mostrarGrelhaLoading(true);

  // Uma única chamada que devolve todos os dias do mês de uma vez
  chamarAPI('obterDadosMes', { local: local, mes: mes })
    .then(function(resp) {
      mostrarGrelhaLoading(false);

      if (!resp.sucesso) {
        mostrarToast('Erro: ' + resp.mensagem, 'erro');
        return;
      }

      // resp.dados = { 'DD/MM/YYYY': { pais: valor, ... }, ... }
      _dadosMes = resp.dados || {};

      var partes  = mes.split('-');
      var ano     = parseInt(partes[0], 10);
      var mesNum  = parseInt(partes[1], 10);
      var numDias = new Date(ano, mesNum, 0).getDate();

      construirGrelha(local, ano, mesNum, numDias);
    })
    .catch(function(err) {
      mostrarGrelhaLoading(false);
      mostrarToast('Erro ao carregar dados: ' + err.message, 'erro');
    });
}

// ============================================================
// CONSTRUIR A GRELHA
// ============================================================

function construirGrelha(local, ano, mesNum, numDias) {
  var wrapper = document.getElementById('grelhaWrapper');
  wrapper.innerHTML = '';

  var simples    = (typeof modoSimplificado === 'function') && modoSimplificado(local);
  var listaPais  = simples ? PAISES_SIMPLES : PAISES;

  var hoje     = new Date();
  var hojeAno  = hoje.getFullYear();
  var hojesMes = hoje.getMonth() + 1;
  var hojesDia = hoje.getDate();

  var tabela = document.createElement('table');
  tabela.className = 'grelha-tabela';
  tabela.setAttribute('role', 'grid');

  // ── CABEÇALHO ────────────────────────────────────────────
  var thead  = document.createElement('thead');
  var trHead = document.createElement('tr');

  var thPais = document.createElement('th');
  thPais.className = 'th-pais';
  thPais.setAttribute('scope', 'col');
  var thPaisInner = document.createElement('div');
  thPaisInner.className = 'th-pais-inner';
  thPaisInner.textContent = simples ? 'Tipo de Visitante' : 'País / Região';
  thPais.appendChild(thPaisInner);
  trHead.appendChild(thPais);

  for (var d = 1; d <= numDias; d++) {
    var dataObj = new Date(ano, mesNum - 1, d);
    var diaSem  = dataObj.getDay();
    var ehFDS   = diaSem === 0 || diaSem === 6;
    var ehHoje  = (ano === hojeAno && mesNum === hojesMes && d === hojesDia);

    var th = document.createElement('th');
    th.className = 'th-dia' + (ehFDS ? ' fim-semana' : '') + (ehHoje ? ' hoje' : '');
    th.setAttribute('scope', 'col');

    var inner = document.createElement('div');
    inner.className = 'th-dia-inner';
    var numEl = document.createElement('span');
    numEl.className   = 'th-dia-num';
    numEl.textContent = d;
    var semEl = document.createElement('span');
    semEl.className   = 'th-dia-sem';
    semEl.textContent = DIAS_SEM[diaSem];
    inner.appendChild(numEl);
    inner.appendChild(semEl);
    th.appendChild(inner);
    trHead.appendChild(th);
  }

  var thTot = document.createElement('th');
  thTot.className = 'th-total';
  thTot.setAttribute('scope', 'col');
  var thTotInner = document.createElement('div');
  thTotInner.className  = 'th-total-inner';
  thTotInner.textContent = 'Total';
  thTot.appendChild(thTotInner);
  trHead.appendChild(thTot);

  thead.appendChild(trHead);
  tabela.appendChild(thead);

  // ── CORPO ─────────────────────────────────────────────────
  var tbody          = document.createElement('tbody');
  var paisesDestaque = listaPais.filter(function(p) { return p.destaque; });
  var paisesResto    = listaPais.filter(function(p) { return !p.destaque; });
  var totaisDia      = {};

  function adicionarLinhaPais(pais, isDestaque) {
    var tr = document.createElement('tr');
    tr.dataset.pais = pais.nome;
    if (isDestaque) tr.classList.add('linha-destaque');

    var tdPais = document.createElement('td');
    tdPais.className   = 'td-pais';
    tdPais.textContent = pais.nome;
    tdPais.title       = pais.nome;
    tr.appendChild(tdPais);

    var totalLinha = 0;

    for (var d = 1; d <= numDias; d++) {
      var dataFmt = String(d).padStart(2, '0') + '/' +
                    String(mesNum).padStart(2, '0') + '/' + ano;
      var dObj  = new Date(ano, mesNum - 1, d);
      var dSem  = dObj.getDay();
      var eFDS  = dSem === 0 || dSem === 6;
      var eHoje = (ano === hojeAno && mesNum === hojesMes && d === hojesDia);

      var valor = (_dadosMes[dataFmt] && _dadosMes[dataFmt][pais.nome])
                  ? (_dadosMes[dataFmt][pais.nome] || 0) : 0;
      totalLinha        += valor;
      totaisDia[d]       = (totaisDia[d] || 0) + valor;

      var td = document.createElement('td');
      td.className = 'td-valor' +
                     (eFDS  ? ' fim-semana' : '') +
                     (eHoje ? ' hoje-col'   : '');

      var inp = document.createElement('input');
      inp.type       = 'number';
      inp.inputMode  = 'numeric';
      inp.min        = '0';
      inp.className  = 'cel-input' + (valor > 0 ? ' tem-valor' : '');
      inp.value      = valor > 0 ? String(valor) : '';
      inp.placeholder = '0';
      inp.dataset.data = dataFmt;
      inp.dataset.pais = pais.nome;
      inp.setAttribute('aria-label', pais.nome + ' — dia ' + d);

      inp.addEventListener('change',  function(e) { onCelChange(e.target); });
      inp.addEventListener('keydown', function(e) { onCelKeydown(e); });
      inp.addEventListener('focus',   function(e) { e.target.select(); });

      td.appendChild(inp);
      tr.appendChild(td);
    }

    var tdTot = document.createElement('td');
    tdTot.className          = 'td-total';
    tdTot.dataset.paisTotal  = pais.nome;
    tdTot.textContent        = totalLinha > 0 ? totalLinha : '—';
    tr.appendChild(tdTot);

    tbody.appendChild(tr);
  }

  paisesDestaque.forEach(function(p) { adicionarLinhaPais(p, true); });

  if (!simples && paisesResto.length > 0) {
    var trSep = document.createElement('tr');
    trSep.className = 'linha-separador';
    var tdSep = document.createElement('td');
    tdSep.colSpan = numDias + 2;
    trSep.appendChild(tdSep);
    tbody.appendChild(trSep);
  }

  paisesResto.forEach(function(p) { adicionarLinhaPais(p, false); });

  // ── Linha de totais por dia ───────────────────────────────
  var trTotais = document.createElement('tr');
  trTotais.className = 'linha-totais';

  var tdTotLabel = document.createElement('td');
  tdTotLabel.className   = 'td-pais';
  tdTotLabel.textContent = 'Total do dia';
  trTotais.appendChild(tdTotLabel);

  var totalGeral = 0;
  for (var d = 1; d <= numDias; d++) {
    var t = totaisDia[d] || 0;
    totalGeral += t;
    var tdT = document.createElement('td');
    tdT.className        = 'td-valor';
    tdT.dataset.totalDia = d;
    tdT.style.cssText    = 'text-align:center;font-weight:700;font-size:var(--text-xs);color:' +
                           (t > 0 ? 'var(--verde)' : 'var(--cinza)');
    tdT.textContent = t > 0 ? t : '—';
    trTotais.appendChild(tdT);
  }

  var tdTotGeral = document.createElement('td');
  tdTotGeral.className   = 'td-total';
  tdTotGeral.id          = 'totalGeralGrelha';
  tdTotGeral.textContent = totalGeral > 0 ? totalGeral : '—';
  trTotais.appendChild(tdTotGeral);

  tbody.appendChild(trTotais);
  tabela.appendChild(tbody);
  wrapper.appendChild(tabela);

  var nomeMes = new Date(ano, mesNum - 1, 1)
    .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  document.getElementById('grelhaInfoTexto').innerHTML =
    'A editar: <strong>' + esc(local) + '</strong> — <strong>' + nomeMes + '</strong>';

  if (_conflitosDoMes && Object.keys(_conflitosDoMes).length > 0) {
    assinalarCelulasComConflito(_conflitosDoMes);
  }
}

// ============================================================
// ASSINALAR CONFLITOS NA GRELHA
// ============================================================

function assinalarCelulasComConflito(conflitos) {
  Object.keys(conflitos).forEach(function(dataFmt) {
    var conflito = conflitos[dataFmt];
    
    // Marcar toda a coluna do dia com indicador visual
    var th = document.querySelector('th[data-data="' + dataFmt + '"]');
    if (th) {
      th.classList.add('tem-conflito');
      th.title = 'Conflito pendente — clique para resolver';
    }
    
    // Marcar células específicas que diferem
    Object.keys(conflito.payloadNovo.paises).forEach(function(pais) {
      var inp = document.querySelector(
        '.cel-input[data-data="' + dataFmt + '"][data-pais="' + pais + '"]'
      );
      if (inp) inp.classList.add('celula-conflito');
    });
  });

}

// ============================================================
// EVENTOS DE CÉLULA
// ============================================================

function onCelChange(inp) {
  var data  = inp.dataset.data;
  var pais  = inp.dataset.pais;
  var valor = Math.max(0, parseInt(inp.value, 10) || 0);

  inp.value = valor > 0 ? String(valor) : '';
  inp.classList.toggle('tem-valor', valor > 0);

  var original = (_dadosMes[data] && _dadosMes[data][pais]) || 0;
  var alterado = (valor !== original);
  inp.classList.toggle('alterada', alterado);

  if (!_alteracoes[data]) _alteracoes[data] = {};
  if (alterado) {
    _alteracoes[data][pais] = valor;
  } else {
    delete _alteracoes[data][pais];
    if (Object.keys(_alteracoes[data]).length === 0) delete _alteracoes[data];
  }

  recalcularTotalLinha(pais);
  recalcularTotalDia(data);
  recalcularTotalGeral();

  _totalAlteracoes = contarAlteracoes();
  atualizarBarraAlteracoes();
}

function onCelKeydown(e) {
  var inp    = e.target;
  var tr     = inp.closest('tr');
  var tabela = inp.closest('table');
  if (!tabela) return;

  var linhas  = Array.from(tabela.querySelectorAll('tbody tr:not(.linha-separador):not(.linha-totais)'));
  var trIdx   = linhas.indexOf(tr);
  var celulas = Array.from(tr.querySelectorAll('.cel-input'));
  var celIdx  = celulas.indexOf(inp);
  var alvo    = null;

  if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    alvo = celulas[celIdx + 1] || null;
    if (!alvo && linhas[trIdx + 1]) alvo = linhas[trIdx + 1].querySelector('.cel-input');
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
    e.preventDefault();
    alvo = celulas[celIdx - 1] || null;
    if (!alvo && linhas[trIdx - 1]) {
      var prev = linhas[trIdx - 1].querySelectorAll('.cel-input');
      alvo = prev[prev.length - 1] || null;
    }
  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
    e.preventDefault();
    if (linhas[trIdx + 1]) {
      alvo = linhas[trIdx + 1].querySelectorAll('.cel-input')[celIdx] || null;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (trIdx > 0) {
      alvo = linhas[trIdx - 1].querySelectorAll('.cel-input')[celIdx] || null;
    }
  } else if (e.key === 'Escape') {
    var dataE     = inp.dataset.data;
    var paisE     = inp.dataset.pais;
    var originalE = (_dadosMes[dataE] && _dadosMes[dataE][paisE]) || 0;
    inp.value     = originalE > 0 ? String(originalE) : '';
    onCelChange(inp);
    inp.blur();
  }

  if (alvo && !alvo.disabled) { alvo.focus(); alvo.select(); }
}

// ============================================================
// RECÁLCULOS
// ============================================================

function recalcularTotalLinha(nomePais) {
  var tabela = document.querySelector('.grelha-tabela');
  if (!tabela) return;
  var tr = tabela.querySelector('tr[data-pais="' + CSS.escape(nomePais) + '"]');
  if (!tr) return;
  var total = 0;
  tr.querySelectorAll('.cel-input').forEach(function(i) { total += parseInt(i.value, 10) || 0; });
  var tdTot = tabela.querySelector('td[data-pais-total="' + CSS.escape(nomePais) + '"]');
  if (tdTot) tdTot.textContent = total > 0 ? total : '—';
}

function recalcularTotalDia(dataFmt) {
  var dia    = parseInt(dataFmt.split('/')[0], 10);
  var tabela = document.querySelector('.grelha-tabela');
  if (!tabela) return;
  var total = 0;
  tabela.querySelectorAll('.cel-input[data-data="' + dataFmt + '"]')
        .forEach(function(i) { total += parseInt(i.value, 10) || 0; });
  var el = tabela.querySelector('td[data-total-dia="' + dia + '"]');
  if (el) {
    el.textContent = total > 0 ? total : '—';
    el.style.color = total > 0 ? 'var(--verde)' : 'var(--cinza)';
  }
}

function recalcularTotalGeral() {
  var tabela = document.querySelector('.grelha-tabela');
  if (!tabela) return;
  var total = 0;
  tabela.querySelectorAll('.cel-input').forEach(function(i) { total += parseInt(i.value, 10) || 0; });
  var el = document.getElementById('totalGeralGrelha');
  if (el) el.textContent = total > 0 ? total : '—';
}

function contarAlteracoes() {
  var n = 0;
  Object.values(_alteracoes).forEach(function(obj) { n += Object.keys(obj).length; });
  return n;
}

function atualizarBarraAlteracoes() {
  var badge  = document.getElementById('alteracoesBadge');
  var btnG   = document.getElementById('btnGuardarTudo');
  if (_totalAlteracoes > 0) {
    badge.classList.add('visivel');
    badge.textContent = '✏️ ' + _totalAlteracoes +
      (_totalAlteracoes === 1 ? ' alteração' : ' alterações') + ' por guardar';
    if (btnG) btnG.disabled = false;
  } else {
    badge.classList.remove('visivel');
    if (btnG) btnG.disabled = true;
  }
}

// ============================================================
// GUARDAR ALTERAÇÕES — agrupa dias em lotes, 1 call por dia alterado
// (muito melhor do que as 31 calls anteriores — só envia os dias
//  que foram efectivamente modificados)
// ============================================================

function confirmarGuardar() {
  if (_totalAlteracoes === 0) { mostrarToast('Não há alterações para guardar.', 'info'); return; }
  var diasAlterados = Object.keys(_alteracoes).length;
  document.getElementById('modalResumoTexto').textContent =
    '📍 Local: '  + _localAtual + '\n' +
    '📅 Mês: '    + formatarMesLegivel(_mesAtual) + '\n' +
    '📊 Dias com alterações: ' + diasAlterados + '\n' +
    '✏️ Células alteradas: '   + _totalAlteracoes;
  document.getElementById('modalGuardar').classList.add('show');
}

function fecharModalGuardar() {
  document.getElementById('modalGuardar').classList.remove('show');
}

function executarGuardar() {
  fecharModalGuardar();
  var datas = Object.keys(_alteracoes);
  if (datas.length === 0) return;

  var btnG = document.getElementById('btnGuardarTudo');
  if (btnG) { btnG.disabled = true; btnG.textContent = '⏳ A guardar...'; }
  mostrarToast('A guardar ' + datas.length + ' dia(s) alterado(s)...', 'info');

  // Apenas os dias alterados geram chamadas (N << 31 na maioria dos casos)
  var promessas = datas.map(function(data) {
    var existentes    = _dadosMes[data] || {};
    var alteracoesDia = _alteracoes[data] || {};
    var finais = {};
    Object.keys(existentes).forEach(function(p) {
      if ((existentes[p] || 0) > 0) finais[p] = existentes[p];
    });
    Object.keys(alteracoesDia).forEach(function(p) {
      var v = alteracoesDia[p] || 0;
      if (v > 0) finais[p] = v; else delete finais[p];
    });
    return chamarAPI('guardarRegisto', {
      data: data, local: _localAtual, paises: finais,
      operadores: [], sugestoes: [], observacoes: ''
    });
  });

  Promise.all(promessas)
    .then(function(resultados) {
      var sucesso = resultados.filter(function(r) { return r && r.sucesso; }).length;
      var falhou  = resultados.length - sucesso;
      if (btnG) { btnG.disabled = false; btnG.textContent = '💾 Guardar alterações'; }

      if (falhou === 0) {
        // Actualizar _dadosMes com os valores guardados
        datas.forEach(function(data) {
          if (!_dadosMes[data]) _dadosMes[data] = {};
          Object.keys(_alteracoes[data] || {}).forEach(function(p) {
            _dadosMes[data][p] = _alteracoes[data][p];
          });
        });
        _alteracoes = {}; _totalAlteracoes = 0;
        atualizarBarraAlteracoes();
        document.querySelectorAll('.cel-input.alterada').forEach(function(el) {
          el.classList.remove('alterada');
        });
        mostrarToast('✓ ' + sucesso + ' dia(s) guardado(s) com sucesso.', 'sucesso');
      } else {
        mostrarToast('⚠️ ' + sucesso + ' guardado(s), ' + falhou + ' com erro.', 'aviso');
        atualizarBarraAlteracoes();
      }
    })
    .catch(function(err) {
      if (btnG) { btnG.disabled = false; btnG.textContent = '💾 Guardar alterações'; }
      mostrarToast('Erro ao guardar: ' + err.message, 'erro');
    });
}

function descartarAlteracoes() {
  if (_totalAlteracoes === 0) return;
  if (!confirm('Tem a certeza que quer descartar todas as alterações não guardadas?')) return;
  document.querySelectorAll('.cel-input.alterada').forEach(function(inp) {
    var data     = inp.dataset.data;
    var pais     = inp.dataset.pais;
    var original = (_dadosMes[data] && _dadosMes[data][pais]) || 0;
    inp.value = original > 0 ? String(original) : '';
    inp.classList.remove('alterada');
    inp.classList.toggle('tem-valor', original > 0);
    recalcularTotalLinha(pais);
    recalcularTotalDia(data);
  });
  _alteracoes = {}; _totalAlteracoes = 0;
  recalcularTotalGeral();
  atualizarBarraAlteracoes();
  mostrarToast('Alterações descartadas.', 'info');
}

// ============================================================
// UI AUXILIARES
// ============================================================

function mostrarGrelhaLoading(mostrar) {
  document.getElementById('grelhaLoading').classList.toggle('show', mostrar);
  if (mostrar) document.getElementById('grelhaWrapper').innerHTML = '';
  document.getElementById('grelhaAcoes').style.display = mostrar ? 'none' : '';
}

function formatarMesLegivel(mesStr) {
  if (!mesStr) return '';
  var p = mesStr.split('-');
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1)
    .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

function voltarParaApp() {
  if (_totalAlteracoes > 0) {
    if (!confirm('Tem alterações por guardar. Tem a certeza que quer sair?')) return;
  }
  window.location.href = 'index.html';
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mostrarToast(msg, tipo) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (tipo || 'info') + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('show'); }, 4000);
}

document.addEventListener('DOMContentLoaded', function() {
  var overlay = document.getElementById('modalGuardar');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) fecharModalGuardar();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') fecharModalGuardar();
  });
  window.addEventListener('beforeunload', function(e) {
    if (_totalAlteracoes > 0) {
      e.preventDefault();
      e.returnValue = 'Tem alterações por guardar.';
      return e.returnValue;
    }
  });
});
