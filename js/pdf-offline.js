// ============================================================
// pdf-offline.js — Geração de PDFs de registo offline
// Registo Diário de Nacionalidades — Município de Reguengos de Monsaraz
//
// Dependência: jsPDF (carregado via CDN ou localmente)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
//
// Uso: chamar gerarPdfCompleto() ou gerarPdfSimplificado()
// ============================================================

// ============================================================
// LISTA DE PAÍSES (usada nos PDFs — independente do estado da app)
// ============================================================

var PAISES_PDF = [
  // ── Portugal & destaque ──────────────────────────────────
  { nome: 'Portugal',            destaque: true },
  // ── Europa ───────────────────────────────────────────────
  { nome: 'Alemanha' },
  { nome: 'Áustria' },
  { nome: 'Bélgica' },
  { nome: 'Bulgária' },
  { nome: 'Chéquia' },
  { nome: 'Chipre' },
  { nome: 'Croácia' },
  { nome: 'Dinamarca' },
  { nome: 'Eslováquia' },
  { nome: 'Eslovénia' },
  { nome: 'Espanha' },
  { nome: 'Estónia' },
  { nome: 'Finlândia' },
  { nome: 'França' },
  { nome: 'Grécia' },
  { nome: 'Hungria' },
  { nome: 'Irlanda' },
  { nome: 'Itália' },
  { nome: 'Letónia' },
  { nome: 'Lituânia' },
  { nome: 'Luxemburgo' },
  { nome: 'Malta' },
  { nome: 'Países Baixos' },
  { nome: 'Polónia' },
  { nome: 'Roménia' },
  { nome: 'Suécia' },
  { nome: 'Reino Unido' },
  { nome: 'Suíça' },
  { nome: 'Noruega' },
  { nome: 'Islândia' },
  { nome: 'Rússia' },
  { nome: 'Ucrânia' },
  { nome: 'Turquia' },
  // ── Américas ─────────────────────────────────────────────
  { nome: 'Brasil' },
  { nome: 'Estados Unidos' },
  { nome: 'Canadá' },
  { nome: 'Argentina' },
  { nome: 'México' },
  { nome: 'Chile' },
  { nome: 'Colômbia' },
  // ── África ───────────────────────────────────────────────
  { nome: 'Angola' },
  { nome: 'Cabo Verde' },
  { nome: 'Guiné-Bissau' },
  { nome: 'Moçambique' },
  { nome: 'São Tomé e Príncipe' },
  { nome: 'Marrocos' },
  { nome: 'África do Sul' },
  // ── Ásia & Oceânia ───────────────────────────────────────
  { nome: 'China' },
  { nome: 'Japão' },
  { nome: 'Coreia do Sul' },
  { nome: 'Índia' },
  { nome: 'Israel' },
  { nome: 'Austrália' },
  { nome: 'Nova Zelândia' },
  // ── Outro ────────────────────────────────────────────────
  { nome: 'Outro' }
];

// Se a aplicação já definiu PAISES, usar essa lista no lugar de PAISES_PDF
function getPaisesParaPDF() {
  return (typeof PAISES !== 'undefined' && Array.isArray(PAISES) && PAISES.length > 0)
    ? PAISES
    : PAISES_PDF;
}

// ============================================================
// CONSTANTES DE LAYOUT
// ============================================================

var COR_VERDE      = [44, 78, 45];      // --verde
var COR_VERDE_LIGHT= [82, 130, 83];
var COR_AZUL       = [46, 91, 138];     // --azul
var COR_AMARELO    = [180, 140, 40];
var COR_LINHA_PAR  = [245, 248, 245];
var COR_LINHA_DEST = [220, 235, 220];
var COR_CINZA      = [100, 100, 100];
var COR_TEXTO      = [30, 30, 30];
var COR_BRANCO     = [255, 255, 255];
var COR_BORDA      = [200, 210, 200];

var MARGEM   = 14;       // mm
var LARGURA  = 210;      // A4
var ALTURA   = 297;      // A4
var COL_PAIS = 110;      // largura coluna país
var COL_NUM  =  40;      // largura coluna número
var COL_OBS  =  36;      // largura coluna observações
var LINHA_H  =   7;      // altura de cada linha de tabela
var LINHA_H_SUG = 8;

