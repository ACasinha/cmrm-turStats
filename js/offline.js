// ============================================================
// offline.js — Detecção de ligação, reconexão e geração de PDF
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var _tentativasReconectar   = 0;
var _ultimaJanelaReconectar = 0;
var JANELA_RECONECTAR_MS    = 2 * 60 * 1000;
var MAX_TENTATIVAS_JANELA   = 5;
var _estavaSemLigacao       = false;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  verificarLigacao();
  window.addEventListener('online',  function() { verificarLigacao(); });
  window.addEventListener('offline', function() { verificarLigacao(); });
});

// ============================================================
// VERIFICAR LIGAÇÃO
// ============================================================

function verificarLigacao() {
  var online = navigator.onLine;
  var banner = document.getElementById('offlineBanner');
  if (!banner) return;

  if (!online) {
    _estavaSemLigacao    = true;
    banner.style.display = 'flex';
    var btnG = document.getElementById('btnGuardar');
    if (btnG) btnG.disabled = true;
    if (typeof bloquearFormulario === 'function') bloquearFormulario(true);
    if (typeof mostrarToast === 'function') mostrarToast('Sem ligação à Internet.', 'erro');
  } else if (_estavaSemLigacao) {
    _estavaSemLigacao    = false;
    banner.style.display = 'none';
    var btnG = document.getElementById('btnGuardar');
    if (btnG) btnG.disabled = false;
    if (typeof bloquearFormulario === 'function') bloquearFormulario(false);
    resetarBotaoReconectar();
    if (typeof mostrarToast === 'function') mostrarToast('Ligação restabelecida.', 'sucesso');
  }
}

// ============================================================
// RECONEXÃO (anti-abuso)
// ============================================================

function tentarReconectar() {
  var agora = Date.now();
  if (agora - _ultimaJanelaReconectar > JANELA_RECONECTAR_MS) {
    _tentativasReconectar   = 0;
    _ultimaJanelaReconectar = agora;
  }
  if (_tentativasReconectar >= MAX_TENTATIVAS_JANELA) {
    var seg = Math.ceil((JANELA_RECONECTAR_MS - (agora - _ultimaJanelaReconectar)) / 1000);
    if (typeof mostrarToast === 'function') mostrarToast('Aguarde ' + seg + 's antes de tentar novamente.', 'info');
    return;
  }
  _tentativasReconectar++;
  var btn = document.getElementById('btnReconectar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A verificar...'; }

  fetch(window.location.origin + '/manifest.json', { cache: 'no-store', mode: 'no-cors' })
    .then(function() {
      verificarLigacao();
      if (!navigator.onLine) {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 Verificar ligação'; }
        var r = MAX_TENTATIVAS_JANELA - _tentativasReconectar;
        if (typeof mostrarToast === 'function')
          mostrarToast('Ainda sem ligação.' + (r > 0 ? ' ' + r + ' tentativa(s) restante(s).' : ''), 'erro');
      } else {
        resetarBotaoReconectar();
      }
    })
    .catch(function() {
      verificarLigacao();
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Verificar ligação'; }
    });
}

function resetarBotaoReconectar() {
  var btn = document.getElementById('btnReconectar');
  if (btn) { btn.disabled = false; btn.textContent = '🔄 Verificar ligação'; }
  _tentativasReconectar = 0;
}

// ============================================================
// MODAL DE ESCOLHA DE PDF
// ============================================================

function mostrarModalPDF() {
  var modal = document.getElementById('modalEscolhaPDF');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'modalEscolhaPDF';
    modal.className = 'modal-pdf-overlay';
    modal.innerHTML =
      '<div class="modal-pdf-caixa">' +
        '<div class="modal-pdf-titulo">📄 Gerar Formulário PDF</div>' +
        '<div class="modal-pdf-sub">Escolha o tipo de formulário a gerar:</div>' +
        '<div class="modal-pdf-opcoes">' +
          '<button class="btn-pdf-opcao" onclick="gerarPDF(\'paises\');fecharModalPDF()">' +
            '<span class="pdf-opcao-icone">🌍</span>' +
            '<span class="pdf-opcao-titulo">Lista de Países</span>' +
            '<span class="pdf-opcao-desc">Formulário com todos os países<br>para registar visitantes por país</span>' +
          '</button>' +
          '<button class="btn-pdf-opcao" onclick="gerarPDF(\'simples\');fecharModalPDF()">' +
            '<span class="pdf-opcao-icone">🏠</span>' +
            '<span class="pdf-opcao-titulo">Nacionais / Estrangeiros</span>' +
            '<span class="pdf-opcao-desc">Formulário simplificado<br>apenas com Nacionais e Estrangeiros</span>' +
          '</button>' +
        '</div>' +
        '<button class="btn-pdf-fechar" onclick="fecharModalPDF()">Cancelar</button>' +
      '</div>';
    modal.addEventListener('click', function(e) {
      if (e.target === modal) fecharModalPDF();
    });
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
}

