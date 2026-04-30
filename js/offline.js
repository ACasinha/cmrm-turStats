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
  'body{font-family:Arial,sans-serif;font-size:8.5pt;color:#1a1a1a;margin:0}' +
  '.pagina{padding:10mm 12mm;box-sizing:border-box;page-break-after:always}' +
  '.pagina:last-child{page-break-after:auto}' +
  '.cabecalho{display:flex;align-items:baseline;gap:16px;border-bottom:2px solid #8B4A2B;padding-bottom:6px;margin-bottom:8px}' +
  '.cabecalho h1{font-size:11pt;color:#8B4A2B;margin:0;white-space:nowrap}' +
  '.cabecalho-meta{display:flex;gap:20px;flex:1;align-items:baseline}' +
  '.cab-campo{display:flex;align-items:baseline;gap:5px;font-size:8pt}' +
  '.cab-campo label{color:#8B4A2B;font-weight:700;text-transform:uppercase;font-size:7pt;letter-spacing:0.5px;white-space:nowrap}' +
  '.cab-campo input{border:none;border-bottom:1.5px solid #8B4A2B;background:transparent;font-size:8.5pt;padding:1px 3px;width:120px;outline:none}' +
  '.aviso-topo{background:#fff8e1;border-left:3px solid #c0392b;padding:4px 8px;margin-bottom:8px;font-size:7.5pt;color:#c0392b;font-weight:600}' +
  'h2{font-size:9pt;color:#8B4A2B;border-bottom:1px solid #e8e0d5;padding-bottom:2px;margin:10px 0 5px}' +
  'table{width:100%;border-collapse:collapse;font-size:8pt}' +
  'th{background:#8B4A2B;color:white;padding:3px 5px;text-align:left;font-weight:600}' +
  'td{padding:0.5px 5px;border-bottom:1px solid #e8e0d5;vertical-align:middle;line-height:0.3}' +
  'tr:nth-child(even) td{background:#faf5ef}' +
  '.num{text-align:right;font-weight:600;width:50px}' +
  '.input-cel{border:none;border-bottom:1px solid #ccc;width:100%;background:transparent;font-size:8pt;padding:1px 2px;outline:none}' +
  '.total-linha td{background:#f5ebe0!important;color:#8B4A2B;font-weight:700;border-top:2px solid #8B4A2B}' +
  '.total-linha .input-cel{font-weight:700;color:#8B4A2B;font-size:9pt}' +
  '.vazio{color:#999;font-style:italic;text-align:center;padding:6px}' +
  '.obs-area{border:1px solid #e8e0d5;border-radius:4px;padding:6px 8px;min-height:45px;font-size:8.5pt;background:#fafafa}' +
  '.rodape-pdf{margin-top:10px;font-size:7pt;color:#aaa;text-align:center;border-top:1px solid #e8e0d5;padding-top:5px}' +
  '@media print{@page{size:A4;margin:8mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

