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
var dadosAlterados        = false;  // true se houver dados não guardados

// Lembrete ao fechar/sair da página com dados por guardar
window.addEventListener('beforeunload', function(e) {
  if (dadosAlterados) {
    e.preventDefault();
    e.returnValue = 'Tem dados por guardar. Tem a certeza que quer sair?';
    return e.returnValue;
  }
});
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
    verificarRoleAdmin();
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
  // Observar alterações na textarea de observações
  document.getElementById('observacoes').addEventListener('input', function() {
    if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
      this.value = '';
      return;
    }
    dadosAlterados = true;
  });
  // Observar o formulário completo para qualquer input/change
  document.getElementById('local').addEventListener('change', function() {
    dadosAlterados = false; // ao mudar local, os dados são recarregados — reset
  });
  // Obrigatoriedade de local em campos de texto livres (operadores e sugestões)
  // via delegação no contentor principal
  document.querySelector('.container').addEventListener('input', function(e) {
    var alvo = e.target;
    // Apenas inputs de texto que não são já guardados pelo atualizarTotais/guardaLocalERecalcula
    if (alvo.classList.contains('op-nome') || alvo.classList.contains('sug-nac')) {
      if (typeof verificarLocalEscolhido === 'function' && !verificarLocalEscolhido()) {
        alvo.value = '';
      } else if (typeof sinalizarAlteracao === 'function') {
        sinalizarAlteracao();
      }
    }
  });
  document.getElementById('data').addEventListener('change', function() {
    dadosAlterados = false; // ao mudar data, idem
  });
}

// ============================================================
// VERIFICAÇÃO AUTOMÁTICA (ao mudar local/data)
// ============================================================

function agendarVerificacao() {
  // Reconstruir tabela de países ao mudar local (adapta modo detalhado/simplificado)
  if (typeof construirTabelaPaises === 'function') construirTabelaPaises();
  clearTimeout(verificacaoTimer);
  verificacaoTimer = setTimeout(verificarDados, 600);
}

// Verificar se local foi escolhido antes de permitir edição
// Chamada pelos inputs da tabela de países e demais campos via oninput/onclick
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

// Chamada pelo ui.js para sinalizar alterações
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

// ============================================================
// SISTEMA DE ADMINISTRAÇÃO
// ============================================================

// Verificar role de admin após login bem-sucedido
function verificarRoleAdmin() {
  var user = firebaseAuth.currentUser;
  if (!user) return;

  utilizadorUid = user.uid;

  verificarSeEhAdmin(user.uid).then(function(ehAdmin) {
    if (ehAdmin) {
      document.getElementById('btnAdmin').style.display = 'inline-block';
      mostrarToast('Bem-vindo, Administrador!', 'sucesso');
    } else {
      document.getElementById('btnAdmin').style.display = 'none';
    }
  });
}

function abrirAreaAdmin() {
  if (!utilizadorEhAdmin) {
    mostrarToast('Acesso negado. Apenas administradores podem aceder.', 'erro');
    return;
  }
  document.getElementById('adminPanel').style.display = 'block';
  mudarAbaPainel('utilizadores');
  recarregarListaUtilizadores();
}

function fecharAreaAdmin() {
  document.getElementById('adminPanel').style.display = 'none';
}

function mudarAbaPainel(abaId) {
  // Esconder todas as abas
  document.querySelectorAll('.admin-tab-content').forEach(function(aba) {
    aba.style.display = 'none';
  });
  
  // Desativar todos os botões de aba
  document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
    btn.classList.remove('ativo');
  });
  
  // Mostrar a aba selecionada e ativar o botão correspondente
  var abaElement = document.getElementById('aba-' + abaId);
  if (abaElement) {
    abaElement.style.display = 'block';
  }
  
  // Encontrar e ativar o botão clicado
  event.target.classList.add('ativo');
  
  // Carregar dados quando muda de aba
  if (abaId === 'dados') {
    filtrarDadosPainel();
  } else if (abaId === 'estatisticas') {
    atualizarEstatisticas();
  }
}

// ============================================================
// GESTÃO DE UTILIZADORES
// ============================================================

