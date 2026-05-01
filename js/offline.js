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
// GERAÇÃO DE PDF
// ============================================================

var CSS_PDF =
  'body{font-family:Arial,sans-serif;color:#1a1a1a;margin:0}' +
  '.pagina{padding:9mm 11mm;box-sizing:border-box;page-break-after:always}' +
  '.pagina:last-child{page-break-after:auto}' +
  '.cabecalho{display:flex;align-items:baseline;gap:14px;border-bottom:2px solid #8B4A2B;padding-bottom:5px;margin-bottom:6px}' +
  '.cabecalho h1{font-size:10.5pt;color:#8B4A2B;margin:0;white-space:nowrap;font-weight:700}' +
  '.cabecalho-meta{display:flex;gap:18px;flex:1;align-items:baseline}' +
  '.cab-campo{display:flex;align-items:baseline;gap:4px;font-size:7.5pt}' +
  '.cab-campo label{color:#8B4A2B;font-weight:700;text-transform:uppercase;font-size:6.5pt;letter-spacing:0.5px;white-space:nowrap}' +
  '.cab-campo input{border:none;border-bottom:1.5px solid #8B4A2B;background:transparent;font-size:8pt;padding:1px 3px;width:110px;outline:none}' +
  'table{width:100%;border-collapse:collapse;margin-bottom:6px}' +
  '.tbl-paises{font-size:7.5pt}' +
  '.tbl-paises th{background:#8B4A2B;color:white;padding:2.5px 5px;text-align:left;font-weight:600;font-size:7.5pt}' +
  '.tbl-paises td{padding:1px 5px;border-bottom:1px solid #eee;line-height:1.2;vertical-align:middle}' +
  '.tbl-paises tr:nth-child(even) td{background:#faf5ef}' +
  '.tbl-normal{font-size:8.5pt}' +
  '.tbl-normal th{background:#8B4A2B;color:white;padding:4px 7px;text-align:left;font-weight:600}' +
  '.tbl-normal td{padding:4px 7px;border-bottom:1px solid #e8e0d5;line-height:1.5;vertical-align:middle}' +
  '.tbl-normal tr:nth-child(even) td{background:#faf5ef}' +
  '.tbl-simples{font-size:11pt}' +
  '.tbl-simples th{background:#8B4A2B;color:white;padding:8px 10px;text-align:left;font-weight:600}' +
  '.tbl-simples td{padding:10px 10px;border-bottom:1px solid #e8e0d5;line-height:1.6;vertical-align:middle}' +
  '.tbl-simples tr:nth-child(even) td{background:#faf5ef}' +
  '.num{text-align:right;font-weight:600;width:55px}' +
  '.input-cel{border:none;border-bottom:1px solid #ccc;width:100%;background:transparent;font-size:inherit;padding:1px 2px;outline:none}' +
  '.total-linha td{background:#f5ebe0!important;color:#8B4A2B;font-weight:700;border-top:2px solid #8B4A2B}' +
  '.total-linha .input-cel{font-weight:700;color:#8B4A2B}' +
  '.obs-area{border:1px solid #e8e0d5;border-radius:4px;padding:6px 8px;min-height:38px;font-size:8.5pt;background:#fafafa;margin-bottom:6px}' +
  '.assinatura{margin-top:14px;padding-top:8px;display:flex;align-items:flex-end;gap:30px}' +
  '.assinatura-linha{flex:1;border-bottom:1.5px solid #8B4A2B;padding-bottom:2px}' +
  '.assinatura-label{font-size:7pt;color:#8B4A2B;text-transform:uppercase;letter-spacing:0.5px;margin-top:3px}' +
  '.assinatura-data{width:100px}' +
  '.aviso-final{border-left:3px solid #c0392b;padding:4px 8px;margin-top:10px;font-size:7.5pt;color:#c0392b;font-weight:600;background:#fff8e1}' +
  '.rodape-pdf{margin-top:8px;font-size:6.5pt;color:#aaa;text-align:center;border-top:1px solid #e8e0d5;padding-top:4px}' +
  '@media print{@page{size:A4;margin:7mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

