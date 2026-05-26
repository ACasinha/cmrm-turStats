// ============================================================
// app.js — Lógica principal da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var verificacaoTimer      = null;
var ultimoLocalVerificado = '';
var ultimaDataVerificada  = '';
var appInicializada       = false;
var dadosAlterados        = false;

window.addEventListener('beforeunload', function(e) {
  if (dadosAlterados) {
    e.preventDefault();
    e.returnValue = 'Tem dados por guardar. Tem a certeza que quer sair?';
    return e.returnValue;
  }
});

var edicaoPermitida = null;

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
          _isAdmin      = perfil.role === 'administrador';
          _isUtilizador = perfil.role === 'administrador'
                       || perfil.role === 'utilizador';

          if (!_isUtilizador) {
            // Sem permissão
            document.getElementById('loginOverlay').classList.remove('hidden');
            document.getElementById('loginErro').textContent = 'Esta conta apenas tem acesso ao dashboard. Contacte o administrador.';
            document.getElementById('loginErro').classList.add('visivel');
            apiLogout();
            return;
          }
          
          // Botão admin
          if (perfil.role === 'administrador') {
            var btnAdmin = document.getElementById('btnAdmin');
            if (btnAdmin) btnAdmin.style.display = '';
          }

          // Botão dashboard
          var temDash = perfil.role === 'administrador'
                     || perfil.acessoDashboard === true;
          var btnDash = document.getElementById('btnDashboard');
          if (btnDash && temDash) btnDash.style.display = '';

          // Botão editor mensal
          var temEditor = perfil.role === 'administrador'
                       || perfil.acessoEditor === true;
          var btnEditor = document.getElementById('btnEditor');
          if (btnEditor && temEditor) btnEditor.style.display = '';
        
          activarApp(perfil);
          
        })
        .catch(function() {
          mostrarEcraLogin();
        });
    } else {
      if (user) apiLogout();
      mostrarEcraLogin();
    }

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

      obterPerfilUtilizador()
        .then(function(perfil) {
          _perfilAtual = perfil;
          _isAdmin      = perfil.role === 'administrador';
          _isUtilizador = perfil.role === 'administrador'
                       || perfil.role === 'utilizador';

          if (!perfil.ativo) {
            erro.textContent = 'Esta conta foi desativada. Contacte o administrador.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }

          if (!_isUtilizador) {
            erro.textContent = 'Esta conta não tem acesso à aplicação. Contacte o administrador.';
            erro.classList.add('visivel');
            apiLogout();
            return;
          }

          // Botão admin
          if (perfil.role === 'administrador') {
            var btnAdmin = document.getElementById('btnAdmin');
            if (btnAdmin) btnAdmin.style.display = '';
          }

          // Botão dashboard
          var temDash = perfil.role === 'administrador'
                     || perfil.acessoDashboard === true;
          var btnDash = document.getElementById('btnDashboard');
          if (btnDash && temDash) btnDash.style.display = '';

          // Botão editor mensal
          var temEditor = perfil.role === 'administrador'
                       || perfil.acessoEditor === true;
          var btnEditor = document.getElementById('btnEditor');
          if (btnEditor && temEditor) btnEditor.style.display = '';

          activarApp(perfil);
        })
        .catch(function(err) {
          console.error('[Perfil] Erro ao carregar:', err);
          activarApp(perfil);
        });
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
  limparCacheUtilizador();
  apiLogout().then(function() { mostrarEcraLogin(); });
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function irParaAdmin()     { window.location.href = 'admin.html'; }
function irParaDashboard() { window.location.href = 'dashboard.html'; }
function irParaEditor()    { window.location.href = 'editor.html'; }

// ============================================================
// ACTIVAR / MOSTRAR LOGIN
// ============================================================

function activarApp(perfil) {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerNomeFuncionario').textContent =
    perfil.nome || perfil.email || '—';
  if (!appInicializada) {
    inicializarApp();
    appInicializada = true;
  }
}

function mostrarEcraLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginErro').classList.remove('visivel');
  document.getElementById('loginPass').value = '';

  var btnAdmin = document.getElementById('btnAdmin');
  if (btnAdmin) btnAdmin.style.display = 'none';

  var btnDashboard = document.getElementById('btnDashboard');
  if (btnDashboard) btnDashboard.style.display = 'none';

  var btnEditor = document.getElementById('btnEditor');
  if (btnEditor) btnEditor.style.display = 'none';

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
  document.getElementById('observacoes').addEventListener('input', function() {
    if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
      this.value = '';
      return;
    }
    dadosAlterados = true;
  });
  document.querySelector('.container').addEventListener('input', function(e) {
    var alvo = e.target;
    if (alvo.classList.contains('op-nome') || alvo.classList.contains('sug-nac')) {
      if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
        alvo.value = '';
      } else if (typeof sinalizarAlteracao === 'function') {
        sinalizarAlteracao();
      }
    }
  });
}

// ============================================================
// VERIFICAÇÃO AUTOMÁTICA
// ============================================================

function agendarVerificacao() {
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
  if (local === ultimoLocalVerificado && data === ultimaDataVerificada) return;

  ultimoLocalVerificado = local;
  ultimaDataVerificada  = data;
  edicaoPermitida = null;
  bloquearFormulario(false);
  document.getElementById('btnGuardar').disabled = false;
  mostrarBanner('verificando', '⏳ A verificar dados existentes...');

  var partes = data.split('-');
  var dataFormatada = partes[2] + '/' + partes[1] + '/' + partes[0];

  apiVerificarDados(local, dataFormatada,
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
          mostrarBanner('bloqueado', '🔒 Dados de ' + dataRegisto + ' carregados. Não é possível editar registos de dias anteriores.');
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
    mostrarToast('Por favor, indique o local/posto.', 'erro');
    document.getElementById('local').focus();
    return;
  }
  if (!data) {
    mostrarToast('Por favor, selecione a data.', 'erro');
    return;
  }
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

  var partes = data.split('-');
  var dataFormatada = partes[2] + '/' + partes[1] + '/' + partes[0];

  apiGuardarRegisto(
    { data: dataFormatada, local: local, paises: paises,
      operadores: operadores, sugestoes: sugestoes, observacoes: observacoes },
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = '💾 Guardar Registo';
      if (resp.sucesso) {
        dadosAlterados = false;
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