function gerarPDF(tipo) {
  var dataHoje  = new Date().toLocaleDateString('pt-PT');
  var horaAgora = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  var host      = window.location.host;

  // Tentar ler local e data da página (podem estar vazios — preenchimento manual no PDF)
  var localPag = '';
  var dataPag  = '';
  var localEl  = document.getElementById('local');
  var dataEl   = document.getElementById('data');
  if (localEl && localEl.value) localPag = localEl.value;
  if (dataEl  && dataEl.value)  dataPag  = dataEl.value;

  // Recolher dados existentes na página (se existirem)
  var obs = '';
  var obsEl = document.getElementById('observacoes');
  if (obsEl) obs = obsEl.value || '';

  var linhasOp  = recolherLinhasOpParaPDF();
  var linhasSug = recolherLinhasSugParaPDF();

  // ── Cabecalho comum ──────────────────────────────────────
  function cabecalho(pagina) {
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

  var aviso =
    '<div class="aviso-topo">' +
      '⚠ Após restabelecimento da Internet inserir dados na aplicação.' +
    '</div>';

  var html;

  // ── MODO PAÍSES (lista completa) ─────────────────────────
  if (tipo === 'paises') {
    var listaPaisesCompleta = typeof PAISES !== 'undefined' ? PAISES : [];

    // Recolher valores preenchidos na página actual
    var valoresPaises = {};
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      var v = parseInt(inp.value, 10) || 0;
      if (v > 0) valoresPaises[inp.dataset.pais] = v;
    });

    // Gerar linhas da tabela com inputs editáveis para cada país
    var linhasPaisesHTML = '';
    var totalPaises = 0;
    listaPaisesCompleta.forEach(function(p) {
      var val = valoresPaises[p.nome] || '';
      if (val) totalPaises += parseInt(val, 10) || 0;
      var destaque = p.destaque ? 'style="font-weight:700;color:#8B4A2B"' : '';
      linhasPaisesHTML +=
        '<tr>' +
          '<td ' + destaque + '>' + esc2(p.nome) + '</td>' +
          '<td class="num"><input class="input-cel" type="number" min="0" ' +
            'value="' + esc2(String(val)) + '" style="text-align:right;width:50px"></td>' +
        '</tr>';
    });

    html = buildHTML(
      '<div class="pagina">' +
        cabecalho(1) +
        aviso +
        '<h2>Países — Turistas e Visitantes</h2>' +
        '<table>' +
          '<thead><tr><th>País</th><th style="text-align:right;width:55px">Visitantes</th></tr></thead>' +
          '<tbody>' + linhasPaisesHTML + '</tbody>' +
          '<tfoot><tr class="total-linha"><td style="font-weight:700;color:#8B4A2B">TOTAL</td>' +
            '<td class="num"><input class="input-cel" type="number" min="0" ' +
              'value="" style="text-align:right;width:45px;font-weight:700;color:#8B4A2B"></td></tr></tfoot>' +
        '</table>' +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 1/2</div>' +
      '</div>' +

      '<div class="pagina">' +
        cabecalho(2) +
        '<h2>Operadores e Agências</h2>' +
        '<table><thead><tr><th>Operador / Agência</th><th>Nacionalidades</th>' +
          '<th style="text-align:right;width:55px">Total</th></tr></thead>' +
          '<tbody>' + linhasOp + '</tbody></table>' +
        '<h2>Sugestões e Críticas</h2>' +
        '<table><thead><tr><th>Sugestão / Crítica</th>' +
          '<th style="width:130px">Nacionalidade</th></tr></thead>' +
          '<tbody>' + linhasSug + '</tbody></table>' +
        '<h2>Outras Observações</h2>' +
        '<div class="obs-area">' + (esc2(obs) || '&nbsp;') + '</div>' +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 2/2</div>' +
      '</div>'
    );

  // ── MODO SIMPLES (Nacionais / Estrangeiros) ───────────────
  } else {
    var vNac = 0, vEst = 0;
    document.querySelectorAll('.pais-input').forEach(function(inp) {
      if (inp.dataset.pais === 'Nacionais')    vNac = parseInt(inp.value, 10) || 0;
      if (inp.dataset.pais === 'Estrangeiros') vEst = parseInt(inp.value, 10) || 0;
    });
    var totalSimples = vNac + vEst;

    html = buildHTML(
      '<div class="pagina">' +
        cabecalho(1) +
        aviso +
        '<h2>Visitantes</h2>' +
        '<table>' +
          '<thead><tr><th>Tipo</th><th style="text-align:right;width:80px">Visitantes</th></tr></thead>' +
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
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 1/2</div>' +
      '</div>' +

      '<div class="pagina">' +
        cabecalho(2) +
        '<h2>Operadores e Agências</h2>' +
        '<table><thead><tr><th>Operador / Agência</th><th>Nacionalidades</th>' +
          '<th style="text-align:right;width:55px">Total</th></tr></thead>' +
          '<tbody>' + linhasOp + '</tbody></table>' +
        '<h2>Sugestões e Críticas</h2>' +
        '<table><thead><tr><th>Sugestão / Crítica</th>' +
          '<th style="width:130px">Nacionalidade</th></tr></thead>' +
          '<tbody>' + linhasSug + '</tbody></table>' +
        '<h2>Outras Observações</h2>' +
        '<div class="obs-area">' + (esc2(obs) || '&nbsp;') + '</div>' +
        '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 2/2</div>' +
      '</div>'
    );
  }

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

function buildHTML(corpo) {
  return '<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">' +
    '<title>Registo Diário de Nacionalidades</title>' +
    '<style>' + CSS_PDF + '</style>' +
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
