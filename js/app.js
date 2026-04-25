// ============================================================
// app.js — Lógica principal da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

// ============================================================
// ESTADO DA APLICAÇÃO
// ============================================================

let nomeFuncionarioAtual  = '';
let verificacaoTimer      = null;
let ultimoLocalVerificado = '';
let ultimaDataVerificada  = '';

// ============================================================
// LOGIN / LOGOUT
// ============================================================

/**
 * Lê os campos de login e autentica via api.js.
 */
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
    user,
    pass,
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

/**
 * Termina a sessão atual e regressa ao ecrã de login.
 */
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

/**
 * Ativa a app após login bem-sucedido (esconde login, preenche nome).
 */
function activarApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerNomeFuncionario').textContent = nomeFuncionarioAtual;
  document.getElementById('nomeFuncionarioDisplay').textContent = nomeFuncionarioAtual;
  inicializarApp();
}

// Verificar sessão guardada ao carregar a página
(function verificarSessaoGuardada() {
  const saved = sessionStorage.getItem('rmz_user');
  if (!saved) return;

  try {
    const r = JSON.parse(saved);
    if (r.sucesso && r.nomeFuncionario) {
      nomeFuncionarioAtual = r.nomeFuncionario;
      activarApp();
    }
  } catch (_) {
    // JSON inválido — ignorar
  }
})();

// ============================================================
// INICIALIZAÇÃO
// ============================================================

/**
 * Inicializa o formulário com a data de hoje e constrói as tabelas.
 */
function inicializarApp() {
  document.getElementById('data').valueAsDate = new Date();
  construirTabelaPaises();
  construirTabelaOperadores(NUM_LINHAS_OP);
  construirTabelaSugestoes(NUM_LINHAS_SUG);
}

// ============================================================
// VERIFICAÇÃO AUTOMÁTICA (ao mudar local/data)
// ============================================================

/**
 * Debounce — agenda a verificação 600 ms após o último evento.
 * Chamado pelos eventos onchange do select e do input de data.
 */
function agendarVerificacao() {
  clearTimeout(verificacaoTimer);
  verificacaoTimer = setTimeout(verificarDados, 600);
}

/**
 * Verifica se existem dados para o local/data selecionados.
 * Se sim, carrega-os; se não, limpa o formulário.
 */
function verificarDados() {
  const local = document.getElementById('local').value.trim();
  const data  = document.getElementById('data').value;

  if (!local || !data) return;

  // Evitar verificação duplicada para o mesmo local/data
  if (local === ultimoLocalVerificado && data === ultimaDataVerificada) return;
  ultimoLocalVerificado = local;
  ultimaDataVerificada  = data;

  mostrarBanner('verificando', '⏳ A verificar dados existentes...');

  apiVerificarDados(
    local,
    data,
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

/**
 * Valida e envia o formulário para o backend via api.js.
 */
function guardarDados() {
  const local       = document.getElementById('local').value.trim();
  const data        = document.getElementById('data').value;
  const observacoes = document.getElementById('observacoes').value;
  const funcionario = nomeFuncionarioAtual;

  // Validação
  if (!local) {
    mostrarToast('Por favor, indique o local/posto.', 'erro');
    document.getElementById('local').focus();
    return;
  }
  if (!data) {
    mostrarToast('Por favor, selecione a data.', 'erro');
    return;
  }

  // Recolha de dados
  const paises = {};
  document.querySelectorAll('.pais-input').forEach(inp => {
    const v = parseInt(inp.value, 10) || 0;
    if (v > 0) paises[inp.dataset.pais] = v;
  });

  const operadores = recolherOperadores();
  const sugestoes  = recolherSugestoes();

  if (
    Object.keys(paises).length === 0 &&
    operadores.length === 0 &&
    sugestoes.length === 0
  ) {
    mostrarToast('Não há dados para guardar.', 'erro');
    return;
  }

  // Envio
  const btn = document.getElementById('btnGuardar');
  btn.disabled    = true;
  btn.textContent = '⏳ A guardar...';
  mostrarToast('A guardar...', 'info');

  const payload = {
    data,
    local,
    paises,
    operadores,
    sugestoes,
    observacoes,
    funcionario,
    verificador: ''
  };

  apiGuardarRegisto(
    payload,
    function onSuccess(resp) {
      btn.disabled    = false;
      btn.textContent = '💾 Guardar Registo';

      if (resp.sucesso) {
        mostrarToast('✓ ' + resp.mensagem, 'sucesso');
        mostrarBanner('carregado', '✅ Registo guardado com sucesso.');

        // Marca os inputs preenchidos como "carregados"
        document.querySelectorAll('.pais-input').forEach(inp => {
          if ((parseInt(inp.value, 10) || 0) > 0) {
            inp.classList.add('input-carregado');
          }
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
