// ============================================================
// offline.js — Detecção de ligação, reconexão e impressão PDF
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

// ── Controlo de tentativas de reconexão ──────────────────────
// Máximo 5 tentativas por janela de 2 minutos (anti-abuso)
var _tentativasReconectar    = 0;
var _ultimaJanelaReconectar  = 0;
var JANELA_RECONECTAR_MS     = 2 * 60 * 1000;  // 2 minutos
var MAX_TENTATIVAS_JANELA    = 5;
var _timerBloqueioReconectar = null;

// ── Estado ───────────────────────────────────────────────────
var _estavaSemLigacao = false;

// ============================================================
// INICIALIZAÇÃO — arrancar monitorização ao carregar
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  verificarLigacao();

  window.addEventListener('online',  function() { verificarLigacao(); });
  window.addEventListener('offline', function() { verificarLigacao(); });
});

// ============================================================
// VERIFICAR ESTADO DE LIGAÇÃO
// ============================================================

function verificarLigacao() {
  var online = navigator.onLine;
  var banner = document.getElementById('offlineBanner');

  if (!online) {
    _estavaSemLigacao = true;
    banner.style.display = 'flex';
    bloquearFormulario(true);
    document.getElementById('btnGuardar').disabled = true;
    mostrarToast('Sem ligação à Internet.', 'erro');
  } else if (_estavaSemLigacao) {
    // Voltou a ter ligação
    _estavaSemLigacao = false;
    banner.style.display = 'none';
    bloquearFormulario(false);
    document.getElementById('btnGuardar').disabled = false;
    resetarBotaoReconectar();
    mostrarToast('Ligação restabelecida.', 'sucesso');
  }
}

// ============================================================
// TENTATIVA DE RECONEXÃO (com anti-abuso)
// ============================================================

function tentarReconectar() {
  var agora = Date.now();

  // Resetar contador se a janela de 2 minutos passou
  if (agora - _ultimaJanelaReconectar > JANELA_RECONECTAR_MS) {
    _tentativasReconectar   = 0;
    _ultimaJanelaReconectar = agora;
  }

  if (_tentativasReconectar >= MAX_TENTATIVAS_JANELA) {
    var segundos = Math.ceil((JANELA_RECONECTAR_MS - (agora - _ultimaJanelaReconectar)) / 1000);
    mostrarToast('Aguarde ' + segundos + 's antes de tentar novamente.', 'info');
    return;
  }

  _tentativasReconectar++;

  var btn = document.getElementById('btnReconectar');
  btn.disabled    = true;
  btn.textContent = '⏳ A verificar...';

  // Testar ligação real com um fetch ao próprio servidor
  fetch(window.location.origin + '/manifest.json', { cache: 'no-store', mode: 'no-cors' })
    .then(function() {
      verificarLigacao();
      if (navigator.onLine) resetarBotaoReconectar();
      else {
        btn.disabled    = false;
        btn.textContent = '🔄 Verificar ligação';
        var restantes = MAX_TENTATIVAS_JANELA - _tentativasReconectar;
        if (restantes > 0) mostrarToast('Ainda sem ligação. ' + restantes + ' tentativa(s) restante(s).', 'erro');
        else mostrarToast('Limite de tentativas atingido. Aguarde 2 minutos.', 'erro');
      }
    })
    .catch(function() {
      verificarLigacao();
      btn.disabled    = false;
      btn.textContent = '🔄 Verificar ligação';
    });
}

function resetarBotaoReconectar() {
  var btn = document.getElementById('btnReconectar');
  if (btn) { btn.disabled = false; btn.textContent = '🔄 Verificar ligação'; }
  _tentativasReconectar = 0;
}

// ============================================================
// IMPRESSÃO PDF — versão simplificada frente e verso
// ============================================================

