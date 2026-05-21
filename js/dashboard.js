// ============================================================
// dashboard.js — Lógica do Dashboard de Gráficos
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var _perfilAtual    = null;
var _isAdmin        = false;
var _isVisualizador = false;
var _tabAtiva       = 0;
var _secoes         = [];        // estrutura completa carregada do Firestore
var _editandoSecao  = null;      // { secaoIdx, graficoIdx } ou null
var _appInicializada = false;

// ============================================================
// ESTRUTURA PADRÃO (usada quando ainda não há dados no Firestore)
// Administradores podem editar títulos, subtítulos, URLs e layout.
// ============================================================

var ESTRUTURA_PADRAO = [
  {
    id: 'visao-geral',
    titulo: 'Visão Geral',
    icone: '📊',
    descricao: 'Resumo geral de visitantes por período',
    graficos: [
      { id: 'g1', titulo: 'Total de Visitantes — Ano Atual', sub: '', url: '', largura: 'total', altura: 'md' },
      { id: 'g2', titulo: 'Visitantes por Mês', sub: 'Evolução mensal', url: '', largura: 'dois-tercos', altura: 'md' },
      { id: 'g3', titulo: 'Top 5 Nacionalidades', sub: 'Mês atual', url: '', largura: 'metade', altura: 'md' }
    ]
  },
  {
    id: 'nacionalidades',
    titulo: 'Nacionalidades',
    icone: '🌍',
    descricao: 'Distribuição de visitantes por país de origem',
    graficos: [
      { id: 'g4',  titulo: 'Todas as Nacionalidades', sub: 'Ranking completo', url: '', largura: 'total', altura: 'lg' },
      { id: 'g5',  titulo: 'Europa vs Resto do Mundo', sub: '', url: '', largura: 'metade', altura: 'md' },
      { id: 'g6',  titulo: 'Países Ibéricos', sub: 'Portugal e Espanha', url: '', largura: 'metade', altura: 'md' },
      { id: 'g7',  titulo: 'Mercados Emergentes', sub: 'Crescimento ano a ano', url: '', largura: 'total', altura: 'md' }
    ]
  },
  {
    id: 'locais',
    titulo: 'Locais / Postos',
    icone: '📍',
    descricao: 'Análise por local de registo',
    graficos: [
      { id: 'g8',  titulo: 'Visitantes por Local', sub: 'Comparativo', url: '', largura: 'total', altura: 'md' },
      { id: 'g9',  titulo: 'Posto de Turismo de Monsaraz', sub: 'Evolução', url: '', largura: 'metade', altura: 'md' },
      { id: 'g10', titulo: 'Museu do Fresco', sub: 'Evolução', url: '', largura: 'metade', altura: 'md' },
      { id: 'g11', titulo: 'Postos Secundários', sub: 'Comparativo', url: '', largura: 'total', altura: 'md' }
    ]
  },
  {
    id: 'sazonalidade',
    titulo: 'Sazonalidade',
    icone: '📅',
    descricao: 'Padrões sazonais e tendências ao longo do tempo',
    graficos: [
      { id: 'g12', titulo: 'Distribuição Semanal', sub: 'Dia da semana', url: '', largura: 'metade', altura: 'md' },
      { id: 'g13', titulo: 'Meses de Ponta', sub: 'Comparativo histórico', url: '', largura: 'metade', altura: 'md' },
      { id: 'g14', titulo: 'Tendência Anual', sub: 'Crescimento / declínio', url: '', largura: 'total', altura: 'lg' }
    ]
  },
  {
    id: 'operadores',
    titulo: 'Operadores',
    icone: '🏨',
    descricao: 'Visitas provenientes de operadores e agências turísticas',
    graficos: [
      { id: 'g15', titulo: 'Top Operadores', sub: 'Por volume de visitas', url: '', largura: 'dois-tercos', altura: 'md' },
      { id: 'g16', titulo: 'Tipo de Grupo', sub: 'Individual vs Grupo', url: '', largura: 'metade', altura: 'md' },
      { id: 'g17', titulo: 'Operadores por Mercado', sub: '', url: '', largura: 'total', altura: 'md' }
    ]
  }
];