function fecharModalPDF() {
  var modal = document.getElementById('modalEscolhaPDF');
  if (modal) modal.style.display = 'none';
}

// ============================================================
// GERAÇÃO DE PDF — jsPDF + AutoTable
// CDN carregado no index.html
// ============================================================

function gerarPDF(tipo) {
  var doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var COR_PRINCIPAL = [139, 74, 43];   // #8B4A2B
  var COR_CLARO     = [245, 235, 224]; // #F5EBE0
  var COR_TEXTO     = [44, 44, 44];
  var COR_DESTAQUE  = [255, 252, 245]; // fundo suave para Portugal/Espanha
  var MARGEM        = 12;
  var LARGURA       = 210 - MARGEM * 2;
  var y             = MARGEM;

  // ── Cabeçalho ──────────────────────────────────────────────
  function cabecalho(numPag) {
    doc.setFillColor.apply(doc, COR_PRINCIPAL);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Registo Diario de Nacionalidades', MARGEM, 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Municipio de Reguengos de Monsaraz  \u00b7  Servicos de Turismo', MARGEM, 12);
    if (numPag) {
      doc.text('Pag. ' + numPag, 210 - MARGEM, 12, { align: 'right' });
    }
    doc.setTextColor.apply(doc, COR_TEXTO);
    return 23;
  }

  // ── Campos Local / Data ─────────────────────────────────────
  function camposLocalData(yPos) {
    doc.setFillColor.apply(doc, COR_CLARO);
    doc.roundedRect(MARGEM, yPos, LARGURA, 9, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COR_PRINCIPAL);
    doc.text('LOCAL / POSTO:', MARGEM + 2, yPos + 3.5);
    doc.text('DATA:', MARGEM + 100, yPos + 3.5);
    doc.setDrawColor.apply(doc, COR_PRINCIPAL);
    doc.setLineWidth(0.3);
    doc.line(MARGEM + 28, yPos + 6.5, MARGEM + 95, yPos + 6.5);
    doc.line(MARGEM + 110, yPos + 6.5, MARGEM + 140, yPos + 6.5);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return yPos + 13;
  }

  // ── Rodapé ──────────────────────────────────────────────────
  function rodape(numPag, total) {
    var yR = 297 - 10;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(MARGEM, yR, 210 - MARGEM, yR);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Registo Diario de Nacionalidades  \u00b7  Municipio de Reguengos de Monsaraz', MARGEM, yR + 3.5);
    if (total !== undefined) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor.apply(doc, COR_PRINCIPAL);
      doc.text('Total: ' + total, 210 - MARGEM, yR + 3.5, { align: 'right' });
    }
    doc.setTextColor.apply(doc, COR_TEXTO);
  }

  // ── Assinatura ──────────────────────────────────────────────
  function assinatura(yPos) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COR_PRINCIPAL);
    doc.text('Assinatura do(a) Funcionario(a):', MARGEM, yPos);
    doc.text('Data:', MARGEM + 120, yPos);
    doc.setDrawColor.apply(doc, COR_PRINCIPAL);
    doc.setLineWidth(0.4);
    doc.line(MARGEM, yPos + 7, MARGEM + 112, yPos + 7);
    doc.line(MARGEM + 124, yPos + 7, MARGEM + 152, yPos + 7);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return yPos + 12;
  }

  // ── Aviso final ─────────────────────────────────────────────
  function avisoFinal(yPos) {
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(192, 57, 43);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGEM, yPos, LARGURA, 8, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(192, 57, 43);
    doc.text('IMPORTANTE: Apos restabelecimento da Internet inserir dados na aplicacao.', MARGEM + 3, yPos + 5);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return yPos + 11;
  }

  // ── Recolher dados dos operadores ───────────────────────────
  function dadosOperadores() {
    var rows = [];
    document.querySelectorAll('#tabelaOperadores tr').forEach(function(tr) {
      var nome = (tr.querySelector('.op-nome') || {}).value || '';
      var tot  = (tr.querySelector('.op-total') || {}).value || '';
      var nacs = [];
      tr.querySelectorAll('.op-nac-linha').forEach(function(l) {
        var p = (l.querySelector('.op-nac-select') || {}).value || '';
        var n = parseInt((l.querySelector('.op-nac-num') || {}).value, 10) || 0;
        if (p && n > 0) nacs.push(p + ': ' + n);
      });
      if (nome) rows.push([nome, nacs.join(', '), tot || '0']);
    });
    while (rows.length < 5) rows.push(['', '', '']);
    return rows;
  }

  // ── Recolher dados das sugestões ────────────────────────────
  function dadosSugestoes() {
    var rows = [];
    document.querySelectorAll('#tabelaSugestoes tr').forEach(function(tr) {
      var txt = (tr.querySelector('.sug-texto') || {}).value || '';
      var nac = (tr.querySelector('.sug-nac') || {}).value   || '';
      if (txt) rows.push([txt, nac]);
    });
    while (rows.length < 5) rows.push(['', '']);
    return rows;
  }

  var obs = (document.getElementById('observacoes') || {}).value || '';

  // ── Estilo base ─────────────────────────────────────────────
  var estiloBase = {
    theme: 'grid',
    styles: {
      fontSize: 8, cellPadding: 2,
      textColor: COR_TEXTO, lineColor: [220, 210, 200], lineWidth: 0.2
    },
    headStyles: {
      fillColor: COR_PRINCIPAL, textColor: [255,255,255],
      fontStyle: 'bold', fontSize: 8, cellPadding: 2.5
    },
    alternateRowStyles: { fillColor: [250, 245, 239] },
    margin: { left: MARGEM, right: MARGEM },
  };

  // ===========================================================
  // MODO PAÍSES — tabela com 3 colunas e multi-linhas por país
  // ===========================================================
  if (tipo === 'paises') {

    y = cabecalho(1);
    y = camposLocalData(y);

    // ── Recolher valores actuais da tabela ───────────────────
    var valoresPaises = {};
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      valoresPaises[inp.dataset.pais] = parseInt(inp.value, 10) || 0;
    });

    // ── Lista de países com configuração de sub-linhas ───────
    //   subLinhas: nº de caixas de registo na coluna central
    //   Portugal → 3 sub-linhas, Espanha → 2, restantes → 1
    var listaPDF = [
      { nome: 'Portugal',           subLinhas: 3 },
      { nome: 'Espanha',            subLinhas: 2 },
      { nome: 'Africa do Sul',      subLinhas: 1 },
      { nome: 'Albania',            subLinhas: 1 },
      { nome: 'Alemanha',           subLinhas: 1 },
      { nome: 'Angola',             subLinhas: 1 },
      { nome: 'Argentina',          subLinhas: 1 },
      { nome: 'Australia',          subLinhas: 1 },
      { nome: 'Austria',            subLinhas: 1 },
      { nome: 'Belgica',            subLinhas: 1 },
      { nome: 'Bosnia Herzegovina', subLinhas: 1 },
      { nome: 'Brasil',             subLinhas: 1 },
      { nome: 'Canada',             subLinhas: 1 },
      { nome: 'Chile',              subLinhas: 1 },
      { nome: 'China',              subLinhas: 1 },
      { nome: 'Chipre',             subLinhas: 1 },
      { nome: 'Colombia',           subLinhas: 1 },
      { nome: 'Coreia do Sul',      subLinhas: 1 },
      { nome: 'Croatia',            subLinhas: 1 },
      { nome: 'Dinamarca',          subLinhas: 1 },
      { nome: 'Eslovenia',          subLinhas: 1 },
      { nome: 'Estonia',            subLinhas: 1 },
      { nome: 'EUA',                subLinhas: 1 },
      { nome: 'Finlandia',          subLinhas: 1 },
      { nome: 'Franca',             subLinhas: 1 },
      { nome: 'Grecia',             subLinhas: 1 },
      { nome: 'Holanda',            subLinhas: 1 },
      { nome: 'Hungria',            subLinhas: 1 },
      { nome: 'India',              subLinhas: 1 },
      { nome: 'Inglaterra',         subLinhas: 1 },
      { nome: 'Irlanda',            subLinhas: 1 },
      { nome: 'Islandia',           subLinhas: 1 },
      { nome: 'Israel',             subLinhas: 1 },
      { nome: 'Italia',             subLinhas: 1 },
      { nome: 'Japao',              subLinhas: 1 },
      { nome: 'Letonia',            subLinhas: 1 },
      { nome: 'Lituania',           subLinhas: 1 },
      { nome: 'Luxemburgo',         subLinhas: 1 },
      { nome: 'Mexico',             subLinhas: 1 },
      { nome: 'Moldavia',           subLinhas: 1 },
      { nome: 'Monaco',             subLinhas: 1 },
      { nome: 'Noruega',            subLinhas: 1 },
      { nome: 'Nova Zelandia',      subLinhas: 1 },
      { nome: 'Polonia',            subLinhas: 1 },
      { nome: 'Republica Checa',    subLinhas: 1 },
      { nome: 'Romania',            subLinhas: 1 },
      { nome: 'Russia',             subLinhas: 1 },
      { nome: 'Singapura',          subLinhas: 1 },
      { nome: 'Suecia',             subLinhas: 1 },
      { nome: 'Suica',              subLinhas: 1 },
      { nome: 'Ucrania',            subLinhas: 1 },
      { nome: 'Venezuela',          subLinhas: 1 },
      { nome: 'Outros Paises',      subLinhas: 1 },
    ];

    // ── Mapear nomes do data.js → nomes sem diacríticos ─────
    // (os valores já registados vêm com diacríticos do data.js)
    var mapaOriginal = {
      'Africa do Sul':   'África do Sul',
      'Albania':         'Albânia',
      'Austria':         'Áustria',
      'Belgica':         'Bélgica',
      'Bosnia Herzegovina': 'Bósnia Herzegovina',
      'Canada':          'Canadá',
      'Colombia':        'Colômbia',
      'Croatia':         'Croácia',
      'Eslovenia':       'Eslovénia',
      'Estonia':         'Estónia',
      'Finlandia':       'Finlândia',
      'Franca':          'França',
      'Grecia':          'Grécia',
      'India':           'Índia',
      'Islandia':        'Islândia',
      'Italia':          'Itália',
      'Japao':           'Japão',
      'Letonia':         'Letónia',
      'Lituania':        'Lituânia',
      'Mexico':          'México',
      'Moldavia':        'Moldávia',
      'Monaco':          'Mónaco',
      'Nova Zelandia':   'Nova Zelândia',
      'Polonia':         'Polónia',
      'Republica Checa': 'República Checa',
      'Romania':         'Roménia',
      'Russia':          'Rússia',
      'Suecia':          'Suécia',
      'Suica':           'Suíça',
      'Ucrania':         'Ucrânia',
      'Outros Paises':   'Outros Países',
      'Australia':       'Austrália',
      'Colombia':        'Colômbia',
    };

    // ── Construir body com sub-linhas emuladas ───────────────
    //
    // Estrutura de cada linha no body:
    //   col 0 — nome do país  (apenas na 1ª sub-linha do grupo)
    //   col 1 — célula de contagem vazia (para o funcionário preencher)
    //           pré-preenchida com o valor digital se existir
    //   col 2 — total digital  (apenas na 1ª sub-linha do grupo)
    //
    // Metadados para o rowSpan emulado:
    //   _grupo    : índice do grupo (país)
    //   _subIdx   : índice dentro do grupo (0, 1, 2…)
    //   _subTotal : total de sub-linhas deste grupo
    //   _destaque : true para Portugal e Espanha

    var bodyRows   = [];   // linhas para o autoTable
    var metaDados  = [];   // metadados paralelos (por linha)
    var totalGeral = 0;

    listaPDF.forEach(function(pais, grupoIdx) {
      var nomeOriginal = mapaOriginal[pais.nome] || pais.nome;
      var valor = valoresPaises[nomeOriginal] || 0;
      totalGeral += valor;
      var destaque = (pais.nome === 'Portugal' || pais.nome === 'Espanha');

      for (var s = 0; s < pais.subLinhas; s++) {
        var primaria = (s === 0);
        // col 0: nome só na linha primária
        // col 1: valor digital na linha primária se existir; vazio nas seguintes
        // col 2: total só na linha primária
        bodyRows.push([
          primaria ? pais.nome : '',
          (primaria && valor > 0) ? String(valor) : '',
          primaria ? (valor > 0 ? String(valor) : '') : ''
        ]);
        metaDados.push({
          grupoIdx:  grupoIdx,
          subIdx:    s,
          subTotal:  pais.subLinhas,
          primaria:  primaria,
          destaque:  destaque,
          ultimaSub: (s === pais.subLinhas - 1)
        });
      }
    });

    // ── Larguras das colunas ─────────────────────────────────
    // Col 0 (País): fixo 52mm — acomoda "Bosnia Herzegovina" a 7.5pt
    // Col 2 (Total): 20mm
    // Col 1 (Turistas): ocupa o resto = 186 - 52 - 20 = 114mm
    var COL_PAIS   = 52;
    var COL_TOTAL  = 20;
    var COL_VISIT  = LARGURA - COL_PAIS - COL_TOTAL;  // ~114mm

    // Altura de cada sub-linha em mm (para cálculos de rowSpan visual)
    var ALTURA_LINHA = 5.5;

    // Mapa de { grupoIdx → y de início da primeira sub-linha }
    // preenchido em didDrawCell
    var grupoYInicio = {};

    doc.autoTable({
      theme: 'grid',
      startY: y,
      head: [['Pais / Regiao de Origem', 'Turistas / Visitantes', 'Total']],
      body: bodyRows,
      foot: [['TOTAL', '', totalGeral > 0 ? String(totalGeral) : '']],

      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
        textColor: COR_TEXTO,
        lineColor: [220, 210, 200],
        lineWidth: 0.2,
        valign: 'middle',
      },
      headStyles: {
        fillColor: COR_PRINCIPAL,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2.5,
        halign: 'center',
      },
      footStyles: {
        fillColor: COR_CLARO,
        textColor: COR_PRINCIPAL,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: false },  // desactivar zebra — gerida manualmente
      margin: { left: MARGEM, right: MARGEM },

      columnStyles: {
        0: { cellWidth: COL_PAIS,  fontStyle: 'normal' },
        1: { cellWidth: COL_VISIT, halign: 'center' },
        2: { cellWidth: COL_TOTAL, halign: 'right'  },
      },

      // ── Estilo por célula ──────────────────────────────────
      didParseCell: function(data) {
        if (data.section !== 'body') return;
        var meta = metaDados[data.row.index];
        if (!meta) return;

        // Fundo: alternância por grupo (não por linha individual)
        var fundoPar   = [250, 245, 239];
        var fundoImpar = [255, 255, 255];
        var fundoBase  = (meta.grupoIdx % 2 === 0) ? fundoPar : fundoImpar;

        // Países de destaque têm fundo e texto especiais
        if (meta.destaque) {
          data.cell.styles.fillColor   = COR_DESTAQUE;
          data.cell.styles.fontStyle   = (data.column.index === 0 && meta.primaria) ? 'bold' : 'normal';
          data.cell.styles.textColor   = (data.column.index === 0 && meta.primaria) ? COR_PRINCIPAL : COR_TEXTO;
        } else {
          data.cell.styles.fillColor = fundoBase;
        }

        // Col 0 — sub-linhas secundárias: sem texto, sem borda superior
        if (data.column.index === 0 && !meta.primaria) {
          data.cell.styles.lineColor = [255, 255, 255]; // borda invisível
        }

        // Col 2 — sub-linhas secundárias: sem texto, borda lateral invisível
        if (data.column.index === 2 && !meta.primaria) {
          data.cell.styles.lineColor = [255, 255, 255];
        }

        // Sub-linhas secundárias na col 1: borda superior a tracejado suave
        if (data.column.index === 1 && !meta.primaria) {
          // manter linha tênue para separar as caixas de registo
          data.cell.styles.lineColor = [200, 195, 190];
          data.cell.styles.lineWidth = 0.15;
        }
      },

      // ── Desenho custom após cada célula ───────────────────
      didDrawCell: function(data) {
        if (data.section !== 'body') return;
        var meta = metaDados[data.row.index];
        if (!meta) return;

        var x  = data.cell.x;
        var cy = data.cell.y;
        var w  = data.cell.width;
        var h  = data.cell.height;

        // Registar y de início do grupo (primeira sub-linha)
        if (meta.primaria) {
          grupoYInicio[meta.grupoIdx] = cy;
        }

        // ── Col 2 (Total) — span visual ──────────────────────
        // Na sub-linha primária de um grupo multi-linha:
        //   1. Cobrir toda a altura do grupo com fill da cor de fundo
        //   2. Redesenhar a borda exterior
        //   3. Escrever o valor centrado verticalmente
        if (data.column.index === 2 && meta.primaria && meta.subTotal > 1) {
          var alturaGrupo = h * meta.subTotal;
          var yInicio     = cy;

          // 1. Fill de fundo (cobre sub-linhas seguintes da mesma coluna)
          var corFundo = meta.destaque ? COR_DESTAQUE : ((meta.grupoIdx % 2 === 0) ? [250,245,239] : [255,255,255]);
          doc.setFillColor.apply(doc, corFundo);
          doc.rect(x, yInicio, w, alturaGrupo, 'F');

          // 2. Borda exterior da célula agrupada
          doc.setDrawColor.apply(doc, [220, 210, 200]);
          doc.setLineWidth(0.2);
          doc.rect(x, yInicio, w, alturaGrupo, 'S');

          // 3. Texto do total centrado verticalmente no grupo
          var valorTxt = data.cell.text ? data.cell.text.join('') : '';
          if (valorTxt) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor.apply(doc, COR_TEXTO);
            doc.text(
              valorTxt,
              x + w - 2,
              yInicio + alturaGrupo / 2 + 0.6,
              { align: 'right', baseline: 'middle' }
            );
          }
        }

        // ── Col 0 (País) — span visual ───────────────────────
        // Idem: cobrir sub-linhas com fill e escrever o nome centrado
        if (data.column.index === 0 && meta.primaria && meta.subTotal > 1) {
          var alturaGrupo0 = h * meta.subTotal;
          var corFundo0    = meta.destaque ? COR_DESTAQUE : ((meta.grupoIdx % 2 === 0) ? [250,245,239] : [255,255,255]);

          // Fill
          doc.setFillColor.apply(doc, corFundo0);
          doc.rect(x, cy, w, alturaGrupo0, 'F');

          // Borda
          doc.setDrawColor.apply(doc, [220, 210, 200]);
          doc.setLineWidth(0.2);
          doc.rect(x, cy, w, alturaGrupo0, 'S');

          // Texto
          var nomeTxt = data.cell.text ? data.cell.text.join('') : '';
          if (nomeTxt) {
            doc.setFont('helvetica', meta.destaque ? 'bold' : 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor.apply(doc, meta.destaque ? COR_PRINCIPAL : COR_TEXTO);
            doc.text(
              nomeTxt,
              x + 2,
              cy + alturaGrupo0 / 2 + 0.6,
              { align: 'left', baseline: 'middle' }
            );
          }
        }

        // ── Col 1 (Turistas / Visitantes) — caixas de registo ─
        // Desenhar linhas divisórias entre sub-linhas dentro da célula
        // para que o funcionário saiba onde escrever cada contagem
        if (data.column.index === 1) {
          // Na última sub-linha de um grupo multi-linha, desenhar separador
          // de grupo mais espesso (visível) entre este grupo e o próximo
          if (meta.ultimaSub && meta.subTotal > 1) {
            doc.setDrawColor.apply(doc, [139, 74, 43]);
            doc.setLineWidth(0.35);
            doc.line(x, cy + h, x + w, cy + h);
          }
          // Caixa de registo (área ligeiramente destacada para escrita manual)
          // Só para células vazias (sem valor digital)
          var valDigital = data.cell.text ? data.cell.text.join('').trim() : '';
          if (!valDigital) {
            // Fundo levemente mais claro para indicar área de escrita
            doc.setFillColor(248, 244, 240);
            var padding = 0.8;
            doc.rect(x + padding, cy + padding, w - padding * 2, h - padding * 2, 'F');
          }
        }
      },
    });

    var totalPaisesY = doc.lastAutoTable.finalY;
    rodape(1, totalGeral > 0 ? totalGeral : '—');

    // ── Página 2 — Operadores, Sugestões, Observações ────────
    doc.addPage();
    y = cabecalho(2);

    var ops  = dadosOperadores();
    var sugs = dadosSugestoes();

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Operador / Agencia', 'Nacionalidades', 'Total']],
      body: ops.length ? ops : [['', '', '']],
      columnStyles: { 0: { cellWidth: 55 }, 2: { cellWidth: 18, halign: 'right' } },
    }));
    y = doc.lastAutoTable.finalY + 5;

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Sugestao / Critica', 'Nacionalidade']],
      body: sugs.length ? sugs : [['', '']],
      columnStyles: { 1: { cellWidth: 38 } },
    }));
    y = doc.lastAutoTable.finalY + 5;

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Outras Observacoes']],
      body: [[obs || '']],
      styles: Object.assign({}, estiloBase.styles, { minCellHeight: 12 }),
    }));
    y = doc.lastAutoTable.finalY + 8;

    y = assinatura(y);
    avisoFinal(y);
    rodape(2);

  // ===========================================================
  // MODO SIMPLES — 1 página
  // ===========================================================
  } else {
    y = cabecalho();
    y = camposLocalData(y);

    var vNac = 0, vEst = 0;
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      if (inp.dataset.pais === 'Nacionais')    vNac = parseInt(inp.value, 10) || 0;
      if (inp.dataset.pais === 'Estrangeiros') vEst = parseInt(inp.value, 10) || 0;
    });
    var totalSimples = vNac + vEst;

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Tipo de Visitante', 'Numero']],
      body: [
        ['Nacionais',    vNac > 0 ? String(vNac) : ''],
        ['Estrangeiros', vEst > 0 ? String(vEst) : ''],
      ],
      foot: [['TOTAL', totalSimples > 0 ? String(totalSimples) : '']],
      footStyles: { fillColor: COR_CLARO, textColor: COR_PRINCIPAL, fontStyle: 'bold', fontSize: 9 },
      styles: Object.assign({}, estiloBase.styles, { fontSize: 11, cellPadding: 5 }),
      headStyles: Object.assign({}, estiloBase.headStyles, { fontSize: 10 }),
      columnStyles: { 1: { cellWidth: 30, halign: 'right' } },
    }));
    y = doc.lastAutoTable.finalY + 5;

    var ops  = dadosOperadores();
    var sugs = dadosSugestoes();

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Operador / Agencia', 'Nacionalidades', 'Total']],
      body: ops.length ? ops : [['', '', '']],
      columnStyles: { 0: { cellWidth: 55 }, 2: { cellWidth: 18, halign: 'right' } },
    }));
    y = doc.lastAutoTable.finalY + 5;

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Sugestao / Critica', 'Nacionalidade']],
      body: sugs.length ? sugs : [['', '']],
      columnStyles: { 1: { cellWidth: 38 } },
    }));
    y = doc.lastAutoTable.finalY + 5;

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Outras Observacoes']],
      body: [[obs || '']],
      styles: Object.assign({}, estiloBase.styles, { minCellHeight: 12 }),
    }));
    y = doc.lastAutoTable.finalY + 8;

    y = assinatura(y);
    avisoFinal(y);
    rodape();
  }

  // ── Guardar / descarregar ────────────────────────────────────
  var dataHoje = new Date().toISOString().slice(0, 10);
  var nome = 'Registo-Nacionalidades-' + tipo + '-' + dataHoje + '.pdf';
  doc.save(nome);
}

function imprimirPDF() { mostrarModalPDF(); }
