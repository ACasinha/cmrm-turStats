// ============================================================
// app.js — Lógica principal da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var nomeFuncionarioAtual  = '';
var verificacaoTimer      = null;
var ultimoLocalVerificado = '';
var ultimaDataVerificada  = '';
var appInicializada       = false;
// Estado de edição:
//   null  → sem dados existentes (novo registo)
//   false → dados existentes mas de outro dia (bloqueado)
//   true  → dados existentes do próprio dia (permitido editar)
var edicaoPermitida       = null;

// ============================================================
// ARRANQUE
//
// Usamos um único onAuthStateChanged para determinar o estado
// inicial. Após o primeiro disparo, desligamo-lo e registamos
// um segundo observador mais simples apenas para logout externo.
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  // Passo 1: determinar estado inicial (sessão existente ou não)
  var unsubInicial = firebaseAuth.onAuthStateChanged(function(user) {
    unsubInicial(); // disparar apenas uma vez

    if (user && sessaoValida()) {
      nomeFuncionarioAtual = user.displayName || user.email;
      activarApp();
    } else {
      if (user) apiLogout(); // sessão Firebase existe mas as 10h expiraram
      mostrarEcraLogin();
    }

    // Passo 2: após estado inicial resolvido, observar apenas
    // logout externo (token revogado, signOut noutro separador)
    firebaseAuth.onAuthStateChanged(function(u) {
      if (!u && appInicializada) {
        limparSessao();
        appInicializada = false;
        mostrarBanner('', '');
        mostrarEcraLogin();
        mostrarToast('Sessão terminada. Por favor faça login novamente.', 'info');
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

  btn.disabled    = true;
  btn.textContent = 'A autenticar...';
  erro.classList.remove('visivel');

  apiAutenticar(email, pass,
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = 'Entrar →';
      nomeFuncionarioAtual = resp.nomeFuncionario;
      activarApp();
    },
    function onFailure(err) {
      btn.disabled    = false;
      btn.textContent = 'Entrar →';
      erro.textContent = err.message;
      erro.classList.add('visivel');
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }
  );
}

// ============================================================
// LOGOUT
// ============================================================

function fazerLogout() {
  if (!confirm('Deseja terminar a sessão?')) return;
  appInicializada = false;
  apiLogout().then(function() { mostrarEcraLogin(); });
}

// ============================================================
// ACTIVAR / MOSTRAR LOGIN
// ============================================================

function activarApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerNomeFuncionario').textContent = nomeFuncionarioAtual;
  if (!appInicializada) {
    inicializarApp();
    appInicializada = true;
  }
}

function mostrarEcraLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginErro').classList.remove('visivel');
  document.getElementById('loginPass').value = '';
  limparFormularioParcial();
  mostrarBanner('', '');
  ultimoLocalVerificado = '';
  ultimaDataVerificada  = '';
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

function inicializarApp() {
  document.getElementById('data').valueAsDate = new Date();
  construirTabelaPaises();
  construirTabelaOperadores(NUM_LINHAS_OP);
  construirTabelaSugestoes(NUM_LINHAS_SUG);
}

// ============================================================
// VERIFICAÇÃO AUTOMÁTICA (ao mudar local/data)
// ============================================================

function agendarVerificacao() {
  clearTimeout(verificacaoTimer);
  verificacaoTimer = setTimeout(verificarDados, 600);
}

function verificarDados() {
  var local = document.getElementById('local').value.trim();
  var data  = document.getElementById('data').value;
  if (!local || !data) return;
  if (local === ultimoLocalVerificado && data === ultimaDataVerificada) return;

  ultimoLocalVerificado = local;
  ultimaDataVerificada  = data;
  edicaoPermitida = null;
  bloquearFormulario(false);
  document.getElementById('btnGuardar').disabled = false;
  mostrarBanner('verificando', '⏳ A verificar dados existentes...');

  apiVerificarDados(local, data,
    function onSuccess(resp) {
      if (!resp.sucesso) {
        mostrarBanner('', '');
        mostrarToast('Erro: ' + resp.mensagem, 'erro');
        return;
      }
      if (resp.existe) {
        carregarDados(resp);

        // Comparar a data do registo com a data de hoje
        var hoje       = new Date();
        var hojeStr    = hoje.getFullYear() + '-' +
                         String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
                         String(hoje.getDate()).padStart(2, '0');
        var dataRegisto = document.getElementById('data').value;
        edicaoPermitida = (dataRegisto === hojeStr);

        if (edicaoPermitida) {
          mostrarBanner('carregado', '🔄 Dados de hoje carregados. Pode editar e guardar.');
          mostrarToast('✓ Dados carregados. Edição permitida.', 'info');
          document.getElementById('btnGuardar').disabled = false;
        } else {
          mostrarBanner('bloqueado', '🔒 Dados de ' + dataRegisto + ' carregados. Não é possível editar registos de dias anteriores.');
          mostrarToast('Edição bloqueada — registo de dia anterior.', 'erro');
          document.getElementById('btnGuardar').disabled = true;
          bloquearFormulario(true);
        }
      } else {
        edicaoPermitida = null;
        limparFormularioParcial();
        mostrarBanner('novo', '✨ Nenhum registo encontrado. Novo registo.');
        document.getElementById('btnGuardar').disabled = false;
        bloquearFormulario(false);
      }
    },
    function onFailure(err) {
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

function guardarDados() {
  var local       = document.getElementById('local').value.trim();
  var data        = document.getElementById('data').value;
  var observacoes = document.getElementById('observacoes').value;

  if (!local) {
    mostrarToast('Por favor, indique o local/posto.', 'erro');
    document.getElementById('local').focus();
    return;
  }
  if (!data) {
    mostrarToast('Por favor, selecione a data.', 'erro');
    return;
  }
  // Bloquear edição de registos de dias anteriores
  if (edicaoPermitida === false) {
    mostrarToast('Não é possível editar registos de dias anteriores.', 'erro');
    return;
  }

  var paises = {};
  document.querySelectorAll('.pais-input').forEach(function(inp) {
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

  apiGuardarRegisto(
    { data: data, local: local, paises: paises, operadores: operadores, sugestoes: sugestoes, observacoes: observacoes },
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = '💾 Guardar Registo';
      if (resp.sucesso) {
        mostrarToast('✓ ' + resp.mensagem, 'sucesso');
        mostrarBanner('carregado', '✅ Registo guardado com sucesso.');
        document.querySelectorAll('.pais-input').forEach(function(inp) {
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
  document.querySelectorAll('.pais-input').forEach(function(i){ i.disabled = d; });
  document.querySelectorAll('.btn-stepper').forEach(function(b){ b.disabled = d; });
  document.querySelectorAll('.op-nome, .op-total').forEach(function(i){ i.disabled = d; });
  document.querySelectorAll('.op-nac-select, .op-nac-num').forEach(function(i){ i.disabled = d; });
  document.querySelectorAll('.btn-add-nac, .btn-rem-nac').forEach(function(b){ b.disabled = d; });
  document.querySelectorAll('.sug-texto, .sug-nac').forEach(function(i){ i.disabled = d; });
  document.getElementById('observacoes').disabled = d;
}
