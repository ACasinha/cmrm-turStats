// ============================================================
// app.js — Lógica da página principal (index.html)
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Responsabilidade:
//   • Arrancar a aplicação após login válido (activarApp)
//   • Verificar/carregar dados do dia (verificarDados)
//   • Guardar registo (guardarDados)
//   • Bloquear/desbloquear formulário
//
// NÃO contém: Firebase init, JWT, sessão (auth.js),
// UI de login (login.js), construção de tabelas (ui.js).
// ============================================================

'use strict';

// ── Estado da página ─────────────────────────────────────────

var verificacaoTimer      = null;
var ultimoLocalVerificado = '';
var ultimaDataVerificada  = '';
var _perfilAtual          = null;
var _isAdmin              = false;
var appInicializada       = false;
var dadosAlterados        = false;

// Tri-estado: null = desconhecido, true = pode editar, false = bloqueado
var edicaoPermitida = null;

// ── Aviso de dados por guardar ───────────────────────────────

window.addEventListener('beforeunload', function (e) {
  if (dadosAlterados) {
    e.preventDefault();
    e.returnValue = 'Tem dados por guardar. Tem a certeza que quer sair?';
    return e.returnValue;
  }
});

// ============================================================
// ARRANQUE — delegado em login.js + auth.js
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  inicializarLogin({
    idWrap:            null,     // index.html não tem um wrap único
    verificarAcesso:   function (perfil) {
      return perfil.role === 'administrador' || perfil.role === 'utilizador';
    },
    mensagemSemAcesso: 'Esta conta não tem acesso à aplicação. Contacte o administrador.',
    onSucesso:         function (perfil) {
      _perfilAtual = perfil;
      _isAdmin     = perfil.role === 'administrador';
      activarApp(perfil);
    },
    onSessaoTerminada: function () {
      appInicializada       = false;
      dadosAlterados        = false;
      ultimoLocalVerificado = '';
      ultimaDataVerificada  = '';
      mostrarBanner('', '');
    }
  });
});

// ============================================================
// NAVEGAÇÃO
// ============================================================

function irParaAdmin()     { window.location.href = 'admin.html'; }
function irParaDashboard() { window.location.href = 'dashboard.html'; }
function irParaEditor()    { window.location.href = 'editor.html'; }

// ============================================================
// ACTIVAR APP — chamado por login.js após autenticação válida
// ============================================================

function activarApp(perfil) {
  var elNome = document.getElementById('headerNomeFuncionario');
  if (elNome) elNome.textContent = perfil.nome || perfil.email || '—';

  if (typeof construirMenuNav === 'function') construirMenuNav(perfil);

  if (!appInicializada) {
    _inicializarFormulario();
    appInicializada = true;
  }
}

// ============================================================
// INICIALIZAÇÃO DO FORMULÁRIO
// Chamado uma única vez após o primeiro login bem-sucedido.
// ============================================================

function _inicializarFormulario() {
  document.getElementById('data').valueAsDate = new Date();
  construirTabelaPaises();
  construirTabelaOperadores(NUM_LINHAS_OP);
  construirTabelaSugestoes(NUM_LINHAS_SUG);

  // Observações
  document.getElementById('observacoes').addEventListener('input', function () {
    if (!verificarLocalEscolhido()) { this.value = ''; return; }
    dadosAlterados = true;
  });

  // Inputs de operadores e sugestões (delegação de eventos)
  document.querySelector('.container').addEventListener('input', function (e) {
    var alvo = e.target;
    if (alvo.classList.contains('op-nome') || alvo.classList.contains('sug-nac')) {
      if (!verificarLocalEscolhido()) {
        alvo.value = '';
      } else {
        sinalizarAlteracao();
      }
    }
  });
}

// ============================================================
// VERIFICAÇÃO AUTOMÁTICA — agendada ao mudar local ou data
// ============================================================

function agendarVerificacao() {
  // Resetar estado para forçar nova verificação
  ultimoLocalVerificado = '';
  ultimaDataVerificada  = '';

  if (typeof construirTabelaPaises === 'function') construirTabelaPaises();

  clearTimeout(verificacaoTimer);
  verificacaoTimer = setTimeout(verificarDados, 600);
}

function verificarLocalEscolhido() {
  var local = document.getElementById('local').value.trim();
  if (!local) {
    mostrarToast('Por favor escolha primeiro o Local / Posto.', 'erro');
    document.getElementById('local').focus();
    return false;
  }
  return true;
}