function imprimirPDF() {
  var local    = document.getElementById('local').value  || '—';
  var data     = document.getElementById('data').value   || '—';
  var total    = document.getElementById('totalDiario').textContent || '0';
  var obs      = document.getElementById('observacoes').value || '';

  // ── Recolher dados da tabela de países ───────────────────
  var linhasPaises = '';
  document.querySelectorAll('#tabelaPaises tr').forEach(function(tr) {
    var inp = tr.querySelector('.pais-input');
    var v   = inp ? (parseInt(inp.value, 10) || 0) : 0;
    if (v > 0) {
      var nome = inp.dataset.pais || '';
      linhasPaises += '<tr><td>' + nome + '</td><td class="num">' + v + '</td></tr>';
    }
  });
  if (!linhasPaises) linhasPaises = '<tr><td colspan="2" class="vazio">Sem registos</td></tr>';

  // ── Recolher operadores ──────────────────────────────────
  var linhasOp = '';
  document.querySelectorAll('#tabelaOperadores tr').forEach(function(tr) {
    var nome = (tr.querySelector('.op-nome') || {}).value || '';
    var tot  = (tr.querySelector('.op-total') || {}).value || '';
    // Serializar nacionalidades
    var nacs = [];
    tr.querySelectorAll('.op-nac-linha').forEach(function(l) {
      var p = (l.querySelector('.op-nac-select') || {}).value || '';
      var n = parseInt((l.querySelector('.op-nac-num') || {}).value, 10) || 0;
      if (p && n > 0) nacs.push(p + ': ' + n);
    });
    if (nome) {
      linhasOp += '<tr><td>' + nome + '</td><td>' + (nacs.join(', ') || '—') + '</td><td class="num">' + (tot || '0') + '</td></tr>';
    }
  });
  if (!linhasOp) linhasOp = '<tr><td colspan="3" class="vazio">Sem registos</td></tr>';

  // ── Recolher sugestões ───────────────────────────────────
  var linhasSug = '';
  document.querySelectorAll('#tabelaSugestoes tr').forEach(function(tr) {
    var txt = (tr.querySelector('.sug-texto') || {}).value || '';
    var nac = (tr.querySelector('.sug-nac') || {}).value   || '';
    if (txt) linhasSug += '<tr><td>' + txt + '</td><td>' + (nac || '—') + '</td></tr>';
  });
  if (!linhasSug) linhasSug = '<tr><td colspan="2" class="vazio">Sem registos</td></tr>';

  var dataHoje = new Date().toLocaleDateString('pt-PT');
  var horaAgora = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  var html = '<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">' +
    '<title>Registo Diário de Nacionalidades — ' + data + '</title>' +
    '<style>' +
      'body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 0; }' +
      '.pagina { width: 100%; min-height: 100vh; padding: 18mm 15mm; box-sizing: border-box; page-break-after: always; }' +
      '.pagina:last-child { page-break-after: auto; }' +
      '.cabecalho { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #8B4A2B; padding-bottom: 10px; margin-bottom: 14px; }' +
      '.cabecalho img { height: 48px; }' +
      '.cabecalho-texto h1 { font-size: 13pt; color: #8B4A2B; margin: 0; }' +
      '.cabecalho-texto p  { font-size: 9pt; color: #666; margin: 2px 0 0; }' +
      '.meta { display: flex; gap: 24px; background: #f5ebe0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 10pt; }' +
      '.meta strong { color: #8B4A2B; }' +
      'h2 { font-size: 11pt; color: #8B4A2B; border-bottom: 1px solid #e8e0d5; padding-bottom: 4px; margin: 14px 0 8px; }' +
      'table { width: 100%; border-collapse: collapse; font-size: 10pt; }' +
      'th { background: #8B4A2B; color: white; padding: 5px 8px; text-align: left; font-weight: 600; }' +
      'td { padding: 4px 8px; border-bottom: 1px solid #e8e0d5; }' +
      'tr:nth-child(even) td { background: #faf5ef; }' +
      'td.num { text-align: right; font-weight: 600; width: 60px; }' +
      'td.vazio { color: #999; font-style: italic; text-align: center; padding: 10px; }' +
      '.total-linha { background: #8B4A2B !important; color: white; font-weight: 700; }' +
      '.total-linha td { color: white; font-weight: 700; border: none; }' +
      '.aviso { border: 2px solid #c0392b; border-radius: 6px; padding: 10px 14px; margin-top: 20px; background: #fdf0ee; }' +
      '.aviso strong { color: #c0392b; display: block; margin-bottom: 4px; }' +
      '.aviso p { font-size: 9.5pt; color: #444; margin: 0; }' +
      '.rodape-pdf { margin-top: 20px; font-size: 8pt; color: #999; text-align: center; border-top: 1px solid #e8e0d5; padding-top: 8px; }' +
      '.obs-bloco { background: #f9f9f9; border: 1px solid #e8e0d5; border-radius: 6px; padding: 10px 12px; font-size: 10pt; min-height: 60px; }' +
      '@media print { @page { size: A4; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }' +
    '</style></head><body>' +

    // ── PÁGINA 1: Países ─────────────────────────────────────
    '<div class="pagina">' +
      '<div class="cabecalho">' +
        '<div class="cabecalho-texto">' +
          '<h1>Registo Diário de Nacionalidades</h1>' +
          '<p>Município de Reguengos de Monsaraz — Serviços de Turismo</p>' +
        '</div>' +
      '</div>' +
      '<div class="meta">' +
        '<span><strong>Local:</strong> ' + local + '</span>' +
        '<span><strong>Data do registo:</strong> ' + data + '</span>' +
        '<span><strong>Impresso em:</strong> ' + dataHoje + ' ' + horaAgora + '</span>' +
      '</div>' +
      '<h2>Países — Turistas e Visitantes</h2>' +
      '<table>' +
        '<thead><tr><th>País</th><th style="text-align:right;width:80px">Visitantes</th></tr></thead>' +
        '<tbody>' + linhasPaises + '</tbody>' +
        '<tfoot><tr class="total-linha"><td>TOTAL</td><td class="num">' + total + '</td></tr></tfoot>' +
      '</table>' +
      '<div class="aviso">' +
        '<strong>⚠ Formulário impresso sem ligação à Internet</strong>' +
        '<p>Os dados acima foram preenchidos localmente. Assim que a ligação for restabelecida, insira estes valores na aplicação em <strong>' + window.location.host + '</strong> para garantir o registo correcto na base de dados.</p>' +
      '</div>' +
      '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 1/2</div>' +
    '</div>' +

    // ── PÁGINA 2: Operadores, Sugestões, Observações ─────────
    '<div class="pagina">' +
      '<div class="cabecalho">' +
        '<div class="cabecalho-texto">' +
          '<h1>Registo Diário de Nacionalidades</h1>' +
          '<p>Município de Reguengos de Monsaraz — Serviços de Turismo · ' + local + ' · ' + data + '</p>' +
        '</div>' +
      '</div>' +
      '<h2>Operadores e Agências</h2>' +
      '<table>' +
        '<thead><tr><th>Operador / Agência</th><th>Nacionalidades</th><th style="text-align:right;width:60px">Total</th></tr></thead>' +
        '<tbody>' + linhasOp + '</tbody>' +
      '</table>' +
      '<h2>Sugestões e Críticas</h2>' +
      '<table>' +
        '<thead><tr><th>Sugestão / Crítica</th><th style="width:140px">Nacionalidade</th></tr></thead>' +
        '<tbody>' + linhasSug + '</tbody>' +
      '</table>' +
      '<h2>Outras Observações</h2>' +
      '<div class="obs-bloco">' + (obs || '<em style="color:#999">Sem observações</em>') + '</div>' +
      '<div class="aviso" style="margin-top:16px">' +
        '<strong>⚠ Lembrete — inserir dados na aplicação</strong>' +
        '<p>Após restabelecimento da Internet, aceda a <strong>' + window.location.host + '</strong> e insira os dados deste formulário para o local <strong>' + local + '</strong> e data <strong>' + data + '</strong>.</p>' +
      '</div>' +
      '<div class="rodape-pdf">Registo Diário de Nacionalidades · Município de Reguengos de Monsaraz · Página 2/2</div>' +
    '</div>' +

    '</body></html>';

  var janela = window.open('', '_blank');
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(function() { janela.print(); }, 600);
}
