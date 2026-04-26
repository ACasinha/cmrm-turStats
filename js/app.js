// ============================================================
// app.js — Lógica principal da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

let nomeFuncionarioAtual  = '';
let verificacaoTimer      = null;
let ultimoLocalVerificado = '';
let ultimaDataVerificada  = '';
let appInicializada       = false;

// ============================================================
// ARRANQUE — verificar sessão existente ao carregar a página
//
// Não usamos onAuthStateChanged para controlar o fluxo de login.
// Usamos apenas para detetar logout externo (token revogado,
// expiração do Firebase) e expulsão após 10h.
//
// O fluxo é simples:
//   - Ao carregar: verificar se currentUser existe → activar ou mostrar login
//   - Ao fazer login: activar diretamente no onSuccess
//   - Ao fazer logout: mostrar login diretamente
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // O Firebase pode demorar um momento a restaurar a sessão do
  // localStorage após um reload. Aguardamos pela primeira emissão
  // do onAuthStateChanged que nos diz o estado real.
  const unsub = firebaseAuth.onAuthStateChanged(user => {
    unsub(); // desligar após o primeiro disparo — só queremos o estado inicial

    if (user && sessaoValida()) {
      nomeFuncionarioAtual = user.displayName || user.email;
      activarApp();
    } else {
      if (user) {
        // Há utilizador Firebase mas a nossa sessão de 10h expirou
        apiLogout();
      }
      mostrarEcraLogin();
    }
  });

  // Observador contínuo apenas para detetar logout externo
  // (token revogado pelo admin, expiração Firebase)
  firebaseAuth.onAuthStateChanged(user => {
    if (!user && appInicializada) {
      // Sessão terminou externamente — voltar ao login
      limparSessao();
      appInicializada = false;
      mostrarEcraLogin();
      mostrarToast('Sessão terminada. Por favor faça login novamente.', 'info');
    }
  });
});

// ============================================================
// LOGIN
// ============================================================

function fazerLogin() {
  const email = document.getElementById('loginUser').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const erro  = document.getElementById('loginErro');
  const btn   = document.getElementById('btnLogin');

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
      activarApp();  // ← activar directamente, sem depender do observador
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
  apiLogout().then(() => mostrarEcraLogin());
}

// ============================================================
// ACTIVAR / MOSTRAR LOGIN
// ============================================================

function activarApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerNomeFuncionario').textContent  = nomeFuncionarioAtual;
  document.getElementById('nomeFuncionarioDisplay').textContent = nomeFuncionarioAtual;

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
  const local = document.getElementById('local').value.trim();
  const data  = document.getElementById('data').value;
  if (!local || !data) return;
  if (local === ultimoLocalVerificado && data === ultimaDataVerificada) return;

  ultimoLocalVerificado = local;
  ultimaDataVerificada  = data;
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
        mostrarBanner('carregado', '🔄 Dados anteriores carregados. Alterações serão atualizadas ao guardar.');
        mostrarToast('✓ Dados anteriores carregados.', 'info');
      } else {
        limparFormularioParcial();
        mostrarBanner('novo', '✨ Nenhum registo encontrado. Novo registo.');
      }
    },
    function onFailure(err) {
      ultimoLocalVerificado = '';
      ultimaDataVerificada  = '';
      mostrarBanner('', '');
      mostrarToast('Erro ao verificar dados: ' + err.message, 'erro');
    }
  );
}

// ============================================================
// GUARDAR REGISTO
// ============================================================

function guardarDados() {
  const local       = document.getElementById('local').value.trim();
  const data        = document.getElementById('data').value;
  const observacoes = document.getElementById('observacoes').value;

  if (!local) {
    mostrarToast('Por favor, indique o local/posto.', 'erro');
    document.getElementById('local').focus();
    return;
  }
  if (!data) {
    mostrarToast('Por favor, selecione a data.', 'erro');
    return;
  }

  const paises = {};
  document.querySelectorAll('.pais-input').forEach(inp => {
    const v = parseInt(inp.value, 10) || 0;
    if (v > 0) paises[inp.dataset.pais] = v;
  });

  const operadores = recolherOperadores();
  const sugestoes  = recolherSugestoes();

  if (!Object.keys(paises).length && !operadores.length && !sugestoes.length) {
    mostrarToast('Não há dados para guardar.', 'erro');
    return;
  }

  const btn = document.getElementById('btnGuardar');
  btn.disabled    = true;
  btn.textContent = '⏳ A guardar...';
  mostrarToast('A guardar...', 'info');

  apiGuardarRegisto(
    { data, local, paises, operadores, sugestoes, observacoes },
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = '💾 Guardar Registo';
      if (resp.sucesso) {
        mostrarToast('✓ ' + resp.mensagem, 'sucesso');
        mostrarBanner('carregado', '✅ Registo guardado com sucesso.');
        document.querySelectorAll('.pais-input').forEach(inp => {
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
