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
          '<button class="btn-pdf-opcao" onclick="gerarPDF(\'paises\',\'imprimir\');fecharModalPDF()">' +
            '<span class="pdf-opcao-icone">🌍</span>' +
            '<span class="pdf-opcao-titulo">Lista de Países</span>' +
            '<span class="pdf-opcao-desc">Formulário com todos os países<br>para registar visitantes por país</span>' +
          '</button>' +
          '<button class="btn-pdf-opcao" onclick="gerarPDF(\'simples\',\'imprimir\');fecharModalPDF()">' +
            '<span class="pdf-opcao-icone">🏠</span>' +
            '<span class="pdf-opcao-titulo">Nacionais / Estrangeiros</span>' +
            '<span class="pdf-opcao-desc">Formulário simplificado<br>apenas com Nacionais e Estrangeiros</span>' +
          '</button>' +
        '</div>' +
        '<div class="modal-pdf-acoes">' +
          '<button class="btn-pdf-download" onclick="gerarPDF(\'paises\',\'download\');fecharModalPDF()">' +
            '⬇ Descarregar Lista de Países' +
          '</button>' +
          '<button class="btn-pdf-download" onclick="gerarPDF(\'simples\',\'download\');fecharModalPDF()">' +
            '⬇ Descarregar Nacionais / Estrangeiros' +
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
// GERAÇÃO DE PDF
// ============================================================

// Estilos para a versão de lista de países (2 páginas, linhas compactas)
var CSS_PDF_PAISES =
  'body{font-family:Arial,sans-serif;font-size:7.5pt;color:#1a1a1a;margin:0}' +
  '.pagina{padding:8mm 10mm;box-sizing:border-box;page-break-after:always}' +
  '.pagina:last-child{page-break-after:auto}' +
  '.cabecalho{display:flex;align-items:baseline;gap:16px;border-bottom:2px solid #8B4A2B;padding-bottom:5px;margin-bottom:7px}' +
  '.cabecalho h1{font-size:10pt;color:#8B4A2B;margin:0;white-space:nowrap}' +
  '.cabecalho-meta{display:flex;gap:20px;flex:1;align-items:baseline}' +
  '.cab-campo{display:flex;align-items:baseline;gap:5px;font-size:7.5pt}' +
  '.cab-campo label{color:#8B4A2B;font-weight:700;text-transform:uppercase;font-size:6.5pt;letter-spacing:0.5px;white-space:nowrap}' +
  '.cab-campo input{border:none;border-bottom:1.5px solid #8B4A2B;background:transparent;font-size:7.5pt;padding:1px 3px;width:120px;outline:none}' +
  'table{width:100%;border-collapse:collapse;font-size:7pt}' +
  'th{background:#8B4A2B;color:white;padding:2px 5px;text-align:left;font-weight:600;font-size:7pt}' +
  'td{padding:0px 5px;border-bottom:1px solid #e8e0d5;vertical-align:middle;line-height:1.1}' +
  'tr:nth-child(even) td{background:#faf5ef}' +
  '.num{text-align:right;font-weight:600;width:50px}' +
  '.input-cel{border:none;border-bottom:1px solid #ccc;width:100%;background:transparent;font-size:7pt;padding:0px 2px;outline:none;line-height:1.1}' +
  '.total-linha td{background:#f5ebe0!important;color:#8B4A2B;font-weight:700;border-top:2px solid #8B4A2B}' +
  '.total-linha .input-cel{font-weight:700;color:#8B4A2B;font-size:8pt}' +
  '.vazio{color:#999;font-style:italic;text-align:center;padding:4px}' +
  '.obs-area{border:1px solid #e8e0d5;border-radius:4px;padding:5px 8px;min-height:40px;font-size:8pt;background:#fafafa}' +
  '.assinatura-area{margin-top:14px;display:flex;align-items:flex-end;gap:30px}' +
  '.assinatura-campo{flex:1}' +
  '.assinatura-linha{border-bottom:1.5px solid #8B4A2B;height:28px;margin-bottom:3px}' +
  '.assinatura-label{font-size:6.5pt;color:#8B4A2B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}' +
  '.aviso-fundo{background:#fff8e1;border-left:3px solid #c0392b;padding:4px 8px;margin-top:10px;font-size:7pt;color:#c0392b;font-weight:600}' +
  '.rodape-pdf{margin-top:7px;font-size:6.5pt;color:#aaa;text-align:center;border-top:1px solid #e8e0d5;padding-top:4px}' +
  '@media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

