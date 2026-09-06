// Tira, do texto lido numa foto de documento brasileiro (RG, CNH, CIN, cartão
// do CPF), os dados que o cadastro do paciente usa: nome, CPF, data de
// nascimento e número do documento. É tudo por padrão de texto — não guarda
// nada, só interpreta o que o leitor de imagem devolveu.
'use strict';

// Palavras que aparecem impressas no documento e NÃO são nome de gente
const ROTULO = /REP[UÚ]BLICA|FEDERATIVA|BRASIL|CARTEIRA|IDENTIDADE|NACIONAL|HABILITA|FILIA|NATURALIDADE|MINIST|SECRETARIA|SEGURAN|ESTADO|DETRAN|V[AÁ]LID|TERRIT|ASSINATURA|\bDOC|[OÓ]RG[AÃ]O|EXPEDI|\bDATA\b|NASCIMENTO|EMISS|\bCPF\b|\bRG\b|REGISTRO|\bGERAL\b|CATEGORIA|OBSERVA|PERMISS|\bNOME\b|SOBRENOME|\bLOCAL\b|\bVIA\b|\bSEXO\b|NACIONALIDADE|CIDADE|MUNIC|GOVERNO|DEPARTAMENTO|TR[AÂ]NSITO|INSTITUTO|IDENTIFICA|POL[IÍ]CIA|CIVIL|DIRETOR|\bLEI\b|DECRETO|\bN[º°]|\bCNH\b|\bACC\b|\bCAT\b|\bHAB\b|PA[IÍ]S|\bUF\b|\bSSP\b|DIGITAL|POLEGAR|\bCIN\b|ELEITOR|T[IÍ]TULO|CERTID|CONSELHO|DIRETORIA|RENACH|ESPELHO|C[OÓ]DIGO|MERCOSU|SOCIAL|\bPIS\b|\bNIS\b|\bCNS\b|SA[UÚ]DE|CART[AÃ]O|ASSINADO|DIGITALMENTE|SERPRO|RECEITA|FEDERAL|\bFAZENDA\b|SITUA|CADASTRAL|REGULAR|EMITIDO|\bGOV\b|\bBR\b|MARCAS|OBS\b|\bAUTORIDADE\b|\bPRIMEIRA\b|\bHABILITA|\bPROTOCOLO\b|\bNÚMERO\b|\bNUMERO\b/i;

function normaliza(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// Linha que parece um nome de pessoa: só letras, pelo menos duas palavras,
// quase tudo em maiúsculo (documento é assim), sem palavra de rótulo
function pareceNome(linha) {
  const t = normaliza(linha);
  if (t.length < 5 || t.length > 60) return false;
  if (/\d/.test(t)) return false;
  if (!/^[A-ZÀ-ÿa-z' .-]+$/.test(t)) return false;
  const palavras = t.split(' ').filter(Boolean);
  if (palavras.length < 2 || palavras.length > 8) return false;
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusc = letras.replace(/[^A-ZÀ-Ý]/g, '');
  if (maiusc.length / Math.max(letras.length, 1) < 0.8) return false;
  if (ROTULO.test(t)) return false;
  return true;
}

function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n - 1; i++) s += Number(d[i]) * (n - i); const r = (s * 10) % 11; return (r === 10 ? 0 : r) === Number(d[n - 1]); };
  return dv(10) && dv(11);
}
const formataCpf = (d) => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

function acharCpf(texto) {
  const re = /(\d{3})[.\s]*(\d{3})[.\s]*(\d{3})[-.\s]*(\d{2})(?!\d)/g;
  let m, primeiro = null;
  while ((m = re.exec(texto))) {
    const d = m[1] + m[2] + m[3] + m[4];
    const achado = { cpf: formataCpf(d), pos: m.index, fim: m.index + m[0].length };
    if (cpfValido(d)) return achado;
    if (!primeiro) primeiro = achado;
  }
  return primeiro;
}

function datasDe(texto) {
  const re = /(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/g;
  const hoje = new Date();
  const out = []; let m;
  while ((m = re.exec(texto))) {
    const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
    if (d < 1 || d > 31 || mes < 1 || mes > 12 || a < 1900 || a > hoje.getFullYear()) continue;
    out.push({ pos: m.index, iso: `${m[3]}-${m[2]}-${m[1]}`, br: `${m[1]}/${m[2]}/${m[3]}`, ordem: a * 10000 + mes * 100 + d });
  }
  return out;
}

function acharNascimento(texto) {
  const datas = datasDe(texto);
  if (!datas.length) return null;
  // Com rótulo "NASCIMENTO": a primeira data depois dele
  const rot = /NASCIMENTO|NASC\.?|DATA DE NASC|BIRTH/i.exec(texto);
  if (rot) {
    const depois = datas.filter(d => d.pos > rot.index && d.pos - rot.index < 80);
    if (depois.length) return depois[0];
  }
  // Sem rótulo: a mais antiga (emissão, validade e 1ª habilitação vêm depois)
  return datas.slice().sort((x, y) => x.ordem - y.ordem)[0];
}

function acharNome(linhas) {
  // 1. Logo depois do rótulo NOME (RG: "NOME"; CNH: "NOME E SOBRENOME")
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!/\bNOME\b/i.test(l)) continue;
    const mesma = /NOME[^A-ZÀ-Ú]*[:\s]\s*([A-ZÀ-Ú][A-ZÀ-Ú' .-]{4,})$/.exec(normaliza(l));
    if (mesma && pareceNome(mesma[1])) return normaliza(mesma[1]);
    for (let j = i + 1; j <= i + 3 && j < linhas.length; j++) if (pareceNome(linhas[j])) return normaliza(linhas[j]);
  }
  // 2. Sem rótulo: a primeira linha que parece nome
  for (const l of linhas) if (pareceNome(l)) return normaliza(l);
  return '';
}

function acharRg(texto, cpfAchado) {
  const re = /(\d{1,2}[.\s]?\d{3}[.\s]?\d{3}[-\s]?[\dxX]?)(?![\d.])/g;
  const rot = /REGISTRO GERAL|\bRG\b|DOC\.? ?IDENT|IDENTIDADE|N[º°]? ?REGISTRO/i.exec(texto);
  let m; const cands = [];
  while ((m = re.exec(texto))) {
    const d = m[1].replace(/[^\dxX]/g, '');
    if (d.length < 7 || d.length > 10) continue;
    // Não confundir com o próprio CPF (o trecho dele fica de fora)
    if (cpfAchado && m.index >= cpfAchado.pos - 1 && m.index < cpfAchado.fim) continue;
    cands.push({ pos: m.index, v: m[1].trim() });
  }
  if (!cands.length) return '';
  if (rot) { const perto = cands.find(c => c.pos > rot.index && c.pos - rot.index < 60); if (perto) return perto.v; }
  return cands[0].v;
}

function extrairCampos(texto) {
  const t = String(texto || '');
  const linhas = t.split('\n').map(normaliza).filter(Boolean);
  const cpf = acharCpf(t);
  const nasc = acharNascimento(t);
  return {
    nome: acharNome(linhas),
    cpf: cpf ? cpf.cpf : '',
    nascimento: nasc ? nasc.iso : '',
    nascimentoBR: nasc ? nasc.br : '',
    rg: acharRg(t, cpf),
  };
}

module.exports = { extrairCampos, cpfValido, pareceNome };
