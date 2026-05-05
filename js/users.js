// ============================================================
// users.js — Gestão de utilizadores e roles com Firestore
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var _cacheUtilizador    = null;  // Cache do perfil do utilizador atual
var _cacheValidadeMs    = 5 * 60 * 1000;  // 5 minutos
var _timestampCache     = 0;
var _isAdmin            = false;

// ============================================================
// INICIALIZAR FIRESTORE
// ============================================================

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

var db = firebase.firestore();

// ============================================================
// OBTER PERFIL DO UTILIZADOR (com cache)
// ============================================================

/**
 * Obtém o perfil do utilizador atual do Firestore (com cache de 5min)
 * @returns {Promise<Object>} - {uid, email, nome, role, ativo}
 */
function obterPerfilUtilizador(forcar) {
  var agora = Date.now();
  
  // Usar cache se válido e não forçar reload
  if (!forcar && _cacheUtilizador && (agora - _timestampCache < _cacheValidadeMs)) {
    return Promise.resolve(_cacheUtilizador);
  }

  var user = firebaseAuth.currentUser;
  if (!user) {
    return Promise.reject(new Error('Utilizador não autenticado'));
  }

  return db.collection('users').doc(user.uid).get()
    .then(function(doc) {
      if (!doc.exists) {
        // Criar perfil se não existir (primeiro login)
        var novoPerfil = {
          email: user.email,
          nome: user.displayName || user.email.split('@')[0],
          role: 'utilizador',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          ativo: true
        };
        return db.collection('users').doc(user.uid).set(novoPerfil)
          .then(function() {
            novoPerfil.uid = user.uid;
            _cacheUtilizador = novoPerfil;
            _timestampCache = agora;
            _isAdmin = false;
            return novoPerfil;
          });
      }

      var perfil = doc.data();
      perfil.uid = doc.id;
      
      // Atualizar cache
      _cacheUtilizador = perfil;
      _timestampCache = agora;
      _isAdmin = perfil.role === 'administrador';
      
      return perfil;
    })
    .catch(function(err) {
      console.error('[Firestore] Erro ao obter perfil:', err);
      throw err;
    });
}

/**
 * Verifica se o utilizador atual é administrador
 * @returns {Promise<boolean>}
 */
function verificarSeAdmin() {
  // Usar cache se disponível
  if (_cacheUtilizador && (Date.now() - _timestampCache < _cacheValidadeMs)) {
    return Promise.resolve(_cacheUtilizador.role === 'administrador');
  }
  
  return obterPerfilUtilizador()
    .then(function(perfil) { return perfil.role === 'administrador'; })
    .catch(function() { return false; });
}

/**
 * Limpa o cache do utilizador (chamar no logout)
 */
function limparCacheUtilizador() {
  _cacheUtilizador = null;
  _timestampCache = 0;
  _isAdmin = false;
}

// ============================================================
// GESTÃO DE UTILIZADORES (apenas administradores)
// ============================================================

/**
 * Lista todos os utilizadores (apenas admins)
 * @returns {Promise<Array>}
 */
function listarUtilizadores() {
  return verificarSeAdmin()
    .then(function(isAdmin) {
      if (!isAdmin) {
        throw new Error('Acesso negado. Apenas administradores podem listar utilizadores.');
      }
      
      return db.collection('users')
        .orderBy('email')
        .get();
    })
    .then(function(snapshot) {
      var users = [];
      snapshot.forEach(function(doc) {
        var data = doc.data();
        data.uid = doc.id;
        users.push(data);
      });
      return users;
    });
}

/**
 * Atualizar perfil de utilizador (admin pode editar qualquer um)
 * @param {string} uid 
 * @param {Object} dados - {nome?, role?, ativo?}
 * @returns {Promise}
 */
function atualizarUtilizador(uid, dados) {
  return verificarSeAdmin()
    .then(function(isAdmin) {
      var user = firebaseAuth.currentUser;
      
      // Admin pode editar qualquer um; utilizador normal só pode editar o próprio nome
      if (!isAdmin && user.uid !== uid) {
        throw new Error('Sem permissão para editar este utilizador.');
      }
      
      // Utilizador normal não pode mudar role ou ativo
      if (!isAdmin) {
        delete dados.role;
        delete dados.ativo;
      }
      
      dados.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
      
      return db.collection('users').doc(uid).update(dados);
    })
    .then(function() {
      // Limpar cache se for o próprio utilizador
      if (firebaseAuth.currentUser && firebaseAuth.currentUser.uid === uid) {
        limparCacheUtilizador();
      }
      return { sucesso: true, mensagem: 'Utilizador atualizado com sucesso.' };
    });
}

/**
 * Criar novo utilizador (apenas admins, via Cloud Function)
 * Esta função apenas valida; a criação real acontece na Cloud Function
 * @param {Object} dados - {email, password, nome, role}
 * @returns {Promise}
 */
function criarUtilizador(dados) {
  return verificarSeAdmin()
    .then(function(isAdmin) {
      if (!isAdmin) {
        throw new Error('Apenas administradores podem criar utilizadores.');
      }
      
      // A Cloud Function vai criar o utilizador no Firebase Auth
      // e o perfil no Firestore
      return chamarAPI('criarUtilizador', dados);
    });
}

/**
 * Desativar utilizador (admin apenas)
 * @param {string} uid 
 * @returns {Promise}
 */
function desativarUtilizador(uid) {
  return atualizarUtilizador(uid, { ativo: false });
}

/**
 * Ativar utilizador (admin apenas)
 * @param {string} uid 
 * @returns {Promise}
 */
function ativarUtilizador(uid) {
  return atualizarUtilizador(uid, { ativo: true });
}

// ============================================================
// ATUALIZAR NOME NO PERFIL (utilizador normal)
// ============================================================

/**
 * Atualiza o nome do utilizador atual
 * @param {string} novoNome 
 * @returns {Promise}
 */
function atualizarMeuNome(novoNome) {
  var user = firebaseAuth.currentUser;
  if (!user) {
    return Promise.reject(new Error('Utilizador não autenticado'));
  }
  
  return atualizarUtilizador(user.uid, { nome: novoNome.trim() });
}
