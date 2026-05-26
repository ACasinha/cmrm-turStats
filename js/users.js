// ============================================================
// users.js — Gestão de utilizadores e roles com Firestore
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

var _cacheUtilizador  = null;
var _cacheValidadeMs  = 5 * 60 * 1000;  // 5 minutos
var _timestampCache   = 0;
var _isAdmin          = false;

var ROLES_VALIDAS = ['utilizador', 'visualizador', 'administrador'];

// ============================================================
// INICIALIZAR FIRESTORE
// ============================================================

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

var db = firebase.firestore();

// ============================================================
// OBTER PERFIL DO UTILIZADOR (com cache de 5min)
// ============================================================

function obterPerfilUtilizador(forcar) {
  var agora = Date.now();

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
        var novoPerfil = {
          email:           user.email,
          nome:            user.displayName || user.email.split('@')[0],
          role:            'utilizador',
          acessoDashboard: false,
          acessoEditor:    false,
          criadoEm:        firebase.firestore.FieldValue.serverTimestamp(),
          atualizadoEm:    firebase.firestore.FieldValue.serverTimestamp(),
          ativo:           true
        };
        return db.collection('users').doc(user.uid).set(novoPerfil)
          .then(function() {
            novoPerfil.uid   = user.uid;
            _cacheUtilizador = novoPerfil;
            _timestampCache  = agora;
            _isAdmin         = false;
            return novoPerfil;
          });
      }

      var perfil   = doc.data();
      perfil.uid   = doc.id;

      // Garantir que os campos booleanos existem (retrocompatibilidade)
      if (perfil.acessoDashboard === undefined) perfil.acessoDashboard = false;
      if (perfil.acessoEditor    === undefined) perfil.acessoEditor    = false;

      _cacheUtilizador = perfil;
      _timestampCache  = agora;
      _isAdmin         = perfil.role === 'administrador';

      return perfil;
    })
    .catch(function(err) {
      console.error('[Firestore] Erro ao obter perfil:', err);
      throw err;
    });
}

function verificarSeAdmin() {
  if (_cacheUtilizador && (Date.now() - _timestampCache < _cacheValidadeMs)) {
    return Promise.resolve(_cacheUtilizador.role === 'administrador');
  }
  return obterPerfilUtilizador()
    .then(function(perfil) { return perfil.role === 'administrador'; })
    .catch(function() { return false; });
}

function verificarAcessoDashboard() {
  if (_cacheUtilizador && (Date.now() - _timestampCache < _cacheValidadeMs)) {
    return Promise.resolve(_temAcessoDashboard(_cacheUtilizador));
  }
  return obterPerfilUtilizador()
    .then(function(perfil) { return _temAcessoDashboard(perfil); })
    .catch(function() { return false; });
}

function _temAcessoDashboard(perfil) {
  return perfil.role === 'administrador'
      || perfil.role === 'visualizador'
      || perfil.acessoDashboard === true;
}

// ── NOVO: verificar acesso ao editor mensal ───────────────────
function verificarAcessoEditor() {
  if (_cacheUtilizador && (Date.now() - _timestampCache < _cacheValidadeMs)) {
    return Promise.resolve(_temAcessoEditor(_cacheUtilizador));
  }
  return obterPerfilUtilizador()
    .then(function(perfil) { return _temAcessoEditor(perfil); })
    .catch(function() { return false; });
}

function _temAcessoEditor(perfil) {
  return perfil.role === 'administrador' || perfil.acessoEditor === true;
}
// ─────────────────────────────────────────────────────────────

function limparCacheUtilizador() {
  _cacheUtilizador = null;
  _timestampCache  = 0;
  _isAdmin         = false;
}

// ============================================================
// GESTÃO DE UTILIZADORES (apenas administradores)
// ============================================================

function listarUtilizadores() {
  return verificarSeAdmin()
    .then(function(isAdmin) {
      if (!isAdmin) {
        throw new Error('Acesso negado. Apenas administradores podem listar utilizadores.');
      }
      return db.collection('users').orderBy('email').get();
    })
    .then(function(snapshot) {
      var users = [];
      snapshot.forEach(function(doc) {
        var data = doc.data();
        data.uid = doc.id;
        // Retrocompatibilidade — garantir campos booleanos
        if (data.acessoDashboard === undefined) data.acessoDashboard = false;
        if (data.acessoEditor    === undefined) data.acessoEditor    = false;
        users.push(data);
      });
      return users;
    });
}

function atualizarUtilizador(uid, dados) {
  return verificarSeAdmin()
    .then(function(isAdmin) {
      var user = firebaseAuth.currentUser;

      if (!isAdmin && user.uid !== uid) {
        throw new Error('Sem permissão para editar este utilizador.');
      }

      // Utilizador normal não pode mudar campos sensíveis
      if (!isAdmin) {
        delete dados.role;
        delete dados.ativo;
        delete dados.acessoDashboard;
        delete dados.acessoEditor;
      }

      if (dados.role && ROLES_VALIDAS.indexOf(dados.role) === -1) {
        throw new Error('Role inválida: ' + dados.role);
      }

      dados.atualizadoEm = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection('users').doc(uid).update(dados);
    })
    .then(function() {
      if (firebaseAuth.currentUser && firebaseAuth.currentUser.uid === uid) {
        limparCacheUtilizador();
      }
      return { sucesso: true, mensagem: 'Utilizador atualizado com sucesso.' };
    });
}

function criarUtilizador(dados) {
  return verificarSeAdmin()
    .then(function(isAdmin) {
      if (!isAdmin) {
        throw new Error('Apenas administradores podem criar utilizadores.');
      }
      if (dados.role && ROLES_VALIDAS.indexOf(dados.role) === -1) {
        throw new Error('Role inválida: ' + dados.role);
      }
      return chamarAPI('criarUtilizador', dados);
    });
}

function desativarUtilizador(uid) {
  return atualizarUtilizador(uid, { ativo: false });
}

function ativarUtilizador(uid) {
  return atualizarUtilizador(uid, { ativo: true });
}

function atualizarMeuNome(novoNome) {
  var user = firebaseAuth.currentUser;
  if (!user) return Promise.reject(new Error('Utilizador não autenticado'));
  return atualizarUtilizador(user.uid, { nome: novoNome.trim() });
}