function gerarPDF(tipo) {
  var dataHoje  = new Date().toLocaleDateString('pt-PT');
  var horaAgora = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  var obs = '';
  var obsEl = document.getElementById('observacoes');
  if (obsEl) obs = obsEl.value || '';

  // ── Cabeçalho comum (uma linha) ──────────────────────────
  var cab =
    '<div class="cabecalho">' +
      '<h1>Registo Diário de Nacionalidades</h1>' +
      '<div class="cabecalho-meta">' +
        '<div class="cab-campo"><label>Local</label>' +
          '<input class="input-cel" value="" style="width:140px"></div>' +
        '<div class="cab-campo"><label>Data</label>' +
          '<input class="input-cel" value="" style="width:75px"></div>' +
      '</div>' +
    '</div>';

  // ── Bloco de assinatura ───────────────────────────────────
  var assinatura =
    '<div class="assinatura">' +
      '<div>' +
        '<div class="assinatura-linha"></div>' +
        '<div class="assinatura-label">Assinatura do(a) Funcionário(a)</div>' +
      '</div>' +
      '<div class="assinatura-data">' +
        '<div class="assinatura-linha"></div>' +
        '<div class="assinatura-label">Data</div>' +
      '</div>' +
    '</div>';

  // ── Aviso final ───────────────────────────────────────────
  var avisoFinal =
    '<div class="aviso-final">' +
      '⚠ Após restabelecimento da Internet inserir dados na aplicação.' +
    '</div>';

  var html;

  // ── MODO PAÍSES — 2 páginas ───────────────────────────────
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
      var dest = p.destaque ? 'style="font-weight:700;color:#8B4A2B"' : '';
      linhasPaisesHTML +=
        '<tr><td ' + dest + '>' + esc2(p.nome) + '</td>' +
        '<td class="num"><input class="input-cel" type="number" min="0" ' +
          'value="' + esc2(String(val)) + '" style="text-align:right;width:48px"></td></tr>';
    });

    var linhasOp  = recolherLinhasOpParaPDF('normal');
    var linhasSug = recolherLinhasSugParaPDF('normal');

    html = buildHTML(
      // Página 1 — países
      '<div class="pagina">' +
        cab +
        '<table class="tbl-paises">' +
          '<thead><tr>' +
            '<th>País — Turistas e Visitantes</th>' +
            '<th style="text-align:right;width:55px">Visitantes</th>' +
          '</tr></thead>' +
          '<tbody>' + linhasPaisesHTML + '</tbody>' +
          '<tfoot><tr class="total-linha">' +
            '<td style="font-weight:700">TOTAL</td>' +
            '<td class="num"><input class="input-cel" type="number" min="0" ' +
              'style="text-align:right;width:48px;font-weight:700"></td>' +
          '</tr></tfoot>' +
        '</table>' +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 1/2</div>' +
      '</div>' +

      // Página 2 — operadores, sugestões, observações, assinatura, aviso
      '<div class="pagina">' +
        cab +
        '<table class="tbl-normal">' +
          '<thead><tr>' +
            '<th>Operador / Agência</th>' +
            '<th>Nacionalidades</th>' +
            '<th style="text-align:right;width:55px">Total</th>' +
          '</tr></thead>' +
          '<tbody>' + linhasOp + '</tbody>' +
        '</table>' +
        '<table class="tbl-normal">' +
          '<thead><tr>' +
            '<th>Sugestão / Crítica</th>' +
            '<th style="width:130px">Nacionalidade</th>' +
          '</tr></thead>' +
          '<tbody>' + linhasSug + '</tbody>' +
        '</table>' +
        '<table class="tbl-normal">' +
          '<thead><tr><th colspan="2">Outras Observações</th></tr></thead>' +
          '<tbody><tr><td colspan="2"><div class="obs-area">' + (esc2(obs) || '&nbsp;') + '</div></td></tr></tbody>' +
        '</table>' +
        assinatura +
        avisoFinal +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 2/2</div>' +
      '</div>'
    );

  // ── MODO SIMPLES — 1 página ───────────────────────────────
  } else {
    var vNac = 0, vEst = 0;
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      if (inp.dataset.pais === 'Nacionais')    vNac = parseInt(inp.value, 10) || 0;
      if (inp.dataset.pais === 'Estrangeiros') vEst = parseInt(inp.value, 10) || 0;
    });

    var linhasOp  = recolherLinhasOpParaPDF('simples');
    var linhasSug = recolherLinhasSugParaPDF('simples');

    html = buildHTML(
      '<div class="pagina">' +
        cab +
        // Visitantes
        '<table class="tbl-simples">' +
          '<thead><tr>' +
            '<th>Visitantes — Nacionais / Estrangeiros</th>' +
            '<th style="text-align:right;width:80px">Nº</th>' +
          '</tr></thead>' +
          '<tbody>' +
            '<tr><td style="font-weight:700;color:#8B4A2B">Nacionais</td>' +
              '<td class="num"><input class="input-cel" type="number" min="0" ' +
                'value="' + (vNac || '') + '" style="text-align:right;width:65px"></td></tr>' +
            '<tr><td>Estrangeiros</td>' +
              '<td class="num"><input class="input-cel" type="number" min="0" ' +
                'value="' + (vEst || '') + '" style="text-align:right;width:65px"></td></tr>' +
          '</tbody>' +
          '<tfoot><tr class="total-linha">' +
            '<td style="font-weight:700">TOTAL</td>' +
            '<td class="num"><input class="input-cel" type="number" min="0" ' +
              'style="text-align:right;width:65px;font-weight:700"></td>' +
          '</tr></tfoot>' +
        '</table>' +
        // Operadores
        '<table class="tbl-normal">' +
          '<thead><tr>' +
            '<th>Operador / Agência</th>' +
            '<th>Nacionalidades</th>' +
            '<th style="text-align:right;width:55px">Total</th>' +
          '</tr></thead>' +
          '<tbody>' + linhasOp + '</tbody>' +
        '</table>' +
        // Sugestões
        '<table class="tbl-normal">' +
          '<thead><tr>' +
            '<th>Sugestão / Crítica</th>' +
            '<th style="width:130px">Nacionalidade</th>' +
          '</tr></thead>' +
          '<tbody>' + linhasSug + '</tbody>' +
        '</table>' +
        // Observações
        '<table class="tbl-normal">' +
          '<thead><tr><th colspan="2">Outras Observações</th></tr></thead>' +
          '<tbody><tr><td colspan="2"><div class="obs-area">' + (esc2(obs) || '&nbsp;') + '</div></td></tr></tbody>' +
        '</table>' +
        assinatura +
        avisoFinal +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz</div>' +
      '</div>'
    );
  }

  // ── Abrir janela com opções de impressão e download ───────
  var janela = window.open('', '_blank');
  if (!janela) {
    alert('Por favor permita popups para este site para gerar o PDF.');
    return;
  }

  // Adicionar barra de acções no topo da janela gerada
  var barraAcoes =
    '<div style="position:fixed;top:0;left:0;right:0;background:#8B4A2B;color:white;' +
      'padding:8px 16px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:Arial,sans-serif;font-size:10pt">' +
      '<span style="flex:1;font-weight:700">Registo Diário de Nacionalidades</span>' +
      '<button onclick="window.print()" ' +
        'style="background:white;color:#8B4A2B;border:none;border-radius:5px;' +
          'padding:6px 16px;font-weight:700;cursor:pointer;font-size:10pt">🖨 Imprimir</button>' +
      '<button onclick="descarregarPDF()" ' +
        'style="background:rgba(255,255,255,0.2);color:white;border:1.5px solid rgba(255,255,255,0.4);' +
          'border-radius:5px;padding:6px 16px;font-weight:700;cursor:pointer;font-size:10pt">⬇ Descarregar PDF</button>' +
      '<button onclick="window.close()" ' +
        'style="background:transparent;color:rgba(255,255,255,0.7);border:none;' +
          'cursor:pointer;font-size:14pt;padding:0 4px;line-height:1">✕</button>' +
    '</div>' +
    '<div style="height:44px"></div>'; // espaço para a barra não cobrir o conteúdo

  var scriptDownload =
    '<script>' +
    'function descarregarPDF() {' +
      'var tipo = "' + tipo + '";' +
      'var data = new Date().toISOString().slice(0,10);' +
      'var nome = "Registo-Nacionalidades-" + tipo + "-" + data + ".pdf";' +
      // Usar a API de impressão do browser para "Guardar como PDF"
      'var instrucoes = document.createElement("div");' +
      'instrucoes.style.cssText = "position:fixed;bottom:20px;right:20px;background:#333;color:white;' +
        'padding:12px 18px;border-radius:8px;font-size:10pt;z-index:9999;max-width:280px;line-height:1.5";' +
      'instrucoes.innerHTML = "Na caixa de diálogo de impressão:<br><strong>1.</strong> Escolha <strong>\\'Guardar como PDF\\'</strong> como destino<br><strong>2.</strong> Clique em <strong>\\'Guardar\\'</strong>";' +
      'document.body.appendChild(instrucoes);' +
      'setTimeout(function(){document.body.removeChild(instrucoes);},6000);' +
      'window.print();' +
    '}' +
    '<\/script>';

  janela.document.write(
    '<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">' +
    '<title>Registo Diário de Nacionalidades</title>' +
    '<style>' + CSS_PDF +
      // Esconder barra ao imprimir
      '@media print{.barra-acoes{display:none!important}.espacador{display:none!important}}' +
    '</style>' +
    '</head><body>' +
    '<div class="barra-acoes">' + barraAcoes + '</div>' +
    '<div class="espacador" style="height:44px"></div>' +
    (tipo === 'paises' ? html.replace('<div class="pagina">', '<div class="pagina" style="margin-top:0">') : html) +
    scriptDownload +
    '</body></html>'
  );
  janela.document.close();
  janela.focus();
}

function buildHTML(corpo) {
  return corpo;
}

function esc2(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function recolherLinhasOpParaPDF(modo) {
  var n = (modo === 'simples') ? 4 : 5;
  var html = '';
  for (var i = 0; i < n; i++) {
    html += '<tr>' +
      '<td><input class="input-cel"></td>' +
      '<td><input class="input-cel"></td>' +
      '<td class="num"><input class="input-cel" type="number" min="0" style="text-align:right;width:45px"></td>' +
    '</tr>';
  }
  return html;
}

function recolherLinhasSugParaPDF(modo) {
  var n = (modo === 'simples') ? 4 : 5;
  var html = '';
  for (var i = 0; i < n; i++) {
    html += '<tr>' +
      '<td><input class="input-cel"></td>' +
      '<td><input class="input-cel" style="width:120px"></td>' +
    '</tr>';
  }
  return html;
}

// Compat
function imprimirPDF() { mostrarModalPDF(); }