function recarregarListaUtilizadores() {
  var tbody = document.getElementById('tabelaUtilizadores');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">A carregar utilizadores...</td></tr>';

  carregarListaUtilizadores().then(function(utilizadores) {
    if (utilizadores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">Nenhum utilizador registado.</td></tr>';
      return;
    }

    var html = '';
    utilizadores.forEach(function(util) {
      var dataLogin = util.ultimoLogin ? 
        new Date(util.ultimoLogin.seconds * 1000).toLocaleDateString('pt-PT') : 
        '—';
      var statusAdmin = util.isAdmin ? 
        '<span class="badge badge-admin">Admin</span>' : 
        '<span class="badge badge-user">Utilizador</span>';
      
      html += '<tr>' +
        '<td>' + util.email + '</td>' +
        '<td>' + util.nome + '</td>' +
        '<td>' + statusAdmin + '</td>' +
        '<td>' + dataLogin + '</td>' +
        '<td class="acoes-cell">' +
          '<button class="btn-acao btn-acao-pequeno" onclick="alternarAdminUtilizador(\'' + util.uid + '\', ' + !util.isAdmin + ')" title="' + (util.isAdmin ? 'Remover' : 'Promover') + '">' + (util.isAdmin ? '👤' : '⭐') + '</button>' +
          '<button class="btn-acao btn-acao-pequeno btn-acao-perigo" onclick="eliminarUtilizadorAdmin(\'' + util.uid + '\', \'' + util.email + '\')" title="Eliminar">🗑</button>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }).catch(function(err) {
    console.error('[Admin] Erro ao carregar utilizadores:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Erro ao carregar utilizadores. Tente novamente.</td></tr>';
  });
}

function alternarAdminUtilizador(uid, ehAdmin) {
  alterarRoleUtilizador(uid, ehAdmin).then(function() {
    recarregarListaUtilizadores();
  });
}

function eliminarUtilizadorAdmin(uid, email) {
  eliminarUtilizador(uid, email).then(function() {
    recarregarListaUtilizadores();
  });
}

// ============================================================
// GESTÃO DE DADOS
// ============================================================

function filtrarDadosPainel() {
  var dataInicio = document.getElementById('filtroDataInicio').value;
  var dataFim = document.getElementById('filtroDataFim').value;
  var local = document.getElementById('filtroLocal').value;
  
  var tbody = document.getElementById('tabelaDados');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">A carregar dados...</td></tr>';

  var filtros = {
    local: local || null,
    dataInicio: dataInicio || null,
    dataFim: dataFim || null
  };

  carregarDadosInseridos(filtros).then(function(registos) {
    if (registos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">Nenhum registo encontrado.</td></tr>';
      return;
    }

    var html = '';
    registos.forEach(function(registo) {
      var totalVisitantes = 0;
      Object.values(registo.paises || {}).forEach(function(v) {
        totalVisitantes += parseInt(v, 10);
      });

      html += '<tr>' +
        '<td>' + registo.data + '</td>' +
        '<td>' + registo.local + '</td>' +
        '<td>' + registo.funcionario + '</td>' +
        '<td>' + totalVisitantes + '</td>' +
        '<td class="acoes-cell">' +
          '<button class="btn-acao btn-acao-pequeno" onclick="verDetalhesRegisto(\'' + registo.id + '\')">👁</button>' +
          '<button class="btn-acao btn-acao-pequeno btn-acao-perigo" onclick="eliminarRegistoAdmin(\'' + registo.id + '\')">🗑</button>' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  }).catch(function(err) {
    console.error('[Admin] Erro ao carregar dados:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Erro ao carregar dados. Tente novamente.</td></tr>';
  });
}

function exportarDadosPainel() {
  var dataInicio = document.getElementById('filtroDataInicio').value;
  var dataFim = document.getElementById('filtroDataFim').value;
  var local = document.getElementById('filtroLocal').value;

  var filtros = {
    local: local || null,
    dataInicio: dataInicio || null,
    dataFim: dataFim || null
  };

  carregarDadosInseridos(filtros).then(function(registos) {
    exportarDadosCSV(registos);
  });
}

function eliminarRegistoAdmin(registoId) {
  eliminarRegisto(registoId).then(function() {
    filtrarDadosPainel();
  });
}

function verDetalhesRegisto(registoId) {
  mostrarToast('Funcionalidade de detalhes em desenvolvimento...', 'info');
}

// ============================================================
// ESTATÍSTICAS
// ============================================================

function atualizarEstatisticas() {
  carregarDadosInseridos({}).then(function(registos) {
    var stats = obterEstatisticas(registos);
    
    document.getElementById('statTotalRegistos').textContent = stats.totalRegistos;
    document.getElementById('statTotalVisitantes').textContent = stats.totalVisitantes;
    document.getElementById('statDataRecente').textContent = stats.datasMaisRecenteEAntiga.recente || '—';
    document.getElementById('statDataAntiga').textContent = stats.datasMaisRecenteEAntiga.antiga || '—';
  }).catch(function(err) {
    console.error('[Admin] Erro ao carregar estatísticas:', err);
    mostrarToast('Erro ao carregar estatísticas.', 'erro');
  });
}
