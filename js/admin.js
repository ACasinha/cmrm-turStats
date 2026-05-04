// ============================================================
// admin.js — Sistema de Administração
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Gestão de utilizadores, roles (admin/utilizador) e dados inseridos
// Utiliza Firestore para persistência de dados de administração
// ============================================================

'use strict';

// Flag global para indicar se o utilizador actual é admin
var utilizadorEhAdmin = false;
var utilizadorUid = '';

// ============================================================
// INICIALIZAÇÃO DO FIRESTORE
// ============================================================

var db = null;

function inicializarFirestore() {
  if (!db) {
    db = firebase.firestore();
  }
}

// ============================================================
// VERIFICAR SE UTILIZADOR É ADMIN
// ============================================================

function verificarSeEhAdmin(uid) {
  inicializarFirestore();
  
  return db.collection('utilizadores').doc(uid).get()
    .then(function(doc) {
      if (doc.exists) {
        utilizadorEhAdmin = doc.data().isAdmin === true;
        return utilizadorEhAdmin;
      }
      utilizadorEhAdmin = false;
      return false;
    })
    .catch(function(err) {
      console.error('[Admin] Erro ao verificar role:', err);
      utilizadorEhAdmin = false;
      return false;
    });
}

// ============================================================
// REGISTAR UTILIZADOR NO FIRESTORE (ao fazer login)
// ============================================================

function registarUtilizadorNoFirestore(uid, email, nome) {
  inicializarFirestore();
  
  return db.collection('utilizadores').doc(uid).set({
    email: email,
    nome: nome || 'Sem nome',
    isAdmin: false,
    dataCriacaoDaTarefa: firebase.firestore.FieldValue.serverTimestamp(),
    ultimoLogin: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true })
  .then(function() {
    console.log('[Admin] Utilizador registado/atualizado em Firestore');
  })
  .catch(function(err) {
    console.warn('[Admin] Aviso ao registar utilizador:', err);
  });
}

// ============================================================
// CARREGAR LISTA DE UTILIZADORES
// ============================================================

function carregarListaUtilizadores() {
  inicializarFirestore();
  
  return db.collection('utilizadores')
    .orderBy('email')
    .get()
    .then(function(snapshot) {
      var utilizadores = [];
      snapshot.forEach(function(doc) {
        utilizadores.push({
          uid: doc.id,
          email: doc.data().email,
          nome: doc.data().nome || 'Sem nome',
          isAdmin: doc.data().isAdmin || false,
          dataCriacaoDaTarefa: doc.data().dataCriacaoDaTarefa || null,
          ultimoLogin: doc.data().ultimoLogin || null
        });
      });
      return utilizadores;
    });
}

// ============================================================
// PROMOVER/DESPROMOVER UTILIZADOR A ADMIN
// ============================================================

function alterarRoleUtilizador(uid, ehAdmin) {
  inicializarFirestore();
  
  return db.collection('utilizadores').doc(uid).update({
    isAdmin: ehAdmin
  })
  .then(function() {
    mostrarToast(
      ehAdmin ? 'Utilizador promovido a administrador.' : 'Utilizador removido de administrador.',
      'sucesso'
    );
  })
  .catch(function(err) {
    console.error('[Admin] Erro ao alterar role:', err);
    mostrarToast('Erro ao alterar permissões do utilizador.', 'erro');
    throw err;
  });
}

// ============================================================
// ELIMINAR UTILIZADOR
// ============================================================

function eliminarUtilizador(uid, email) {
  inicializarFirestore();
  
  if (!confirm('Tem certeza que deseja eliminar o utilizador ' + email + '? Esta ação é irreversível.')) {
    return Promise.reject(new Error('Cancelado pelo utilizador'));
  }
  
  return db.collection('utilizadores').doc(uid).delete()
    .then(function() {
      mostrarToast('Utilizador ' + email + ' eliminado com sucesso.', 'sucesso');
    })
    .catch(function(err) {
      console.error('[Admin] Erro ao eliminar utilizador:', err);
      mostrarToast('Erro ao eliminar utilizador.', 'erro');
      throw err;
    });
}

// ============================================================
// CARREGAR DADOS INSERIDOS
// ============================================================
// NOTA: Os dados de registos continuam armazenados apenas na Google Sheet
// através da Cloud Function. Esta função é um placeholder para futuras
// integrações que permitam ler dados da Google Sheet via Cloud Function.

function carregarDadosInseridos(filtros) {
  // Placeholder - dados estão na Google Sheet
  return Promise.resolve([]);
}

// ============================================================
// GUARDAR DADOS DE REGISTO (SÓ NA GOOGLE SHEET VIA CLOUD FUNCTION)
// ============================================================
// Os registos são guardados apenas na Google Sheet através da Cloud Function
// O Firestore é usado apenas para gestão de utilizadores e roles

// Esta função foi removida - os dados NÃO são guardados no Firestore
// function guardarDadosNoFirestore(...) { ... }


// ============================================================
// ELIMINAR REGISTO
// ============================================================
// NOTA: Os registos estão na Google Sheet. Para eliminar, use a interface da Google Sheet
// ou desenvolva um endpoint na Cloud Function que permita eliminar linhas da sheet.

function eliminarRegisto(registoId) {
  mostrarToast('Dados são armazenados na Google Sheet. Não é possível eliminar via esta interface.', 'info');
  return Promise.resolve();
}

// ============================================================
// ATUALIZAR DADOS DE REGISTO
// ============================================================
// NOTA: Os registos estão na Google Sheet.

function atualizarRegisto(registoId, dadosAtualizados) {
  mostrarToast('Dados são armazenados na Google Sheet. Edite diretamente na Google Sheet.', 'info');
  return Promise.resolve();
}

// ============================================================
// EXPORTAR DADOS EM CSV
// ============================================================
// NOTA: Os dados estão na Google Sheet. Pode exportar diretamente da Google Sheet em formato CSV.

function exportarDadosCSV(registos) {
  mostrarToast('Para exportar dados, use a interface da Google Sheet.', 'info');
}

// ============================================================
// ESTATÍSTICAS DOS DADOS
// ============================================================
// NOTA: As estatísticas devem ser calculadas via endpoint na Cloud Function
// que lê dados da Google Sheet.

function obterEstatisticas(registos) {
  // Placeholder - estatísticas devem vir da Google Sheet via Cloud Function
  return {
    totalRegistos: 0,
    totalVisitantes: 0,
    datasMaisRecenteEAntiga: { recente: null, antiga: null }
  };
}
