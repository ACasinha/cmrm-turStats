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
  'body{font-family:Arial,sans-serif;font-size:10.5pt;color:#1a1a1a;margin:0}' +
  '.pagina{padding:14mm 13mm;box-sizing:border-box;page-break-after:always}' +
  '.pagina:last-child{page-break-after:auto}' +
  '.cabecalho{border-bottom:2.5px solid #8B4A2B;padding-bottom:9px;margin-bottom:12px}' +
  '.cabecalho h1{font-size:13pt;color:#8B4A2B;margin:0 0 2px}' +
  '.cabecalho p{font-size:8.5pt;color:#666;margin:0}' +
  '.meta{display:flex;flex-wrap:wrap;gap:16px;background:#f5ebe0;border-radius:5px;padding:7px 11px;margin-bottom:12px;font-size:9.5pt}' +
  '.meta strong{color:#8B4A2B}' +
  '.meta-campo{display:flex;flex-direction:column;gap:2px}' +
  '.meta-campo label{font-size:7.5pt;text-transform:uppercase;letter-spacing:0.8px;color:#8B4A2B;font-weight:bold}' +
  '.meta-campo input{border:none;border-bottom:1.5px solid #8B4A2B;background:transparent;font-size:10pt;padding:2px 4px;min-width:120px;outline:none}' +
  'h2{font-size:10.5pt;color:#8B4A2B;border-bottom:1px solid #e8e0d5;padding-bottom:3px;margin:12px 0 7px}' +
  'table{width:100%;border-collapse:collapse;font-size:9.5pt}' +
  'th{background:#8B4A2B;color:white;padding:4px 7px;text-align:left;font-weight:600}' +
  'td{padding:3px 7px;border-bottom:1px solid #e8e0d5;vertical-align:middle}' +
  'tr:nth-child(even) td{background:#faf5ef}' +
  '.num{text-align:right;font-weight:600;width:55px}' +
  '.input-cel{border:none;border-bottom:1px solid #ccc;width:100%;background:transparent;font-size:9.5pt;padding:1px 2px}' +
  '.total-linha td{background:#8B4A2B!important;color:white;font-weight:700;border:none}' +
  '.vazio{color:#999;font-style:italic;text-align:center;padding:8px}' +
  '.aviso{border:2px solid #c0392b;border-radius:5px;padding:8px 12px;margin-top:14px;background:#fdf0ee}' +
  '.aviso strong{color:#c0392b;display:block;margin-bottom:3px;font-size:9.5pt}' +
  '.aviso p{font-size:9pt;color:#444;margin:0}' +
  '.obs-area{border:1px solid #e8e0d5;border-radius:5px;padding:8px 10px;min-height:55px;font-size:9.5pt;background:#fafafa}' +
  '.rodape-pdf{margin-top:14px;font-size:7.5pt;color:#aaa;text-align:center;border-top:1px solid #e8e0d5;padding-top:6px}' +
  '@media print{@page{size:A4;margin:12mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';

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
  function cabecalho(pagina, total) {
    return '<div class="cabecalho">' +
      '<h1>Registo Diário de Nacionalidades</h1>' +
      '<p>Município de Reguengos de Monsaraz · Serviços de Turismo' +
        (pagina === 2 && localPag ? ' · ' + localPag : '') + '</p>' +
    '</div>' +
    (pagina === 1 ?
      '<div class="meta">' +
        '<div class="meta-campo"><label>Local / Posto</label>' +
          '<input class="input-cel" value="' + esc2(localPag) + '" placeholder="Preencher manualmente"></div>' +
        '<div class="meta-campo"><label>Data</label>' +
          '<input class="input-cel" value="' + esc2(dataPag) + '" placeholder="aaaa-mm-dd"></div>' +
        '<div class="meta-campo"><label>Impresso em</label>' +
          '<input class="input-cel" value="' + dataHoje + ' ' + horaAgora + '" readonly></div>' +
        (tipo === 'paises' && total !== undefined ?
          '<div class="meta-campo"><label>Total</label>' +
          '<input class="input-cel" value="' + total + '" style="font-weight:700;color:#8B4A2B"></div>' : '') +
      '</div>' : '');
  }

  var aviso =
    '<div class="aviso">' +
      '<strong>⚠ Lembrete — inserir dados na aplicação</strong>' +
      '<p>Após restabelecimento da Internet, aceda a <strong>' + host + '</strong> e registe ' +
      'estes dados na aplicação para garantir o correcto registo na base de dados.</p>' +
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
        cabecalho(1, totalPaises) +
        '<h2>Países — Turistas e Visitantes</h2>' +
        '<table>' +
          '<thead><tr><th>País</th><th style="text-align:right;width:60px">Visitantes</th></tr></thead>' +
          '<tbody>' + linhasPaisesHTML + '</tbody>' +
          '<tfoot><tr class="total-linha"><td>TOTAL</td>' +
            '<td class="num" id="totalPDF">' + (totalPaises || '') + '</td></tr></tfoot>' +
        '</table>' +
        aviso +
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
        aviso +
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
          '<tfoot><tr class="total-linha"><td>TOTAL</td>' +
            '<td class="num">' + (totalSimples || '') + '</td></tr></tfoot>' +
        '</table>' +
        aviso +
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
        aviso +
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
  // Linhas da tabela se existir
  document.querySelectorAll('#tabelaOperadores tr').forEach(function(tr) {
    var nome = (tr.querySelector('.op-nome') || {}).value || '';
    var tot  = (tr.querySelector('.op-total') || {}).value || '';
    var nacs = [];
    tr.querySelectorAll('.op-nac-linha').forEach(function(l) {
      var p = (l.querySelector('.op-nac-select') || {}).value || '';
      var n = parseInt((l.querySelector('.op-nac-num') || {}).value, 10) || 0;
      if (p && n > 0) nacs.push(p + ': ' + n);
    });
    if (nome) html += '<tr><td>' + esc2(nome) + '</td><td>' +
      esc2(nacs.join(', ') || '—') + '</td><td class="num">' + esc2(tot || '0') + '</td></tr>';
  });
  // Linhas em branco editáveis (mínimo 4)
  var nLinhas = 4;
  for (var i = 0; i < nLinhas; i++) {
    html += '<tr>' +
      '<td><input class="input-cel" placeholder="Operador..."></td>' +
      '<td><input class="input-cel" placeholder="Ex: Portugal: 2, Espanha: 1..."></td>' +
      '<td class="num"><input class="input-cel" type="number" min="0" style="text-align:right;width:45px"></td>' +
    '</tr>';
  }
  return html || '<tr><td colspan="3" class="vazio">Sem registos</td></tr>';
}

function recolherLinhasSugParaPDF() {
  var html = '';
  document.querySelectorAll('#tabelaSugestoes tr').forEach(function(tr) {
    var txt = (tr.querySelector('.sug-texto') || {}).value || '';
    var nac = (tr.querySelector('.sug-nac') || {}).value   || '';
    if (txt) html += '<tr><td>' + esc2(txt) + '</td><td>' + esc2(nac || '—') + '</td></tr>';
  });
  // Linhas em branco editáveis (mínimo 4)
  var nLinhas = 4;
  for (var i = 0; i < nLinhas; i++) {
    html += '<tr>' +
      '<td><input class="input-cel" placeholder="Sugestão / Crítica..."></td>' +
      '<td><input class="input-cel" placeholder="Nacionalidade..."></td>' +
    '</tr>';
  }
  return html || '<tr><td colspan="2" class="vazio">Sem registos</td></tr>';
}

// Compat: manter imprimirPDF para o botão do banner offline
function imprimirPDF() {
  mostrarModalPDF();
}