// Estilos para a versão simplificada (tudo numa página)
var CSS_PDF_SIMPLES =
  'body{font-family:Arial,sans-serif;font-size:8.5pt;color:#1a1a1a;margin:0}' +
  '.pagina{padding:10mm 14mm;box-sizing:border-box}' +
  '.cabecalho{display:flex;align-items:baseline;gap:16px;border-bottom:2px solid #8B4A2B;padding-bottom:6px;margin-bottom:8px}' +
  '.cabecalho h1{font-size:11pt;color:#8B4A2B;margin:0;white-space:nowrap}' +
  '.cabecalho-meta{display:flex;gap:20px;flex:1;align-items:baseline}' +
  '.cab-campo{display:flex;align-items:baseline;gap:5px;font-size:8pt}' +
  '.cab-campo label{color:#8B4A2B;font-weight:700;text-transform:uppercase;font-size:7pt;letter-spacing:0.5px;white-space:nowrap}' +
  '.cab-campo input{border:none;border-bottom:1.5px solid #8B4A2B;background:transparent;font-size:8.5pt;padding:1px 3px;width:120px;outline:none}' +
  'table{width:100%;border-collapse:collapse;font-size:8.5pt}' +
  'th{background:#8B4A2B;color:white;padding:4px 6px;text-align:left;font-weight:600}' +
  'td{padding:3px 6px;border-bottom:1px solid #e8e0d5;vertical-align:middle;line-height:1.4}' +
  'tr:nth-child(even) td{background:#faf5ef}' +
  '.num{text-align:right;font-weight:600;width:80px}' +
  '.input-cel{border:none;border-bottom:1px solid #ccc;width:100%;background:transparent;font-size:8.5pt;padding:1px 2px;outline:none}' +
  '.total-linha td{background:#f5ebe0!important;color:#8B4A2B;font-weight:700;border-top:2px solid #8B4A2B}' +
  '.total-linha .input-cel{font-weight:700;color:#8B4A2B;font-size:9pt}' +
  '.vazio{color:#999;font-style:italic;text-align:center;padding:6px}' +
  '.obs-area{border:1px solid #e8e0d5;border-radius:4px;padding:6px 8px;min-height:50px;font-size:8.5pt;background:#fafafa}' +
  '.sec-titulo{font-size:7pt;color:#8B4A2B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 0;padding:3px 0;border-bottom:1px solid #e8e0d5}' +
  '.assinatura-area{margin-top:16px;display:flex;align-items:flex-end;gap:30px}' +
  '.assinatura-campo{flex:1}' +
  '.assinatura-linha{border-bottom:1.5px solid #8B4A2B;height:32px;margin-bottom:4px}' +
  '.assinatura-label{font-size:7pt;color:#8B4A2B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}' +
  '.aviso-fundo{background:#fff8e1;border-left:3px solid #c0392b;padding:5px 10px;margin-top:12px;font-size:7.5pt;color:#c0392b;font-weight:600}' +
  '.rodape-pdf{margin-top:10px;font-size:7pt;color:#aaa;text-align:center;border-top:1px solid #e8e0d5;padding-top:5px}' +
  '@media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

// Bloco de assinatura comum
var BLOCO_ASSINATURA =
  '<div class="assinatura-area">' +
    '<div class="assinatura-campo">' +
      '<div class="assinatura-linha"></div>' +
      '<div class="assinatura-label">Assinatura do(a) Funcionário(a)</div>' +
    '</div>' +
    '<div class="assinatura-campo" style="max-width:160px">' +
      '<div class="assinatura-linha"></div>' +
      '<div class="assinatura-label">Data</div>' +
    '</div>' +
  '</div>';

// Aviso offline — aparece sempre no final, depois da assinatura
var BLOCO_AVISO =
  '<div class="aviso-fundo">' +
    '⚠ Após restabelecimento da Internet, inserir os dados na aplicação.' +
  '</div>';

