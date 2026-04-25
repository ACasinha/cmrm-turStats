// ============================================================
// app.js — Lógica principal da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

let nomeFuncionarioAtual  = '';
let verificacaoTimer      = null;
let ultimoLocalVerificado = '';
let ultimaDataVerificada  = '';

// ============================================================
// LOGIN / LOGOUT
// ============================================================

function fazerLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const erro = document.getElementById('loginErro');
  const btn  = document.getElementById('btnLogin');

  if (!user || !pass) {
    erro.textContent = 'Por favor preencha todos os campos.';
    erro.classList.add('visivel');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'A autenticar...';
  erro.classList.remove('visivel');

  apiAutenticar(
    user, pass,
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = 'Entrar →';
      if (resp.sucesso) {
        nomeFuncionarioAtual = resp.nomeFuncionario;
        sessionStorage.setItem('rmz_user', JSON.stringify(resp));
        activarApp();
      } else {
        erro.textContent = resp.mensagem || 'Credenciais inválidas.';
        erro.classList.add('visivel');
        document.getElementById('loginPass').value = '';
        document.getElementById('loginPass').focus();
      }
    },
    function onFailure(err) {
      btn.disabled    = false;
      btn.textContent = 'Entrar →';
      erro.textContent = 'Erro de ligação: ' + err.message;
      erro.classList.add('visivel');
    }
  );
}

function fazerLogout() {
  if (!confirm('Deseja terminar a sessão?')) return;
  sessionStorage.removeItem('rmz_user');
  nomeFuncionarioAtual = '';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginOverlay').classList.remove('hidden');
  limparFormularioParcial();
  mostrarBanner('', '');
  ultimoLocalVerificado = '';
  ultimaDataVerificada  = '';
}

function activarApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerNomeFuncionario').textContent  = nomeFuncionarioAtual;
  document.getElementById('nomeFuncionarioDisplay').textContent = nomeFuncionarioAtual;
  inicializarApp();
}

// Restaurar sessão ao carregar a página
(function verificarSessaoGuardada() {
  const saved = sessionStorage.getItem('rmz_user');
  if (!saved) return;
  try {
    const r = JSON.parse(saved);
    if (r.sucesso && r.nomeFuncionario) {
      nomeFuncionarioAtual = r.nomeFuncionario;
      activarApp();
    }
  } catch (_) {}
})();

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
// VERIFICAÇÃO AUTOMÁTICA
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

  apiVerificarDados(
    local, data,
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
      mostrarBanner('', '');
      mostrarToast('Erro: ' + err.message, 'erro');
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
  const funcionario = nomeFuncionarioAtual;

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
    { data, local, paises, operadores, sugestoes, observacoes, funcionario },
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
