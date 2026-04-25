// ============================================================
// data.js — Dados estáticos da aplicação
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
// ============================================================

'use strict';

/**
 * Lista ordenada de países/regiões de origem dos visitantes.
 * destaque: true → linha com fundo dourado (Portugal e Espanha).
 */
const PAISES = [
  { nome: 'Portugal',              destaque: true  },
  { nome: 'Espanha',               destaque: true  },
  { nome: 'África do Sul',         destaque: false },
  { nome: 'Albânia',               destaque: false },
  { nome: 'Alemanha',              destaque: false },
  { nome: 'Angola',                destaque: false },
  { nome: 'Argentina',             destaque: false },
  { nome: 'Austrália',             destaque: false },
  { nome: 'Áustria',               destaque: false },
  { nome: 'Bélgica',               destaque: false },
  { nome: 'Bósnia Herzegovina',    destaque: false },
  { nome: 'Brasil',                destaque: false },
  { nome: 'Canadá',                destaque: false },
  { nome: 'Chile',                 destaque: false },
  { nome: 'China',                 destaque: false },
  { nome: 'Chipre',                destaque: false },
  { nome: 'Colômbia',              destaque: false },
  { nome: 'Coreia do Sul',         destaque: false },
  { nome: 'Croácia',               destaque: false },
  { nome: 'Dinamarca',             destaque: false },
  { nome: 'Eslovénia',             destaque: false },
  { nome: 'Estónia',               destaque: false },
  { nome: 'EUA',                   destaque: false },
  { nome: 'Finlândia',             destaque: false },
  { nome: 'França',                destaque: false },
  { nome: 'Grécia',                destaque: false },
  { nome: 'Holanda',               destaque: false },
  { nome: 'Hungria',               destaque: false },
  { nome: 'Índia',                 destaque: false },
  { nome: 'Inglaterra',            destaque: false },
  { nome: 'Irlanda',               destaque: false },
  { nome: 'Islândia',              destaque: false },
  { nome: 'Israel',                destaque: false },
  { nome: 'Itália',                destaque: false },
  { nome: 'Japão',                 destaque: false },
  { nome: 'Letónia',               destaque: false },
  { nome: 'Lituânia',              destaque: false },
  { nome: 'Luxemburgo',            destaque: false },
  { nome: 'México',                destaque: false },
  { nome: 'Moldávia',              destaque: false },
  { nome: 'Mónaco',                destaque: false },
  { nome: 'Noruega',               destaque: false },
  { nome: 'Nova Zelândia',         destaque: false },
  { nome: 'Polónia',               destaque: false },
  { nome: 'República Checa',       destaque: false },
  { nome: 'Roménia',               destaque: false },
  { nome: 'Rússia',                destaque: false },
  { nome: 'Singapura',             destaque: false },
  { nome: 'Suécia',                destaque: false },
  { nome: 'Suíça',                 destaque: false },
  { nome: 'Ucrânia',               destaque: false },
  { nome: 'Venezuela',             destaque: false },
  { nome: 'Outros Países',         destaque: false },
];

/** Número de linhas em branco nas tabelas de Operadores e Sugestões */
const NUM_LINHAS_OP  = 6;
const NUM_LINHAS_SUG = 7;
