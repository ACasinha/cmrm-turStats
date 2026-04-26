// ============================================================
// app.js — Lógica principal da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

let nomeFuncionarioAtual  = '';
let verificacaoTimer      = null;
let ultimoLocalVerificado = '';
let ultimaDataVerificada  = '';
let unsubscribeAuth       = null;   // referência ao observador Firebase

// ============================================================
// OBSERVADOR DE AUTENTICAÇÃO FIREBASE
//
// Usado APENAS para restaurar sessão ao recarregar a página.
// O login novo é tratado diretamente no onSuccess do fazerLogin().
// Isto evita que o botão fique preso em "A autenticar..." caso
// o observador dispare com delay ou não dispare.
// ============================================================

let sessaoRestaurada = false;   // evitar activarApp() duplo

document.addEventListener('DOMContentLoaded', () => {
  // Usar a firebaseAuthPronto definida em api.js — resolve uma única
  // vez quando o Firebase termina de verificar o estado inicial.
  // Evita o problema de onAuthStateChanged disparar com null antes
  // de o estado estar pronto.
  firebaseAuthPronto.then(user => {
    if (user && !sessaoRestaurada) {
      // Sessão existente restaurada (reload da página)
      nomeFuncionarioAtual = user.displayName || user.email;
      activarApp();
    } else if (!user) {
      mostrarEcraLogin();
    }
  });
});

// ============================================================
// LOGIN / LOGOUT
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

  apiAutenticar(
    email, pass,
    function onSuccess(resp) {
      // Activar a app diretamente aqui — não esperar pelo observador,
      // que pode disparar com delay ou não disparar se o domínio
      // não estiver ainda autorizado no Firebase.
      btn.disabled    = false;
      btn.textContent = 'Entrar →';
      sessaoRestaurada = true;   // impedir que o observador chame activarApp() de novo
      nomeFuncionarioAtual = resp.nomeFuncionario || resp.email;
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

function fazerLogout() {
  if (!confirm('Deseja terminar a sessão?')) return;

  apiLogout().then(() => {
    // O observador onAuthStateChanged chama mostrarEcraLogin() automaticamente
    nomeFuncionarioAtual  = '';
    ultimoLocalVerificado = '';
    ultimaDataVerificada  = '';
    limparFormularioParcial();
    mostrarBanner('', '');
  });
}

function activarApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('headerNomeFuncionario').textContent  = nomeFuncionarioAtual;
  document.getElementById('nomeFuncionarioDisplay').textContent = nomeFuncionarioAtual;

  // Inicializar só se as tabelas ainda não existirem
  if (!document.querySelector('.pais-input')) {
    inicializarApp();
  }
}

function mostrarEcraLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginPass').value = '';

  // Limpar estado visual
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
      // Reset do estado para permitir nova tentativa ao mudar local/data
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
  // funcionario é preenchido no backend com o email Firebase (não confiamos no cliente)

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
    // Nota: funcionario é preenchido no Code.gs com o email Firebase verificado
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