function verificarDados() {
  var local = document.getElementById('local').value.trim();
  var data  = document.getElementById('data').value;

  if (!local || !data) return;

  // Evitar chamadas duplicadas para o mesmo local+data
  if (local === ultimoLocalVerificado && data === ultimaDataVerificada) return;

  ultimoLocalVerificado = local;
  ultimaDataVerificada  = data;
  edicaoPermitida       = null;

  bloquearFormulario(false);
  document.getElementById('btnGuardar').disabled = false;
  mostrarBanner('verificando', '⏳ A verificar dados existentes...');

  var partes        = data.split('-');
  var dataFormatada = partes[2] + '/' + partes[1] + '/' + partes[0];

  apiVerificarDados(
    local,
    dataFormatada,
    function onSuccess(resp) {
      if (!resp.sucesso) {
        mostrarBanner('', '');
        mostrarToast('Erro: ' + resp.mensagem, 'erro');
        return;
      }

      if (resp.existe) {
        carregarDados(resp);

        var hoje      = new Date();
        var hojeStr   = hoje.getFullYear() + '-' +
                        String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
                        String(hoje.getDate()).padStart(2, '0');
        var dataRegisto = document.getElementById('data').value;

        edicaoPermitida = (dataRegisto === hojeStr);

        if (edicaoPermitida) {
          mostrarBanner('carregado', '🔄 Dados de hoje carregados. Pode editar e guardar.');
          mostrarToast('✓ Dados carregados. Edição permitida.', 'info');
          document.getElementById('btnGuardar').disabled = false;
        } else {
          mostrarBanner(
            'bloqueado',
            '🔒 Dados de ' + dataRegisto + ' carregados. Não é possível editar registos de dias anteriores.'
          );
          mostrarToast('Edição bloqueada — registo de dia anterior.', 'erro');
          document.getElementById('btnGuardar').disabled = true;
          bloquearFormulario(true);
        }
      } else {
        edicaoPermitida = null;
        limparFormularioParcial();
        mostrarBanner('novo', '✨ Nenhum registo encontrado. Novo registo.');
        mostrarToast('✨ Novo registo.', 'sucesso');
        document.getElementById('btnGuardar').disabled = false;
        bloquearFormulario(false);
      }
    },
    function onFailure(err) {
      // Resetar para que a próxima interacção dispare nova verificação
      ultimoLocalVerificado = '';
      ultimaDataVerificada  = '';
      mostrarBanner('', '');
      mostrarToast('Erro: ' + err.message, 'erro');
    }
  );
}

// ============================================================
// GUARDAR REGISTO
// ============================================================

function sinalizarAlteracao() {
  dadosAlterados = true;
}

function guardarDados() {
  var local       = document.getElementById('local').value.trim();
  var data        = document.getElementById('data').value;
  var observacoes = document.getElementById('observacoes').value;

  if (!local) {
    mostrarToast('Por favor indique o local/posto.', 'erro');
    document.getElementById('local').focus();
    return;
  }
  if (!data) {
    mostrarToast('Por favor selecione a data.', 'erro');
    return;
  }
  if (edicaoPermitida === false) {
    mostrarToast('Não é possível editar registos de dias anteriores.', 'erro');
    return;
  }

  // Recolher países com valor > 0
  var paises = {};
  document.querySelectorAll('.pais-input').forEach(function (inp) {
    var v = parseInt(inp.value, 10) || 0;
    if (v > 0) paises[inp.dataset.pais] = v;
  });

  var operadores = recolherOperadores();
  var sugestoes  = recolherSugestoes();

  if (!Object.keys(paises).length && !operadores.length && !sugestoes.length) {
    mostrarToast('Não há dados para guardar.', 'erro');
    return;
  }

  var btn = document.getElementById('btnGuardar');
  btn.disabled    = true;
  btn.textContent = '⏳ A guardar...';
  mostrarToast('A guardar...', 'info');

  var partes        = data.split('-');
  var dataFormatada = partes[2] + '/' + partes[1] + '/' + partes[0];

  apiGuardarRegisto(
    {
      data:        dataFormatada,
      local:       local,
      paises:      paises,
      operadores:  operadores,
      sugestoes:   sugestoes,
      observacoes: observacoes
    },
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = '💾 Guardar Registo';

      if (resp.sucesso) {
        dadosAlterados = false;
        mostrarToast('✓ ' + resp.mensagem, 'sucesso');
        mostrarBanner('carregado', '✅ Registo guardado com sucesso.');
        document.querySelectorAll('.pais-input').forEach(function (inp) {
          if ((parseInt(inp.value, 10) || 0) > 0) inp.classList.add('input-carregado');
        });
      } else {
        mostrarToast('✗ ' + resp.mensagem, 'erro');
      }
    },
    function onFailure(err) {
      btn.disabled    = false;
      btn.textContent = '💾 Guardar Registo';
      mostrarToast('Erro: ' + err.message, 'erro');
    }
  );
}

// ============================================================
// BLOQUEAR / DESBLOQUEAR FORMULÁRIO
// ============================================================

function bloquearFormulario(bloquear) {
  var d = bloquear;
  document.querySelectorAll('.pais-input').forEach(function (i)  { i.disabled = d; });
  document.querySelectorAll('.btn-stepper').forEach(function (b)  { b.disabled = d; });
  document.querySelectorAll('.op-nome, .op-total').forEach(function (i) { i.disabled = d; });
  document.querySelectorAll('.op-nac-select, .op-nac-num').forEach(function (i) { i.disabled = d; });
  document.querySelectorAll('.btn-add-nac, .btn-rem-nac').forEach(function (b) { b.disabled = d; });
  document.querySelectorAll('.sug-texto, .sug-nac').forEach(function (i) { i.disabled = d; });
  var obsEl = document.getElementById('observacoes');
  if (obsEl) obsEl.disabled = d;
}

// ============================================================
// LOGOUT — exposto ao HTML via botão
// Delega em login.js que delega em auth.js.
// ============================================================

function fazerLogout() {
  logout(dadosAlterados);
}
