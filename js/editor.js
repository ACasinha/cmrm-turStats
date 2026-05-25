// ============================================================
// editor.js — Editor Mensal de Dados
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Permite a administradores e utilizadores com role "editor"
// consultar e editar os registos de um mês completo por local,
// apresentados numa grelha país × dia.
// ============================================================

'use strict';

// ── Estado global ────────────────────────────────────────────
var _perfilAtual      = null;
var _isAdmin          = false;
var _isEditor         = false;
var _appInicializada  = false;

var _localAtual       = '';
var _mesAtual         = '';   // 'YYYY-MM'
var _dadosMes         = {};   // { 'DD/MM/YYYY': { pais: valor, ... } }
var _alteracoes       = {};   // { 'DD/MM/YYYY': { pais: valor, ... } } — só células alteradas
var _totalAlteracoes  = 0;

// Dias da semana abreviados (pt)
var DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  // Pré-preencher o mês com o mês actual
  var hoje = new Date();
  var mesStr = hoje.getFullYear() + '-' +
               String(hoje.getMonth() + 1).padStart(2, '0');
  var inputMes = document.getElementById('inputMes');
  if (inputMes) inputMes.value = mesStr;

  var unsubInicial = firebaseAuth.onAuthStateChanged(function(user) {
    unsubInicial();

    if (user && sessaoValida()) {
      obterPerfilUtilizador()
        .then(function(perfil) {
          _perfilAtual = perfil;
          _isAdmin     = perfil.role === 'administrador';
          _isEditor    = perfil.role === 'editor' || _isAdmin;

          if (!_isEditor) {
            // Sem permissão — mostrar erro no ecrã de login
            var erro = document.getElementById('loginErro');
            erro.textContent = 'Acesso negado. Apenas administradores e editores podem aceder a esta área.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }

          activarEditor(perfil);
        })
        .catch(function() { mostrarEcraLogin(); });
    } else {
      if (user) apiLogout();
      mostrarEcraLogin();
    }

    // Observar logout externo
    firebaseAuth.onAuthStateChanged(function(u) {
      if (!u && _appInicializada) {
        _appInicializada = false;
        mostrarEcraLogin();
      }
    });
  });
});

// ============================================================
// LOGIN
// ============================================================

