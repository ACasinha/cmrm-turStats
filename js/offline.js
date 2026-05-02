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
  // Criar modal se não existir
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
    doc.text('Municipio de Reguengos de Monsaraz  ·  Servicos de Turismo', MARGEM, 12);
    if (numPag) {
      doc.text('Pag. ' + numPag, 210 - MARGEM, 12, { align: 'right' });
    }
    doc.setTextColor.apply(doc, COR_TEXTO);
    return 23;
  }

  // ── Campos Local / Data ─────────────────────────────────────
  function camposLocalData(y) {
    doc.setFillColor.apply(doc, COR_CLARO);
    doc.roundedRect(MARGEM, y, LARGURA, 9, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COR_PRINCIPAL);
    doc.text('LOCAL / POSTO:', MARGEM + 2, y + 3.5);
    doc.text('DATA:', MARGEM + 100, y + 3.5);
    doc.setDrawColor.apply(doc, COR_PRINCIPAL);
    doc.setLineWidth(0.3);
    doc.line(MARGEM + 28, y + 6.5, MARGEM + 95, y + 6.5);
    doc.line(MARGEM + 110, y + 6.5, MARGEM + 140, y + 6.5);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return y + 13;
  }

  // ── Título de secção ────────────────────────────────────────
  function tituloSecao(y, texto) {
    doc.setFillColor.apply(doc, COR_PRINCIPAL);
    doc.rect(MARGEM, y, LARGURA, 5.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(texto, MARGEM + 2, y + 3.8);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return y + 5.5;
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
    doc.text('Registo Diario de Nacionalidades  ·  Municipio de Reguengos de Monsaraz', MARGEM, yR + 3.5);
    if (total !== undefined) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor.apply(doc, COR_PRINCIPAL);
      doc.text('Total: ' + total, 210 - MARGEM, yR + 3.5, { align: 'right' });
    }
    doc.setTextColor.apply(doc, COR_TEXTO);
  }

  // ── Assinatura ──────────────────────────────────────────────
  function assinatura(y) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor.apply(doc, COR_PRINCIPAL);
    doc.text('Assinatura do(a) Funcionario(a):', MARGEM, y);
    doc.text('Data:', MARGEM + 120, y);
    doc.setDrawColor.apply(doc, COR_PRINCIPAL);
    doc.setLineWidth(0.4);
    doc.line(MARGEM, y + 7, MARGEM + 112, y + 7);
    doc.line(MARGEM + 124, y + 7, MARGEM + 152, y + 7);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return y + 12;
  }

  // ── Aviso final ─────────────────────────────────────────────
  function avisoFinal(y) {
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(192, 57, 43);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGEM, y, LARGURA, 8, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(192, 57, 43);
    doc.text('⚠  Apos restabelecimento da Internet inserir dados na aplicacao.', MARGEM + 3, y + 5);
    doc.setTextColor.apply(doc, COR_TEXTO);
    return y + 11;
  }

  // ── Recolher dados da página ─────────────────────────────────
  function dadosPaises() {
    var rows = [];
    document.querySelectorAll('#tabelaPaises tr').forEach(function(tr) {
      var inp = tr.querySelector('.pais-input');
      if (!inp) return;
      rows.push([inp.dataset.pais || '', parseInt(inp.value, 10) || 0]);
    });
    return rows;
  }

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

  // ── Estilo base para tabelas autoTable ───────────────────────
  var estiloBase = {
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: COR_TEXTO, lineColor: [220, 210, 200], lineWidth: 0.2 },
    headStyles: { fillColor: COR_PRINCIPAL, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [250, 245, 239] },
    margin: { left: MARGEM, right: MARGEM },
  };

  // ===========================================================
  // MODO PAÍSES — 2 páginas
  // ===========================================================
  if (tipo === 'paises') {
    // Página 1 — tabela de países
    y = cabecalho(1);
    y = camposLocalData(y);

    var paises = dadosPaises();
    var totalPaises = paises.reduce(function(s, r) { return s + r[1]; }, 0);

    doc.autoTable(Object.assign({}, estiloBase, {
      startY: y,
      head: [['Pais / Regiao de Origem', 'Visitantes']],
      body: paises.map(function(r) { return [r[0], r[1] > 0 ? r[1] : '']; }),
      foot: [['TOTAL', totalPaises > 0 ? totalPaises : '']],
      footStyles: { fillColor: COR_CLARO, textColor: COR_PRINCIPAL, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 22, halign: 'right' }
      },
      styles: Object.assign({}, estiloBase.styles, { fontSize: 7.5, cellPadding: 0.7 }),
      headStyles: Object.assign({}, estiloBase.headStyles, { fontSize: 8 }),
      didParseCell: function(data) {
        if (data.section === 'body' && (data.row.index === 0 || data.row.index === 1)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = COR_PRINCIPAL;
        }
      }
    }));

    rodape(1, totalPaises > 0 ? totalPaises : '—');

    // Página 2 — operadores, sugestões, obs
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
        ['Nacionais',    vNac > 0 ? vNac : ''],
        ['Estrangeiros', vEst > 0 ? vEst : ''],
      ],
      foot: [['TOTAL', totalSimples > 0 ? totalSimples : '']],
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
  var data = new Date().toISOString().slice(0, 10);
  var nome = 'Registo-Nacionalidades-' + tipo + '-' + data + '.pdf';
  doc.save(nome);
}

function imprimirPDF() { mostrarModalPDF(); }