function gerarPDF(tipo, acao) {
  acao = acao || 'imprimir';

  var obs = '';
  var obsEl = document.getElementById('observacoes');
  if (obsEl) obs = obsEl.value || '';

  var linhasOp  = recolherLinhasOpParaPDF();
  var linhasSug = recolherLinhasSugParaPDF();

  // ── Cabeçalho comum ─────────────────────────────────────
  function cabecalho() {
    return '<div class="cabecalho">' +
      '<h1>Registo Diário de Nacionalidades</h1>' +
      '<div class="cabecalho-meta">' +
        '<div class="cab-campo"><label>Local</label>' +
          '<input class="input-cel" value="" placeholder=""></div>' +
        '<div class="cab-campo"><label>Data</label>' +
          '<input class="input-cel" value="" placeholder="" style="width:80px"></div>' +
      '</div>' +
    '</div>';
  }

  var html;

  // ── MODO PAÍSES (2 páginas, linhas ultra-compactas) ──────
  if (tipo === 'paises') {
    var listaPaisesCompleta = typeof PAISES !== 'undefined' ? PAISES : [];

    var valoresPaises = {};
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      var v = parseInt(inp.value, 10) || 0;
      if (v > 0) valoresPaises[inp.dataset.pais] = v;
    });

    var linhasPaisesHTML = '';
    listaPaisesCompleta.forEach(function(p) {
      var val = valoresPaises[p.nome] || '';
      var destaque = p.destaque ? 'style="font-weight:700;color:#8B4A2B"' : '';
      linhasPaisesHTML +=
        '<tr>' +
          '<td ' + destaque + '>' + esc2(p.nome) + '</td>' +
          '<td class="num"><input class="input-cel" type="number" min="0" ' +
            'value="' + esc2(String(val)) + '" style="text-align:right;width:50px"></td>' +
        '</tr>';
    });

    // Tabelas de operadores e sugestões sem h2 — cabeçalho integrado na primeira linha da tabela
    var tabelaOp =
      '<table>' +
        '<thead><tr>' +
          '<th colspan="3" style="font-size:8pt;background:#6d3921">Operadores e Agências</th>' +
        '</tr>' +
        '<tr><th>Operador / Agência</th><th>Nacionalidades</th>' +
          '<th style="text-align:right;width:55px">Total</th></tr></thead>' +
        '<tbody>' + linhasOp + '</tbody>' +
      '</table>';

    var tabelaSug =
      '<table style="margin-top:6px">' +
        '<thead><tr>' +
          '<th colspan="2" style="font-size:8pt;background:#6d3921">Sugestões e Críticas</th>' +
        '</tr>' +
        '<tr><th>Sugestão / Crítica</th>' +
          '<th style="width:130px">Nacionalidade</th></tr></thead>' +
        '<tbody>' + linhasSug + '</tbody>' +
      '</table>';

    html = buildHTML(
      CSS_PDF_PAISES,
      // Página 1 — Lista de países
      '<div class="pagina">' +
        cabecalho() +
        '<table>' +
          '<thead>' +
            '<tr><th colspan="2" style="font-size:8pt;background:#6d3921">Países — Turistas e Visitantes</th></tr>' +
            '<tr><th>País</th><th style="text-align:right;width:55px">Visitantes</th></tr>' +
          '</thead>' +
          '<tbody>' + linhasPaisesHTML + '</tbody>' +
          '<tfoot><tr class="total-linha"><td style="font-weight:700;color:#8B4A2B">TOTAL</td>' +
            '<td class="num"><input class="input-cel" type="number" min="0" ' +
              'value="" style="text-align:right;width:45px;font-weight:700;color:#8B4A2B"></td></tr></tfoot>' +
        '</table>' +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 1/2</div>' +
      '</div>' +
      // Página 2 — Operadores, Sugestões, Observações, Assinatura, Aviso
      '<div class="pagina">' +
        cabecalho() +
        tabelaOp +
        tabelaSug +
        '<div style="margin-top:8px;font-size:6.5pt;color:#8B4A2B;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:3px 0;border-bottom:1px solid #e8e0d5">Outras Observações</div>' +
        '<div class="obs-area">' + (esc2(obs) || '&nbsp;') + '</div>' +
        BLOCO_ASSINATURA +
        BLOCO_AVISO +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 2/2</div>' +
      '</div>'
    );

  // ── MODO SIMPLES (tudo numa única página) ────────────────
  } else {
    var vNac = 0, vEst = 0;
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      if (inp.dataset.pais === 'Nacionais')    vNac = parseInt(inp.value, 10) || 0;
      if (inp.dataset.pais === 'Estrangeiros') vEst = parseInt(inp.value, 10) || 0;
    });

    var tabelaOp =
      '<table>' +
        '<thead><tr>' +
          '<th colspan="3" style="font-size:8.5pt;background:#6d3921">Operadores e Agências</th>' +
        '</tr>' +
        '<tr><th>Operador / Agência</th><th>Nacionalidades</th>' +
          '<th style="text-align:right;width:55px">Total</th></tr></thead>' +
        '<tbody>' + linhasOp + '</tbody>' +
      '</table>';

    var tabelaSug =
      '<table style="margin-top:6px">' +
        '<thead><tr>' +
          '<th colspan="2" style="font-size:8.5pt;background:#6d3921">Sugestões e Críticas</th>' +
        '</tr>' +
        '<tr><th>Sugestão / Crítica</th>' +
          '<th style="width:130px">Nacionalidade</th></tr></thead>' +
        '<tbody>' + linhasSug + '</tbody>' +
      '</table>';

    html = buildHTML(
      CSS_PDF_SIMPLES,
      '<div class="pagina">' +
        cabecalho() +
        // Tabela visitantes com título integrado
        '<table>' +
          '<thead>' +
            '<tr><th colspan="2" style="font-size:9pt;background:#6d3921">Visitantes</th></tr>' +
            '<tr><th>Tipo</th><th style="text-align:right;width:80px">Visitantes</th></tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr style="font-weight:700;color:#8B4A2B">' +
              '<td>Nacionais</td>' +
              '<td class="num"><input class="input-cel" type="number" min="0" ' +
                'value="' + (vNac || '') + '" style="text-align:right;width:60px"></td>' +
            '</tr>' +
            '<tr>' +
              '<td>Estrangeiros</td>' +
              '<td class="num"><input class="input-cel" type="number" min="0" ' +
                'value="' + (vEst || '') + '" style="text-align:right;width:60px"></td>' +
            '</tr>' +
          '</tbody>' +
          '<tfoot><tr class="total-linha"><td style="font-weight:700;color:#8B4A2B">TOTAL</td>' +
            '<td class="num"><input class="input-cel" type="number" min="0" ' +
              'style="text-align:right;width:50px;font-weight:700;color:#8B4A2B"></td></tr></tfoot>' +
        '</table>' +
        // Operadores e sugestões
        '<div style="margin-top:8px">' + tabelaOp + '</div>' +
        '<div style="margin-top:6px">' + tabelaSug + '</div>' +
        // Observações
        '<div class="sec-titulo">Outras Observações</div>' +
        '<div class="obs-area">' + (esc2(obs) || '&nbsp;') + '</div>' +
        // Assinatura e aviso — no final
        BLOCO_ASSINATURA +
        BLOCO_AVISO +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz</div>' +
      '</div>'
    );
  }

  // ── Abrir janela e imprimir ou descarregar ───────────────
  if (acao === 'download') {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    var dataStr = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = 'registo-nacionalidades-' + tipo + '-' + dataStr + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  } else {
    var janela = window.open('', '_blank');
    if (!janela) {
      alert('Por favor permita popups para este site para gerar o PDF.');
      return;
    }
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(function() { janela.print(); }, 800);
  }
}

function buildHTML(css, corpo) {
  return '<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">' +
    '<title>Registo Diário de Nacionalidades</title>' +
    '<style>' + css + '</style>' +
    '</head><body>' + corpo + '</body></html>';
}

// Helper esc para o PDF (não depende do esc() do ui.js)
function esc2(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function recolherLinhasOpParaPDF() {
  var html = '';
  var nLinhas = 6;
  for (var i = 0; i < nLinhas; i++) {
    html += '<tr>' +
      '<td><input class="input-cel"></td>' +
      '<td><input class="input-cel"></td>' +
      '<td class="num"><input class="input-cel" type="number" min="0" style="text-align:right;width:45px"></td>' +
    '</tr>';
  }
  return html;
}

function recolherLinhasSugParaPDF() {
  var html = '';
  var nLinhas = 6;
  for (var i = 0; i < nLinhas; i++) {
    html += '<tr>' +
      '<td><input class="input-cel"></td>' +
      '<td><input class="input-cel" style="width:120px"></td>' +
    '</tr>';
  }
  return html;
}

// Compat: manter imprimirPDF para o botão do banner offline
function imprimirPDF() {
  mostrarModalPDF();
}