function fazerLogin() {
  var email = document.getElementById('loginUser').value.trim();
  var pass  = document.getElementById('loginPass').value;
  var erro  = document.getElementById('loginErro');
  var btn   = document.getElementById('btnLogin');

  if (!email || !pass) {
    erro.textContent = 'Por favor preencha todos os campos.';
    erro.classList.add('visivel');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'A autenticar...';
  erro.classList.remove('visivel');

  apiAutenticar(email, pass,
    function onSuccess() {
      btn.disabled = false;
      btn.textContent = 'Entrar →';

      obterPerfilUtilizador()
        .then(function(perfil) {
          _perfilAtual = perfil;
          _isAdmin     = perfil.role === 'administrador';
          _isEditor    = perfil.role === 'editor' || _isAdmin;

          if (!perfil.ativo) {
            erro.textContent = 'Esta conta foi desativada. Contacte o administrador.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }
          if (!_isEditor) {
            erro.textContent = 'Acesso negado. Apenas administradores e editores podem aceder a esta área.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }

          activarEditor(perfil);
        })
        .catch(function(err) {
          erro.textContent = 'Erro ao verificar permissões: ' + err.message;
          erro.classList.add('visivel');
          apiLogout();
        });
    },
    function onFailure(err) {
      btn.disabled = false;
      btn.textContent = 'Entrar →';
      erro.textContent = err.message;
      erro.classList.add('visivel');
      document.getElementById('loginPass').value = '';
    }
  );
}

function fazerLogout() {
  if (_totalAlteracoes > 0) {
    if (!confirm('Tem alterações por guardar. Tem a certeza que quer sair?')) return;
  }
  _appInicializada = false;
  limparCacheUtilizador();
  apiLogout().then(function() { mostrarEcraLogin(); });
}

function mostrarEcraLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('editorWrap').style.display = 'none';
  document.getElementById('loginPass').value = '';
}

// ============================================================
// ACTIVAR
// ============================================================

function activarEditor(perfil) {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('editorWrap').style.display = '';
  document.getElementById('headerNomeFuncionario').textContent =
    perfil.nome || perfil.email || '—';

  // Mostrar badge de modo
  var badgeModo = document.getElementById('badgeModo');
  if (badgeModo) {
    badgeModo.className = 'modo-badge ' + (_isAdmin ? 'admin' : 'editor');
    badgeModo.textContent = _isAdmin ? '🛡️ Administrador' : '✏️ Editor';
  }

  _appInicializada = true;
}

// ============================================================
// CARREGAR DADOS DO MÊS
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
    if (!confirm('Tem alterações por guardar. Se continuar, essas alterações serão perdidas. Continuar?')) return;
  }

  _localAtual = local;
  _mesAtual   = mes;
  _dadosMes   = {};
  _alteracoes = {};
  _totalAlteracoes = 0;
  atualizarBarraAlteracoes();

  mostrarGrelhaLoading(true);

  // Determinar todos os dias do mês
  var partes = mes.split('-');
  var ano    = parseInt(partes[0], 10);
  var mesNum = parseInt(partes[1], 10);
  var numDias = new Date(ano, mesNum, 0).getDate();

  var datas = [];
  for (var d = 1; d <= numDias; d++) {
    // Formato do Firestore: "DD/MM/YYYY"
    datas.push(
      String(d).padStart(2, '0') + '/' +
      String(mesNum).padStart(2, '0') + '/' +
      ano
    );
  }

  // Chamar a Cloud Function para verificar/obter dados de cada dia
  // Usamos promises em paralelo para todos os dias
  var promessas = datas.map(function(data) {
    return new Promise(function(resolve) {
      chamarAPI('verificarDados', { local: local, data: data })
        .then(function(resp) {
          if (resp.sucesso && resp.existe && resp.paises) {
            resolve({ data: data, paises: resp.paises });
          } else {
            resolve({ data: data, paises: {} });
          }
        })
        .catch(function() {
          resolve({ data: data, paises: {} });
        });
    });
  });

  Promise.all(promessas)
    .then(function(resultados) {
      resultados.forEach(function(r) {
        _dadosMes[r.data] = r.paises;
      });
      mostrarGrelhaLoading(false);
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

  // Determinar lista de países conforme o local
  var simples   = (typeof modoSimplificado === 'function') && modoSimplificado(local);
  var listaPais = simples ? PAISES_SIMPLES : PAISES;

  // Hoje (para destacar a coluna)
  var hoje      = new Date();
  var hojeAno   = hoje.getFullYear();
  var hojesMes  = hoje.getMonth() + 1;
  var hojesDia  = hoje.getDate();

  // ── Tabela ────────────────────────────────────────────────
  var tabela = document.createElement('table');
  tabela.className = 'grelha-tabela';
  tabela.setAttribute('role', 'grid');

  // ── CABEÇALHO ────────────────────────────────────────────
  var thead = document.createElement('thead');
  var trHead = document.createElement('tr');

  // Célula de cabeçalho "País / Tipo"
  var thPais = document.createElement('th');
  thPais.className = 'th-pais';
  thPais.setAttribute('scope', 'col');
  var thPaisInner = document.createElement('div');
  thPaisInner.className = 'th-pais-inner';
  thPaisInner.textContent = simples ? 'Tipo de Visitante' : 'País / Região';
  thPais.appendChild(thPaisInner);
  trHead.appendChild(thPais);

  // Células de dia
  for (var d = 1; d <= numDias; d++) {
    var dataObj   = new Date(ano, mesNum - 1, d);
    var diaSem    = dataObj.getDay(); // 0=Dom, 6=Sáb
    var ehFDS     = diaSem === 0 || diaSem === 6;
    var ehHoje    = (ano === hojeAno && mesNum === hojesMes && d === hojesDia);

    var th = document.createElement('th');
    th.className = 'th-dia' + (ehFDS ? ' fim-semana' : '') + (ehHoje ? ' hoje' : '');
    th.setAttribute('scope', 'col');

    var inner = document.createElement('div');
    inner.className = 'th-dia-inner';

    var numEl = document.createElement('span');
    numEl.className = 'th-dia-num';
    numEl.textContent = d;

    var semEl = document.createElement('span');
    semEl.className = 'th-dia-sem';
    semEl.textContent = DIAS_SEM[diaSem];

    inner.appendChild(numEl);
    inner.appendChild(semEl);
    th.appendChild(inner);
    trHead.appendChild(th);
  }

  // Célula de cabeçalho "Total"
  var thTot = document.createElement('th');
  thTot.className = 'th-total';
  thTot.setAttribute('scope', 'col');
  var thTotInner = document.createElement('div');
  thTotInner.className = 'th-total-inner';
  thTotInner.textContent = 'Total';
  thTot.appendChild(thTotInner);
  trHead.appendChild(thTot);

  thead.appendChild(trHead);
  tabela.appendChild(thead);

  // ── CORPO ─────────────────────────────────────────────────
  var tbody = document.createElement('tbody');

  // Separar países de destaque dos restantes
  var paisesDestaque = listaPais.filter(function(p) { return p.destaque; });
  var paisesResto    = listaPais.filter(function(p) { return !p.destaque; });

  // Totais por coluna (dia)
  var totaisDia = {}; // { dia: total }

  function adicionarLinhaPais(pais, idx, isDestaque) {
    var tr = document.createElement('tr');
    tr.dataset.pais = pais.nome;
    if (isDestaque) tr.classList.add('linha-destaque');

    // Célula de país
    var tdPais = document.createElement('td');
    tdPais.className = 'td-pais';
    tdPais.textContent = pais.nome;
    tdPais.title = pais.nome;
    tr.appendChild(tdPais);

    // Células de valores por dia
    var totalLinha = 0;

    for (var d = 1; d <= numDias; d++) {
      var dataFmt   = String(d).padStart(2, '0') + '/' +
                      String(mesNum).padStart(2, '0') + '/' + ano;
      var dataObj   = new Date(ano, mesNum - 1, d);
      var diaSem    = dataObj.getDay();
      var ehFDS     = diaSem === 0 || diaSem === 6;
      var ehHoje    = (ano === hojeAno && mesNum === hojesMes && d === hojesDia);

      var valor = (_dadosMes[dataFmt] && _dadosMes[dataFmt][pais.nome])
                  ? (_dadosMes[dataFmt][pais.nome] || 0)
                  : 0;
      totalLinha += valor;
      totaisDia[d] = (totaisDia[d] || 0) + valor;

      var td = document.createElement('td');
      td.className = 'td-valor' +
                     (ehFDS  ? ' fim-semana' : '') +
                     (ehHoje ? ' hoje-col'   : '');

      var inp = document.createElement('input');
      inp.type = 'number';
      inp.inputMode = 'numeric';
      inp.min = '0';
      inp.className = 'cel-input' + (valor > 0 ? ' tem-valor' : '');
      inp.value = valor > 0 ? String(valor) : '';
      inp.placeholder = '0';
      inp.dataset.data  = dataFmt;
      inp.dataset.pais  = pais.nome;
      inp.setAttribute('aria-label', pais.nome + ' — dia ' + d);

      inp.addEventListener('change',   function(e) { onCelChange(e.target); });
      inp.addEventListener('keydown',  function(e) { onCelKeydown(e); });
      inp.addEventListener('focus',    function(e) { e.target.select(); });

      td.appendChild(inp);
      tr.appendChild(td);
    }

    // Célula de total da linha
    var tdTot = document.createElement('td');
    tdTot.className = 'td-total';
    tdTot.dataset.paisTotal = pais.nome;
    tdTot.textContent = totalLinha > 0 ? totalLinha : '—';
    tr.appendChild(tdTot);

    tbody.appendChild(tr);
  }

  // Países de destaque
  paisesDestaque.forEach(function(p, i) { adicionarLinhaPais(p, i, true); });

  // Separador visual entre destaque e resto (apenas no modo detalhado)
  if (!simples && paisesResto.length > 0) {
    var trSep = document.createElement('tr');
    trSep.className = 'linha-separador';
    var tdSep = document.createElement('td');
    tdSep.colSpan = numDias + 2;
    trSep.appendChild(tdSep);
    tbody.appendChild(trSep);
  }

  // Restantes países
  paisesResto.forEach(function(p, i) { adicionarLinhaPais(p, i, false); });

  // ── Linha de totais por dia ───────────────────────────────
  var trTotais = document.createElement('tr');
  trTotais.className = 'linha-totais';

  var tdTotLabel = document.createElement('td');
  tdTotLabel.className = 'td-pais';
  tdTotLabel.textContent = 'Total do dia';
  tdTotLabel.style.fontWeight = '700';
  trTotais.appendChild(tdTotLabel);

  var totalGeral = 0;
  for (var d = 1; d <= numDias; d++) {
    var t = totaisDia[d] || 0;
    totalGeral += t;
    var tdT = document.createElement('td');
    tdT.className = 'td-valor';
    tdT.dataset.totalDia = d;
    tdT.style.textAlign = 'center';
    tdT.style.fontWeight = '700';
    tdT.style.color = t > 0 ? 'var(--verde)' : 'var(--cinza)';
    tdT.style.fontSize = 'var(--text-xs)';
    tdT.textContent = t > 0 ? t : '—';
    trTotais.appendChild(tdT);
  }

  var tdTotGeral = document.createElement('td');
  tdTotGeral.className = 'td-total';
  tdTotGeral.id = 'totalGeralGrelha';
  tdTotGeral.textContent = totalGeral > 0 ? totalGeral : '—';
  trTotais.appendChild(tdTotGeral);

  tbody.appendChild(trTotais);
  tabela.appendChild(tbody);

  wrapper.appendChild(tabela);

  // Actualizar info da grelha
  var nomeMes = new Date(ano, mesNum - 1, 1)
    .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  document.getElementById('grelhaInfoTexto').innerHTML =
    'A editar: <strong>' + esc(local) + '</strong> — <strong>' + nomeMes + '</strong>';
}

// ============================================================
// EVENTOS DE CÉLULA
// ============================================================

function onCelChange(inp) {
  var data  = inp.dataset.data;
  var pais  = inp.dataset.pais;
  var valor = Math.max(0, parseInt(inp.value, 10) || 0);

  // Normalizar
  inp.value = valor > 0 ? String(valor) : '';

  // Estilo
  inp.classList.toggle('tem-valor', valor > 0);

  // Verificar se é diferente do valor original
  var original = (_dadosMes[data] && _dadosMes[data][pais]) || 0;
  var alterado = (valor !== original);
  inp.classList.toggle('alterada', alterado);

  // Registar alteração
  if (!_alteracoes[data]) _alteracoes[data] = {};
  if (alterado) {
    _alteracoes[data][pais] = valor;
  } else {
    delete _alteracoes[data][pais];
    if (Object.keys(_alteracoes[data]).length === 0) {
      delete _alteracoes[data];
    }
  }

  // Recalcular total da linha
  recalcularTotalLinha(pais);

  // Recalcular total do dia (coluna)
  recalcularTotalDia(data);

  // Recalcular total geral
  recalcularTotalGeral();

  // Actualizar contador de alterações
  _totalAlteracoes = contarAlteracoes();
  atualizarBarraAlteracoes();
}

function onCelKeydown(e) {
  var inp    = e.target;
  var tr     = inp.closest('tr');
  var td     = inp.closest('td');
  var tabela = inp.closest('table');
  if (!tabela) return;

  var linhas  = Array.from(tabela.querySelectorAll('tbody tr:not(.linha-separador):not(.linha-totais)'));
  var trIdx   = linhas.indexOf(tr);
  var celulas = Array.from(tr.querySelectorAll('.cel-input'));
  var celIdx  = celulas.indexOf(inp);

  var alvo = null;

  if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    alvo = celulas[celIdx + 1] || null;
    if (!alvo && linhas[trIdx + 1]) {
      alvo = linhas[trIdx + 1].querySelector('.cel-input');
    }
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
      var proxCels = linhas[trIdx + 1].querySelectorAll('.cel-input');
      alvo = proxCels[celIdx] || null;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (trIdx > 0) {
      var antCels = linhas[trIdx - 1].querySelectorAll('.cel-input');
      alvo = antCels[celIdx] || null;
    }
  } else if (e.key === 'Escape') {
    // Reverter valor
    var data     = inp.dataset.data;
    var pais     = inp.dataset.pais;
    var original = (_dadosMes[data] && _dadosMes[data][pais]) || 0;
    inp.value    = original > 0 ? String(original) : '';
    onCelChange(inp);
    inp.blur();
  }

  if (alvo && !alvo.disabled) {
    alvo.focus();
    alvo.select();
  }
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
  tr.querySelectorAll('.cel-input').forEach(function(inp) {
    total += parseInt(inp.value, 10) || 0;
  });

  var tdTot = tabela.querySelector('td[data-pais-total="' + CSS.escape(nomePais) + '"]');
  if (tdTot) tdTot.textContent = total > 0 ? total : '—';
}

function recalcularTotalDia(dataFmt) {
  // Extrair o dia do formato "DD/MM/YYYY"
  var dia = parseInt(dataFmt.split('/')[0], 10);
  var tabela = document.querySelector('.grelha-tabela');
  if (!tabela) return;

  var total = 0;
  tabela.querySelectorAll('.cel-input[data-data="' + dataFmt + '"]').forEach(function(inp) {
    total += parseInt(inp.value, 10) || 0;
  });

  var tdTotDia = tabela.querySelector('td[data-total-dia="' + dia + '"]');
  if (tdTotDia) {
    tdTotDia.textContent = total > 0 ? total : '—';
    tdTotDia.style.color = total > 0 ? 'var(--verde)' : 'var(--cinza)';
  }
}

function recalcularTotalGeral() {
  var tabela = document.querySelector('.grelha-tabela');
  if (!tabela) return;

  var total = 0;
  tabela.querySelectorAll('.cel-input').forEach(function(inp) {
    total += parseInt(inp.value, 10) || 0;
  });

  var el = document.getElementById('totalGeralGrelha');
  if (el) el.textContent = total > 0 ? total : '—';
}

function contarAlteracoes() {
  var n = 0;
  Object.values(_alteracoes).forEach(function(diaObj) {
    n += Object.keys(diaObj).length;
  });
  return n;
}

function atualizarBarraAlteracoes() {
  var badge = document.getElementById('alteracoesBadge');
  var btnGuardar = document.getElementById('btnGuardarTudo');

  if (_totalAlteracoes > 0) {
    badge.classList.add('visivel');
    badge.textContent = '✏️ ' + _totalAlteracoes +
      (_totalAlteracoes === 1 ? ' alteração' : ' alterações') + ' por guardar';
    if (btnGuardar) btnGuardar.disabled = false;
  } else {
    badge.classList.remove('visivel');
    if (btnGuardar) btnGuardar.disabled = true;
  }
}

// ============================================================
// GUARDAR ALTERAÇÕES
// ============================================================

function confirmarGuardar() {
  if (_totalAlteracoes === 0) {
    mostrarToast('Não há alterações para guardar.', 'info');
    return;
  }

  // Construir resumo para o modal
  var diasAlterados = Object.keys(_alteracoes).length;
  var resumo =
    '📍 Local: ' + _localAtual + '\n' +
    '📅 Mês: ' + formatarMesLegivel(_mesAtual) + '\n' +
    '📊 Dias com alterações: ' + diasAlterados + '\n' +
    '✏️ Total de células alteradas: ' + _totalAlteracoes;

  document.getElementById('modalResumoTexto').textContent = resumo;
  document.getElementById('modalGuardar').classList.add('show');
}

function fecharModalGuardar() {
  document.getElementById('modalGuardar').classList.remove('show');
}

function executarGuardar() {
  fecharModalGuardar();

  var datas  = Object.keys(_alteracoes);
  if (datas.length === 0) return;

  var btnG = document.getElementById('btnGuardarTudo');
  if (btnG) { btnG.disabled = true; btnG.textContent = '⏳ A guardar...'; }
  mostrarToast('A guardar ' + datas.length + ' dia(s)...', 'info');

  // Construir payloads: para cada data alterada, fundir com dados existentes
  var promessas = datas.map(function(data) {
    var paisesExistentes = _dadosMes[data] || {};
    var alteracoesDia    = _alteracoes[data] || {};

    // Fundir: começar com os dados existentes e aplicar as alterações
    var paisesFinais = {};
    Object.keys(paisesExistentes).forEach(function(p) {
      if ((paisesExistentes[p] || 0) > 0) paisesFinais[p] = paisesExistentes[p];
    });
    Object.keys(alteracoesDia).forEach(function(p) {
      var v = alteracoesDia[p] || 0;
      if (v > 0) {
        paisesFinais[p] = v;
      } else {
        delete paisesFinais[p]; // valor 0 → remover
      }
    });

    return chamarAPI('guardarRegisto', {
      data:        data,
      local:       _localAtual,
      paises:      paisesFinais,
      operadores:  [],
      sugestoes:   [],
      observacoes: ''
    });
  });

  Promise.all(promessas)
    .then(function(resultados) {
      var sucesso = resultados.filter(function(r) { return r && r.sucesso; }).length;
      var falhou  = resultados.length - sucesso;

      if (btnG) { btnG.disabled = false; btnG.textContent = '💾 Guardar alterações'; }

      if (falhou === 0) {
        // Actualizar _dadosMes com as alterações guardadas
        datas.forEach(function(data) {
          if (!_dadosMes[data]) _dadosMes[data] = {};
          var alt = _alteracoes[data] || {};
          Object.keys(alt).forEach(function(p) {
            _dadosMes[data][p] = alt[p];
          });
        });

        // Limpar alterações e estilos
        _alteracoes       = {};
        _totalAlteracoes  = 0;
        atualizarBarraAlteracoes();
        document.querySelectorAll('.cel-input.alterada').forEach(function(el) {
          el.classList.remove('alterada');
        });

        mostrarToast('✓ ' + sucesso + ' dia(s) guardado(s) com sucesso.', 'sucesso');
      } else {
        mostrarToast(
          '⚠️ ' + sucesso + ' dia(s) guardado(s), ' + falhou + ' com erro. Verifique a ligação.',
          'aviso'
        );
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

  // Repor valores originais nos inputs
  document.querySelectorAll('.cel-input.alterada').forEach(function(inp) {
    var data     = inp.dataset.data;
    var pais     = inp.dataset.pais;
    var original = (_dadosMes[data] && _dadosMes[data][pais]) || 0;
    inp.value    = original > 0 ? String(original) : '';
    inp.classList.remove('alterada');
    inp.classList.toggle('tem-valor', original > 0);
    recalcularTotalLinha(pais);
    recalcularTotalDia(data);
  });

  _alteracoes      = {};
  _totalAlteracoes = 0;
  recalcularTotalGeral();
  atualizarBarraAlteracoes();
  mostrarToast('Alterações descartadas.', 'info');
}

// ============================================================
// UI AUXILIARES
// ============================================================

function mostrarGrelhaLoading(mostrar) {
  var loading = document.getElementById('grelhaLoading');
  var wrapper = document.getElementById('grelhaWrapper');

  if (mostrar) {
    loading.classList.add('show');
    wrapper.innerHTML = '';
    document.getElementById('grelhaAcoes').style.display = 'none';
  } else {
    loading.classList.remove('show');
    document.getElementById('grelhaAcoes').style.display = '';
  }
}

function formatarMesLegivel(mesStr) {
  if (!mesStr) return '';
  var p = mesStr.split('-');
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, 1);
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function voltarParaApp() {
  if (_totalAlteracoes > 0) {
    if (!confirm('Tem alterações por guardar. Tem a certeza que quer sair?')) return;
  }
  window.location.href = 'index.html';
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mostrarToast(msg, tipo) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (tipo || 'info') + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() { t.classList.remove('show'); }, 4000);
}

// Fechar modal ao clicar fora
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

  // Aviso ao fechar a aba com alterações por guardar
  window.addEventListener('beforeunload', function(e) {
    if (_totalAlteracoes > 0) {
      e.preventDefault();
      e.returnValue = 'Tem alterações por guardar.';
      return e.returnValue;
    }
  });
});