// ============================================================
// UTILITÁRIOS DE DESENHO
// ============================================================

function cabecalhoMunicipio(doc, titulo) {
  // Barra de topo
  doc.setFillColor.apply(doc, COR_VERDE);
  doc.rect(0, 0, LARGURA, 22, 'F');

  doc.setTextColor.apply(doc, COR_BRANCO);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Município de Reguengos de Monsaraz', MARGEM, 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Registo Diário de Visitantes', MARGEM, 16);

  // Título do PDF (lado direito)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, LARGURA - MARGEM, 12, { align: 'right' });

  doc.setTextColor.apply(doc, COR_TEXTO);
}

function rodape(doc, pagina, totalPaginas, dataGeracao) {
  var y = ALTURA - 8;
  doc.setDrawColor.apply(doc, COR_BORDA);
  doc.setLineWidth(0.3);
  doc.line(MARGEM, y - 3, LARGURA - MARGEM, y - 3);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor.apply(doc, COR_CINZA);
  doc.text('Gerado em: ' + dataGeracao, MARGEM, y);
  doc.text('Página ' + pagina + ' / ' + totalPaginas, LARGURA / 2, y, { align: 'center' });
  doc.text('Município de Reguengos de Monsaraz — uso interno', LARGURA - MARGEM, y, { align: 'right' });
  doc.setTextColor.apply(doc, COR_TEXTO);
}

function camposIdentificacao(doc, yInicio, localValue, dataValue) {
  var y = yInicio;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('IDENTIFICAÇÃO DO REGISTO', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 5;

  // Fundo cinza claro
  doc.setFillColor(248, 250, 248);
  doc.setDrawColor.apply(doc, COR_BORDA);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGEM, y, LARGURA - MARGEM * 2, 18, 2, 2, 'FD');

  // Campo Local
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Local / Atração:', MARGEM + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  // Linha de preenchimento manual (ou valor se fornecido)
  if (localValue) {
    doc.text(localValue, MARGEM + 45, y + 6);
  } else {
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.4);
    doc.line(MARGEM + 42, y + 7, MARGEM + 95, y + 7);
  }

  // Campo Data
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Data:', MARGEM + 100, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (dataValue) {
    doc.text(dataValue, MARGEM + 113, y + 6);
  } else {
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.4);
    doc.line(MARGEM + 111, y + 7, LARGURA - MARGEM - 4, y + 7);
  }

  // Campo Responsável
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Responsável:', MARGEM + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.4);
  doc.line(MARGEM + 30, y + 15, MARGEM + 95, y + 15);

  // Campo Assinatura
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Assinatura:', MARGEM + 100, y + 14);
  doc.setDrawColor(160, 160, 160);
  doc.line(MARGEM + 120, y + 15, LARGURA - MARGEM - 4, y + 15);

  return y + 22;
}

// Cabeçalho de tabela genérico
function cabecalhoTabela(doc, y, colunas) {
  doc.setFillColor.apply(doc, COR_VERDE);
  var totalLargura = colunas.reduce(function(s, c) { return s + c.largura; }, 0);
  doc.rect(MARGEM, y, totalLargura, 7, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_BRANCO);
  var x = MARGEM;
  colunas.forEach(function(col) {
    doc.text(col.titulo, x + col.largura / 2, y + 5, { align: 'center' });
    x += col.largura;
  });
  doc.setTextColor.apply(doc, COR_TEXTO);
  return y + 7;
}

// ============================================================
// PDF COMPLETO — PAÍSES
// ============================================================