// ============================================================
// ARRANQUE
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  var unsubInicial = firebaseAuth.onAuthStateChanged(function(user) {
    unsubInicial();

    if (user && sessaoValida()) {
      obterPerfilUtilizador()
        .then(function(perfil) {
          _perfilAtual = perfil;
          _isAdmin        = perfil.role === 'administrador';
          _isVisualizador = perfil.role === 'visualizador' || _isAdmin;

          if (!_isVisualizador) {
            // Sem permissão
            document.getElementById('loginOverlay').classList.remove('hidden');
            document.getElementById('loginErro').textContent = 'Acesso negado. Apenas administradores e visualizadores têm acesso ao dashboard.';
            document.getElementById('loginErro').classList.add('visivel');
            apiLogout();
            return;
          }

          activarDashboard(perfil);
        })
        .catch(function() {
          mostrarEcraLogin();
        });
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
          _perfilAtual    = perfil;
          _isAdmin        = perfil.role === 'administrador';
          _isVisualizador = perfil.role === 'visualizador' || _isAdmin;

          if (!perfil.ativo) {
            erro.textContent = 'Esta conta foi desativada. Contacte o administrador.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }
          if (!_isVisualizador) {
            erro.textContent = 'Acesso negado. Apenas administradores e visualizadores têm acesso ao dashboard.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }

          activarDashboard(perfil);
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
  if (!confirm('Deseja terminar a sessão?')) return;
  _appInicializada = false;
  limparCacheUtilizador();
  apiLogout().then(function() { mostrarEcraLogin(); });
}

function mostrarEcraLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('dashboardWrap').style.display = 'none';
  document.getElementById('loginPass').value = '';
}

// ============================================================
// ACTIVAR DASHBOARD
// ============================================================

function activarDashboard(perfil) {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('dashboardWrap').style.display = '';
  document.getElementById('headerNomeFuncionario').textContent =
    perfil.nome || perfil.email || '—';

  // Barra de admin
  if (_isAdmin) {
    document.getElementById('adminBar').classList.add('visivel');
  }

  _appInicializada = true;
  carregarEstrutura();
}

// ============================================================
// CARREGAR / GUARDAR ESTRUTURA NO FIRESTORE
// ============================================================

function carregarEstrutura() {
  db.collection('dashboard').doc('estrutura').get()
    .then(function(doc) {
      if (doc.exists && doc.data().secoes && doc.data().secoes.length) {
        _secoes = doc.data().secoes;
      } else {
        _secoes = JSON.parse(JSON.stringify(ESTRUTURA_PADRAO));
      }
      renderizarDashboard();
    })
    .catch(function(err) {
      console.warn('[Dashboard] Erro ao carregar estrutura, usando padrão:', err);
      _secoes = JSON.parse(JSON.stringify(ESTRUTURA_PADRAO));
      renderizarDashboard();
    });
}

function guardarEstrutura() {
  if (!_isAdmin) return Promise.resolve();
  return db.collection('dashboard').doc('estrutura').set({
    secoes: _secoes,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: (_perfilAtual && _perfilAtual.email) || ''
  }).then(function() {
    mostrarToast('✓ Dashboard guardado.', 'sucesso');
  }).catch(function(err) {
    mostrarToast('Erro ao guardar: ' + err.message, 'erro');
  });
}

// ============================================================
// RENDERIZAR
// ============================================================

function renderizarDashboard() {
  renderizarTabs();
  renderizarPaineis();
  ativarTab(0);
}

function renderizarTabs() {
  var bar = document.getElementById('tabsBar');
  bar.innerHTML = '';

  _secoes.forEach(function(secao, idx) {
    var btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.setAttribute('data-idx', idx);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.innerHTML =
      '<span class="tab-icone">' + esc(secao.icone || '📊') + '</span>' +
      '<span>' + esc(secao.titulo) + '</span>' +
      '<span class="tab-badge">' + (secao.graficos ? secao.graficos.length : 0) + '</span>';
    btn.addEventListener('click', function() { ativarTab(idx); });
    bar.appendChild(btn);
  });
}

function renderizarPaineis() {
  var wrap = document.getElementById('paineis');
  wrap.innerHTML = '';

  _secoes.forEach(function(secao, sIdx) {
    var panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = 'panel-' + sIdx;
    panel.setAttribute('role', 'tabpanel');

    // Cabeçalho da secção
    var header = document.createElement('div');
    header.className = 'secao-header';
    header.innerHTML =
      '<div>' +
        '<div class="secao-titulo">' + esc(secao.icone || '') + ' ' + esc(secao.titulo) + '</div>' +
        (secao.descricao ? '<div class="secao-descricao">' + esc(secao.descricao) + '</div>' : '') +
      '</div>' +
      (_isAdmin ?
        '<div class="secao-meta">' +
          '<button class="btn-iframe-toggle" onclick="abrirEditarSecao(' + sIdx + ')">⚙️ Editar secção</button>' +
          '<button class="btn-iframe-toggle" onclick="adicionarGrafico(' + sIdx + ')">➕ Gráfico</button>' +
        '</div>' : '');
    panel.appendChild(header);

    // Grelha de gráficos
    var grelha = document.createElement('div');
    grelha.className = 'graficos-grelha';

    if (!secao.graficos || secao.graficos.length === 0) {
      grelha.innerHTML =
        '<div class="estado-vazio" style="grid-column:1/-1">' +
          '<span class="estado-vazio-icone">📭</span>' +
          '<div>Nenhum gráfico nesta secção.</div>' +
          (_isAdmin ? '<div style="margin-top:8px"><button class="btn-iframe-toggle" onclick="adicionarGrafico(' + sIdx + ')">➕ Adicionar gráfico</button></div>' : '') +
        '</div>';
    } else {
      secao.graficos.forEach(function(graf, gIdx) {
        grelha.appendChild(criarCardGrafico(graf, sIdx, gIdx));
      });
    }

    panel.appendChild(grelha);
    wrap.appendChild(panel);
  });
}

function criarCardGrafico(graf, sIdx, gIdx) {
  var card = document.createElement('div');
  card.className = 'grafico-card largura-' + (graf.largura || 'metade') + ' altura-' + (graf.altura || 'md');
  card.id = 'card-' + graf.id;

  var acoes = _isAdmin
    ? '<div class="grafico-card-acoes">' +
        '<button class="btn-iframe-toggle" onclick="abrirEditarGrafico(' + sIdx + ',' + gIdx + ')">✏️ Editar</button>' +
        '<button class="btn-iframe-toggle" onclick="removerGrafico(' + sIdx + ',' + gIdx + ')" style="color:var(--vermelho)">✕</button>' +
      '</div>'
    : '';

  var corpo = '';
  if (graf.url && graf.url.trim()) {
    var iframeId = 'iframe-' + graf.id;
    var skelId   = 'skel-' + graf.id;
    corpo =
      '<div class="grafico-card-body">' +
        '<div class="grafico-skeleton" id="' + skelId + '">⏳ A carregar...</div>' +
        '<iframe class="grafico-iframe" id="' + iframeId + '"' +
          ' src="' + escAttr(graf.url) + '"' +
          ' loading="lazy"' +
          ' allowfullscreen' +
          ' onload="ocultarSkeleton(\'' + skelId + '\')">' +
        '</iframe>' +
      '</div>';
  } else {
    corpo =
      '<div class="grafico-card-body">' +
        '<div class="grafico-placeholder">' +
          '<span class="grafico-placeholder-icone">📈</span>' +
          '<span class="grafico-placeholder-txt">Gráfico não configurado</span>' +
          '<span class="grafico-placeholder-sub">' +
            (_isAdmin ? 'Clique em ✏️ Editar para adicionar o URL do iframe' : 'Aguarda configuração pelo administrador') +
          '</span>' +
        '</div>' +
      '</div>';
  }

  card.innerHTML =
    '<div class="grafico-card-header">' +
      '<div>' +
        '<div class="grafico-card-titulo">' + esc(graf.titulo) + '</div>' +
        (graf.sub ? '<div class="grafico-card-sub">' + esc(graf.sub) + '</div>' : '') +
      '</div>' +
      acoes +
    '</div>' +
    corpo;

  return card;
}

function ocultarSkeleton(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('oculto');
}

// ============================================================
// NAVEGAÇÃO POR TABS
// ============================================================

function ativarTab(idx) {
  _tabAtiva = idx;
  var btns   = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');

  btns.forEach(function(b, i) {
    b.classList.toggle('ativa', i === idx);
    b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
  });
  panels.forEach(function(p, i) {
    p.classList.toggle('ativo', i === idx);
  });

  // Scroll suave para o início do painel em mobile
  var wrap = document.getElementById('paineis');
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================
// MODAL DE EDIÇÃO — GRÁFICO
// ============================================================

function abrirEditarGrafico(sIdx, gIdx) {
  var graf = _secoes[sIdx].graficos[gIdx];
  _editandoSecao = { tipo: 'grafico', sIdx: sIdx, gIdx: gIdx };

  document.getElementById('editTitulo').value  = graf.titulo  || '';
  document.getElementById('editSub').value     = graf.sub     || '';
  document.getElementById('editUrl').value     = graf.url     || '';
  document.getElementById('editLargura').value = graf.largura || 'metade';
  document.getElementById('editAltura').value  = graf.altura  || 'md';
  document.getElementById('editBoxTitulo').textContent = 'Editar Gráfico';
  document.getElementById('editOverlay').classList.add('show');
  document.getElementById('editTitulo').focus();
}

function adicionarGrafico(sIdx) {
  _editandoSecao = { tipo: 'grafico', sIdx: sIdx, gIdx: -1 };

  document.getElementById('editTitulo').value  = '';
  document.getElementById('editSub').value     = '';
  document.getElementById('editUrl').value     = '';
  document.getElementById('editLargura').value = 'metade';
  document.getElementById('editAltura').value  = 'md';
  document.getElementById('editBoxTitulo').textContent = 'Novo Gráfico';
  document.getElementById('editOverlay').classList.add('show');
  document.getElementById('editTitulo').focus();
}

function guardarEdicaoGrafico() {
  if (!_editandoSecao || _editandoSecao.tipo !== 'grafico') return;

  var titulo  = document.getElementById('editTitulo').value.trim();
  var sub     = document.getElementById('editSub').value.trim();
  var url     = document.getElementById('editUrl').value.trim();
  var largura = document.getElementById('editLargura').value;
  var altura  = document.getElementById('editAltura').value;

  if (!titulo) { mostrarToast('O título é obrigatório.', 'erro'); return; }

  var sIdx = _editandoSecao.sIdx;
  var gIdx = _editandoSecao.gIdx;

  if (gIdx === -1) {
    // Novo
    var novoId = 'g' + Date.now();
    _secoes[sIdx].graficos.push({ id: novoId, titulo: titulo, sub: sub, url: url, largura: largura, altura: altura });
  } else {
    // Editar
    var g = _secoes[sIdx].graficos[gIdx];
    g.titulo  = titulo;
    g.sub     = sub;
    g.url     = url;
    g.largura = largura;
    g.altura  = altura;
  }

  fecharEditOverlay();
  guardarEstrutura().then(function() {
    renderizarDashboard();
  });
}

function removerGrafico(sIdx, gIdx) {
  var graf = _secoes[sIdx].graficos[gIdx];
  if (!confirm('Remover o gráfico "' + graf.titulo + '"?')) return;
  _secoes[sIdx].graficos.splice(gIdx, 1);
  guardarEstrutura().then(function() { renderizarDashboard(); });
}

// ============================================================
// MODAL DE EDIÇÃO — SECÇÃO
// ============================================================

function abrirEditarSecao(sIdx) {
  var s = _secoes[sIdx];
  _editandoSecao = { tipo: 'secao', sIdx: sIdx };

  document.getElementById('editTitulo').value  = s.titulo   || '';
  document.getElementById('editSub').value     = s.icone    || '';
  document.getElementById('editUrl').value     = s.descricao || '';
  document.getElementById('editLargura').value = 'metade'; // irrelevante para secção
  document.getElementById('editAltura').value  = 'md';

  // Ajustar labels
  document.getElementById('editBoxTitulo').textContent    = 'Editar Secção';
  document.getElementById('editLabelTitulo').textContent  = 'Título da Secção';
  document.getElementById('editLabelSub').textContent     = 'Ícone (emoji)';
  document.getElementById('editLabelUrl').textContent     = 'Descrição';
  document.getElementById('editGrupoLargura').style.display = 'none';
  document.getElementById('editGrupoAltura').style.display  = 'none';
  document.getElementById('editGrupoUrl').querySelector('textarea, input').setAttribute('placeholder', 'Descrição da secção...');

  document.getElementById('editOverlay').classList.add('show');
  document.getElementById('editTitulo').focus();
}

function guardarEdicaoSecao() {
  var sIdx = _editandoSecao.sIdx;
  var titulo = document.getElementById('editTitulo').value.trim();
  if (!titulo) { mostrarToast('O título é obrigatório.', 'erro'); return; }

  _secoes[sIdx].titulo    = titulo;
  _secoes[sIdx].icone     = document.getElementById('editSub').value.trim() || '📊';
  _secoes[sIdx].descricao = document.getElementById('editUrl').value.trim();

  fecharEditOverlay();
  guardarEstrutura().then(function() { renderizarDashboard(); });
}

function fecharEditOverlay() {
  document.getElementById('editOverlay').classList.remove('show');
  _editandoSecao = null;
  // Restaurar labels padrão
  document.getElementById('editLabelTitulo').textContent  = 'Título';
  document.getElementById('editLabelSub').textContent     = 'Subtítulo';
  document.getElementById('editLabelUrl').textContent     = 'URL do iframe (Google Sheets)';
  document.getElementById('editGrupoLargura').style.display = '';
  document.getElementById('editGrupoAltura').style.display  = '';
}

function guardarEdicao() {
  if (!_editandoSecao) return;
  if (_editandoSecao.tipo === 'secao') {
    guardarEdicaoSecao();
  } else {
    guardarEdicaoGrafico();
  }
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function voltarParaApp() {
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

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function mostrarToast(msg, tipo) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + tipo + ' show';
  setTimeout(function() { t.classList.remove('show'); }, 3800);
}

// Fechar overlay ao clicar fora
document.addEventListener('DOMContentLoaded', function() {
  var overlay = document.getElementById('editOverlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) fecharEditOverlay();
    });
  }
  // Enter no form de edição
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') fecharEditOverlay();
  });
});