function gerarPdfCompleto(opcoes) {
  opcoes = opcoes || {};
  var localValue = opcoes.local || '';
  var dataValue  = opcoes.data  || '';

  var { jsPDF } = window.jspdf;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var dataGeracao = new Date().toLocaleString('pt-PT');
  var paises = getPaisesParaPDF();

  // ── PÁGINA 1 ──────────────────────────────────────────────
  cabecalhoMunicipio(doc, 'Listagem Completa de Países');

  var y = 28;
  y = camposIdentificacao(doc, y, localValue, dataValue);

  // Título da secção
  y += 3;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('TURISTAS E VISITANTES POR PAÍS DE ORIGEM', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;

  // Instruções
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor.apply(doc, COR_CINZA);
  doc.text('Preencha o número de visitantes registados por país. Deixe em branco se não houver visitas.', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;

  // Colunas
  var colunas = [
    { titulo: 'País / Nacionalidade',   largura: COL_PAIS },
    { titulo: 'N.º de Visitantes',       largura: COL_NUM  },
    { titulo: 'Observações',             largura: COL_OBS  }
  ];
  var totalLarg = COL_PAIS + COL_NUM + COL_OBS;

  y = cabecalhoTabela(doc, y, colunas);

  // Dividir países em duas colunas para aproveitar espaço
  // Na prática, lista vertical simples (todos os países cabem em ~2 páginas)
  var limiteY = ALTURA - 20;

  paises.forEach(function(pais, idx) {
    // Quebra de página automática
    if (y + LINHA_H > limiteY) {
      rodape(doc, 1, 2, dataGeracao);
      doc.addPage();
      cabecalhoMunicipio(doc, 'Listagem Completa de Países (cont.)');
      y = 28;
      y = cabecalhoTabela(doc, y, colunas);
    }

    var par = idx % 2 === 0;
    if (pais.destaque) {
      doc.setFillColor.apply(doc, COR_LINHA_DEST);
    } else if (par) {
      doc.setFillColor.apply(doc, COR_LINHA_PAR);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(MARGEM, y, totalLarg, LINHA_H, 'F');

    // Borda suave
    doc.setDrawColor.apply(doc, COR_BORDA);
    doc.setLineWidth(0.15);
    doc.rect(MARGEM, y, totalLarg, LINHA_H, 'D');

    // Separadores de coluna
    doc.line(MARGEM + COL_PAIS, y, MARGEM + COL_PAIS, y + LINHA_H);
    doc.line(MARGEM + COL_PAIS + COL_NUM, y, MARGEM + COL_PAIS + COL_NUM, y + LINHA_H);

    // Nome do país
    doc.setFontSize(8.5);
    if (pais.destaque) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(pais.nome, MARGEM + 3, y + LINHA_H - 2);

    // Campo numérico (linha de escrita)
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.3);
    var xNum = MARGEM + COL_PAIS + 5;
    doc.line(xNum, y + LINHA_H - 1.5, xNum + COL_NUM - 10, y + LINHA_H - 1.5);

    y += LINHA_H;
  });

  // Linha de TOTAL
  if (y + 8 > limiteY) {
    rodape(doc, 1, 2, dataGeracao);
    doc.addPage();
    cabecalhoMunicipio(doc, 'Listagem Completa de Países (cont.)');
    y = 28;
  }
  doc.setFillColor.apply(doc, COR_VERDE);
  doc.rect(MARGEM, y, totalLarg, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_BRANCO);
  doc.text('TOTAL GERAL', MARGEM + 3, y + 5.5);
  doc.setDrawColor(170, 210, 170);
  doc.setLineWidth(0.5);
  var xTot = MARGEM + COL_PAIS + 5;
  doc.line(xTot, y + 6, xTot + COL_NUM - 10, y + 6);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 12;

  // ── Se ainda na pág 1, completar com operadores/sugestões ─
  // Caso contrário, rodapé da pág intermédia já foi chamado e continuamos na pág 2

  var paginaAtual = doc.internal.getCurrentPageInfo().pageNumber;

  // Se chegámos à última página (2), adicionar secção de operadores e sugestões
  // Se apenas ficámos na pág 1, forçar nova página para pág 2
  if (paginaAtual < 2) {
    rodape(doc, 1, 2, dataGeracao);
    doc.addPage();
    cabecalhoMunicipio(doc, 'Operadores · Sugestões · Observações');
    y = 28;
  }

  y = secaoPagina2(doc, y, dataGeracao);

  // Rodapé final
  var totalPags = doc.internal.getNumberOfPages();
  for (var p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    // Só desenhar rodapé nas páginas que ainda não o têm
    // (as intermédias já chamaram rodape() dentro do loop)
    if (p === totalPags) {
      rodape(doc, p, totalPags, dataGeracao);
    }
  }
  // Corrigir rodapé da pág 1 se só houver 2 páginas
  if (totalPags === 2) {
    doc.setPage(1);
    rodape(doc, 1, 2, dataGeracao);
  }

  doc.save('registo-visitantes-paises-' + dataParaNomeFicheiro() + '.pdf');
}

// ============================================================
// PDF SIMPLIFICADO — NACIONAIS / ESTRANGEIROS
// ============================================================

function gerarPdfSimplificado(opcoes) {
  opcoes = opcoes || {};
  var localValue = opcoes.local || '';
  var dataValue  = opcoes.data  || '';

  var { jsPDF } = window.jspdf;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var dataGeracao = new Date().toLocaleString('pt-PT');

  // ── PÁGINA 1 ──────────────────────────────────────────────
  cabecalhoMunicipio(doc, 'Nacionais / Estrangeiros');

  var y = 28;
  y = camposIdentificacao(doc, y, localValue, dataValue);

  // Título
  y += 3;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('REGISTO DE VISITANTES — MODO SIMPLIFICADO', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor.apply(doc, COR_CINZA);
  doc.text('Registe o número total de visitantes nacionais e estrangeiros por bloco horário ou período.', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 6;

  // Tabela de períodos
  var colPer  = 50;
  var colNac  = 45;
  var colEst  = 45;
  var colTot  = 42;
  var totalLargSimp = colPer + colNac + colEst + colTot;

  var colsSimp = [
    { titulo: 'Período / Hora',  largura: colPer  },
    { titulo: 'Nacionais (PT)',  largura: colNac  },
    { titulo: 'Estrangeiros',    largura: colEst  },
    { titulo: 'Total Período',   largura: colTot  }
  ];

  y = cabecalhoTabela(doc, y, colsSimp);

  var periodos = [
    '09:00 – 10:00',
    '10:00 – 11:00',
    '11:00 – 12:00',
    '12:00 – 13:00',
    '13:00 – 14:00',
    '14:00 – 15:00',
    '15:00 – 16:00',
    '16:00 – 17:00',
    '17:00 – 18:00',
    '18:00 – 19:00',
    'Grupos',
    'Escolas / Infantários',
    'Outro período'
  ];

  periodos.forEach(function(per, idx) {
    var par = idx % 2 === 0;
    doc.setFillColor.apply(doc, par ? COR_LINHA_PAR : COR_BRANCO);
    doc.rect(MARGEM, y, totalLargSimp, LINHA_H + 1, 'F');
    doc.setDrawColor.apply(doc, COR_BORDA);
    doc.setLineWidth(0.15);
    doc.rect(MARGEM, y, totalLargSimp, LINHA_H + 1, 'D');
    // Separadores
    var xs = [colPer, colPer + colNac, colPer + colNac + colEst];
    xs.forEach(function(dx) {
      doc.line(MARGEM + dx, y, MARGEM + dx, y + LINHA_H + 1);
    });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(per, MARGEM + 3, y + LINHA_H - 1);

    // Linhas de preenchimento para Nacionais, Estrangeiros, Total
    var campos = [colPer + 6, colPer + colNac + 6, colPer + colNac + colEst + 6];
    var largCampos = [colNac - 12, colEst - 12, colTot - 12];
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.3);
    campos.forEach(function(cx, ci) {
      doc.line(MARGEM + cx, y + LINHA_H, MARGEM + cx + largCampos[ci], y + LINHA_H);
    });

    y += LINHA_H + 1;
  });

  // Linha de totais
  doc.setFillColor.apply(doc, COR_VERDE);
  doc.rect(MARGEM, y, totalLargSimp, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_BRANCO);
  doc.text('TOTAIS DO DIA', MARGEM + 3, y + 5.5);
  var camposTot = [colPer + 6, colPer + colNac + 6, colPer + colNac + colEst + 6];
  var largTot   = [colNac - 12, colEst - 12, colTot - 12];
  doc.setDrawColor(200, 230, 200);
  doc.setLineWidth(0.5);
  camposTot.forEach(function(cx, ci) {
    doc.line(MARGEM + cx, y + 6, MARGEM + cx + largTot[ci], y + 6);
  });
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 12;

  // Caixa de observações rápidas na pág 1
  y += 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('NOTAS RÁPIDAS', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;
  doc.setFillColor(248, 250, 248);
  doc.setDrawColor.apply(doc, COR_BORDA);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGEM, y, LARGURA - MARGEM * 2, 28, 2, 2, 'FD');
  // Linhas internas
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  for (var l = 0; l < 3; l++) {
    var yL = y + 8 + l * 8;
    doc.line(MARGEM + 4, yL, LARGURA - MARGEM - 4, yL);
  }
  y += 32;

  rodape(doc, 1, 2, dataGeracao);

  // ── PÁGINA 2 ──────────────────────────────────────────────
  doc.addPage();
  cabecalhoMunicipio(doc, 'Operadores · Sugestões · Observações');
  y = 28;

  y = secaoPagina2(doc, y, dataGeracao);

  rodape(doc, 2, 2, dataGeracao);

  doc.save('registo-visitantes-simplificado-' + dataParaNomeFicheiro() + '.pdf');
}

// ============================================================
// PÁGINA 2 COMUM — Operadores, Sugestões, Observações
// ============================================================

function secaoPagina2(doc, yInicio, dataGeracao) {
  var y = yInicio;
  var limiteY = ALTURA - 20;

  // ── Operadores ────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('OPERADORES TURÍSTICOS / GRUPOS ORGANIZADOS', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;

  var colOpNome = 60;
  var colOpNac  = 66;
  var colOpTot  = 56;
  var totalLargOp = colOpNome + colOpNac + colOpTot;

  var colsOp = [
    { titulo: 'Nome do Operador',    largura: colOpNome },
    { titulo: 'Nacionalidades (ex: Alemanha:3, França:2)', largura: colOpNac },
    { titulo: 'Total Visitantes',    largura: colOpTot  }
  ];

  y = cabecalhoTabela(doc, y, colsOp);

  for (var op = 0; op < 6; op++) {
    var par = op % 2 === 0;
    doc.setFillColor.apply(doc, par ? COR_LINHA_PAR : COR_BRANCO);
    doc.rect(MARGEM, y, totalLargOp, LINHA_H + 2, 'F');
    doc.setDrawColor.apply(doc, COR_BORDA);
    doc.setLineWidth(0.15);
    doc.rect(MARGEM, y, totalLargOp, LINHA_H + 2, 'D');
    doc.line(MARGEM + colOpNome, y, MARGEM + colOpNome, y + LINHA_H + 2);
    doc.line(MARGEM + colOpNome + colOpNac, y, MARGEM + colOpNome + colOpNac, y + LINHA_H + 2);

    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.3);
    doc.line(MARGEM + 3,            y + LINHA_H + 1, MARGEM + colOpNome - 3,            y + LINHA_H + 1);
    doc.line(MARGEM + colOpNome + 3, y + LINHA_H + 1, MARGEM + colOpNome + colOpNac - 3, y + LINHA_H + 1);
    doc.line(MARGEM + colOpNome + colOpNac + 5, y + LINHA_H + 1, MARGEM + totalLargOp - 5, y + LINHA_H + 1);

    y += LINHA_H + 2;
  }

  y += 6;

  // ── Sugestões ─────────────────────────────────────────────
  if (y + 60 > limiteY) { y = limiteY - 60; }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('SUGESTÕES E COMENTÁRIOS DOS VISITANTES', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;

  var colSugTexto = 134;
  var colSugNac   =  48;
  var totalLargSug = colSugTexto + colSugNac;

  var colsSug = [
    { titulo: 'Sugestão / Comentário',  largura: colSugTexto },
    { titulo: 'Nacionalidade',           largura: colSugNac   }
  ];

  y = cabecalhoTabela(doc, y, colsSug);

  for (var s = 0; s < 5; s++) {
    var parS = s % 2 === 0;
    doc.setFillColor.apply(doc, parS ? COR_LINHA_PAR : COR_BRANCO);
    doc.rect(MARGEM, y, totalLargSug, LINHA_H_SUG, 'F');
    doc.setDrawColor.apply(doc, COR_BORDA);
    doc.setLineWidth(0.15);
    doc.rect(MARGEM, y, totalLargSug, LINHA_H_SUG, 'D');
    doc.line(MARGEM + colSugTexto, y, MARGEM + colSugTexto, y + LINHA_H_SUG);

    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.3);
    doc.line(MARGEM + 3, y + LINHA_H_SUG - 1, MARGEM + colSugTexto - 3, y + LINHA_H_SUG - 1);
    doc.line(MARGEM + colSugTexto + 3, y + LINHA_H_SUG - 1, MARGEM + totalLargSug - 3, y + LINHA_H_SUG - 1);

    y += LINHA_H_SUG;
  }

  y += 6;

  // ── Observações gerais ────────────────────────────────────
  if (y + 42 > limiteY) { y = limiteY - 42; }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, COR_VERDE);
  doc.text('OBSERVAÇÕES GERAIS', MARGEM, y);
  doc.setTextColor.apply(doc, COR_TEXTO);
  y += 4;

  doc.setFillColor(248, 250, 248);
  doc.setDrawColor.apply(doc, COR_BORDA);
  doc.setLineWidth(0.3);
  var alturaObs = Math.min(36, limiteY - y - 2);
  doc.roundedRect(MARGEM, y, LARGURA - MARGEM * 2, alturaObs, 2, 2, 'FD');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  var nLinhasObs = Math.floor((alturaObs - 6) / 8);
  for (var lo = 0; lo < nLinhasObs; lo++) {
    var ylo = y + 8 + lo * 8;
    if (ylo < y + alturaObs - 2) {
      doc.line(MARGEM + 4, ylo, LARGURA - MARGEM - 4, ylo);
    }
  }

  return y + alturaObs + 4;
}

// ============================================================
// UTILIDADE — Data para nome de ficheiro
// ============================================================

function dataParaNomeFicheiro() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ============================================================
// OBTER VALORES DO FORMULÁRIO ACTIVO (se disponível)
// ============================================================

function obterOpcoesFormulario() {
  var local = '';
  var data  = '';
  try {
    var elLocal = document.getElementById('local');
    var elData  = document.getElementById('data');
    if (elLocal) local = elLocal.value || '';
    if (elData)  data  = elData.value  || '';
  } catch(e) {}
  return { local: local, data: data };
}

// ============================================================
// MODAL DE ESCOLHA DE PDF
// ============================================================

function mostrarModalPDF() {
  // Remover modal anterior se existir
  var modalExist = document.getElementById('modalEscolhaPDF');
  if (modalExist) modalExist.remove();

  var overlay = document.createElement('div');
  overlay.id = 'modalEscolhaPDF';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'background:rgba(0,0,0,0.55)', 'display:flex',
    'align-items:center', 'justify-content:center',
    'font-family:inherit'
  ].join(';');

  overlay.innerHTML = `
    <div style="
      background:#fff; border-radius:12px; padding:28px 32px;
      max-width:420px; width:92%; box-shadow:0 8px 40px rgba(0,0,0,0.25);
      position:relative;
    ">
      <button onclick="document.getElementById('modalEscolhaPDF').remove()"
        style="position:absolute;top:12px;right:14px;background:none;border:none;
               font-size:18px;cursor:pointer;color:#666;line-height:1;">✕</button>

      <h2 style="margin:0 0 6px;font-size:16px;color:#2c4e2d;">
        📄 Descarregar Ficha de Registo
      </h2>
      <p style="margin:0 0 20px;font-size:13px;color:#555;">
        Escolha o tipo de ficha para preenchimento manual em modo offline.
        O PDF tem duas páginas: registo de visitantes + operadores/sugestões.
      </p>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <button id="btnPdfCompleto" style="
          background:#2c4e2d; color:#fff; border:none; border-radius:8px;
          padding:14px 18px; cursor:pointer; text-align:left; font-size:14px;
          font-weight:600; display:flex; align-items:flex-start; gap:12px;
          transition:background 0.2s;
        " onmouseover="this.style.background='#3d5a3e'"
           onmouseout="this.style.background='#2c4e2d'"
           onclick="iniciarDownloadPDF('completo')">
          <span style="font-size:22px;margin-top:-2px;">🌍</span>
          <span>
            Listagem Completa de Países<br>
            <small style="font-weight:400;opacity:0.85;">
              Todos os países com espaço para nº de visitantes por país
            </small>
          </span>
        </button>

        <button id="btnPdfSimplif" style="
          background:#2e5b8a; color:#fff; border:none; border-radius:8px;
          padding:14px 18px; cursor:pointer; text-align:left; font-size:14px;
          font-weight:600; display:flex; align-items:flex-start; gap:12px;
          transition:background 0.2s;
        " onmouseover="this.style.background='#3a6fa3'"
           onmouseout="this.style.background='#2e5b8a'"
           onclick="iniciarDownloadPDF('simplificado')">
          <span style="font-size:22px;margin-top:-2px;">🇵🇹</span>
          <span>
            Nacionais / Estrangeiros<br>
            <small style="font-weight:400;opacity:0.85;">
              Versão simplificada por período horário
            </small>
          </span>
        </button>

      </div>

      <p style="margin:16px 0 0;font-size:11px;color:#888;text-align:center;">
        Os dados do formulário (local e data) serão pré-preenchidos no PDF, se disponíveis.
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Fechar ao clicar no overlay
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

function iniciarDownloadPDF(tipo) {
  // Verificar se jsPDF está carregado
  if (typeof window.jspdf === 'undefined') {
    alert('A biblioteca de PDF não está disponível. Verifique a sua ligação à internet ou certifique-se de que o ficheiro jspdf está carregado.');
    return;
  }

  document.getElementById('modalEscolhaPDF').remove();

  var opcoes = obterOpcoesFormulario();

  try {
    if (tipo === 'completo') {
      gerarPdfCompleto(opcoes);
    } else {
      gerarPdfSimplificado(opcoes);
    }
  } catch(err) {
    console.error('Erro ao gerar PDF:', err);
    alert('Ocorreu um erro ao gerar o PDF. Detalhe: ' + err.message);
  }
}

// ============================================================
// INJECTAR BOTÃO DE RODAPÉ
// ============================================================

function injectarBotaoPDF() {
  // Evitar duplicados
  if (document.getElementById('btnGerarPDF')) return;

  var btn = document.createElement('button');
  btn.id = 'btnGerarPDF';
  btn.type = 'button';
  btn.innerHTML = '📄 Ficha Offline (PDF)';
  btn.title = 'Descarregar ficha de registo para preenchimento manual';
  btn.onclick = mostrarModalPDF;

  btn.style.cssText = [
    'display:inline-flex', 'align-items:center', 'gap:7px',
    'background:#2c4e2d', 'color:#fff',
    'border:none', 'border-radius:8px',
    'padding:10px 18px', 'font-size:13px', 'font-weight:600',
    'cursor:pointer', 'letter-spacing:0.02em',
    'box-shadow:0 2px 8px rgba(44,78,45,0.18)',
    'transition:background 0.2s, transform 0.1s'
  ].join(';');

  btn.onmouseover = function() { this.style.background = '#3d5a3e'; };
  btn.onmouseout  = function() { this.style.background = '#2c4e2d'; };
  btn.onmousedown = function() { this.style.transform = 'scale(0.97)'; };
  btn.onmouseup   = function() { this.style.transform = ''; };

  // Tentar inserir no rodapé da página
  var footer = document.querySelector('footer, .rodape, .footer, #rodape, #footer');
  if (footer) {
    // Inserir no rodapé existente
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:10px;text-align:center;';
    wrapper.appendChild(btn);
    footer.appendChild(wrapper);
  } else {
    // Criar rodapé flutuante mínimo
    var bar = document.createElement('div');
    bar.id = 'barraRodapePDF';
    bar.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'background:rgba(244,247,244,0.97)',
      'border-top:1px solid #c8d8c8',
      'padding:8px 16px',
      'display:flex', 'justify-content:center', 'align-items:center',
      'z-index:900',
      'box-shadow:0 -2px 10px rgba(0,0,0,0.08)'
    ].join(';');
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }
}

// ── Auto-injectar quando o DOM estiver pronto ────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectarBotaoPDF);
} else {
  injectarBotaoPDF();
}
