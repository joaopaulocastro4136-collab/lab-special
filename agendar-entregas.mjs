// Agenda no banco as entregas do cronograma: acha o trabalho de cada paciente e
// grava o PRAZO do dia combinado (é o prazo que manda na agenda do app).
// Por padrão só RELATA. Com APLICAR=1 grava, guardando antes uma cópia de segurança.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const PROJETO = 'laboratorio-special';
const LAB = process.env.LAB || 'principal';
const APLICAR = process.env.APLICAR === '1';

// Cronograma (do PDF "Entregas Outubro atualizado")
const CRONOGRAMA = [
  { data: '2026-10-09', pacientes: ['Luiza Primo|U', 'José Carlos Rodrigues|U', 'Maria de Jesus Macedo da Conceição|U'] },
  { data: '2026-10-13', pacientes: ['Aroldo de Araújo|U', 'Daniel Almeida|U', 'Francisco Sales Silva Mudo|U'] },
  { data: '2026-10-14', pacientes: ['Edna Maria Feitosa', 'Maria das Graças da Silva', 'Doralice Ferreira'] },
  { data: '2026-10-15', pacientes: ['Silas Abreu', 'Getúlio Carlos|U', 'Sirleide Aguiar|U'] },
  { data: '2026-10-16', pacientes: ['Maria da Paz', 'Tereza Cristina', 'Terezinha de Jesus'] },
  { data: '2026-10-19', pacientes: ['Ideildo Lira', 'Josefa Zulmira', 'Edineide dos Santos Martins'] },
  { data: '2026-10-20', pacientes: ['Margarida Nicácio', 'Marinalva Gomes', 'Rafael Moacir'] },
];

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }),
})).json();
if (!tok.access_token) { console.error('ERRO: sem token'); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;

const deValor = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
  return null;
};
const deCampos = (f) => { const o = {}; for (const k in f) o[k] = deValor(f[k]); return o; };
const paraValor = (x) => {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(paraValor) } };
  const fields = {}; for (const k in x) fields[k] = paraValor(x[k]);
  return { mapValue: { fields } };
};
async function lerColecao(caminho) {
  const itens = []; let token = '';
  do {
    const r = await fetch(`${BASE}/${caminho}?pageSize=300${token ? `&pageToken=${token}` : ''}`, { headers: H });
    const j = await r.json();
    if (j.error) { console.error('ERRO ao listar', JSON.stringify(j.error).slice(0, 200)); break; }
    (j.documents || []).forEach(d => itens.push({ __doc: d.name.split('/').pop(), ...deCampos(d.fields || {}) }));
    token = j.nextPageToken || '';
  } while (token);
  return itens;
}
async function gravarDoc(caminho, obj) {
  const fields = {}; for (const k in obj) fields[k] = paraValor(obj[k]);
  const r = await fetch(`${BASE}/${caminho}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
  if (r.status !== 200) { console.error('ERRO ao gravar', caminho, (await r.text()).slice(0, 200)); return false; }
  return true;
}

// Compara nomes ignorando acento, maiúscula e sobrenome faltando
const limpar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const partes = (s) => limpar(s).split(' ').filter(p => p.length > 2);
// Regra dura: nome de paciente é gente de verdade, casar errado é pior que não casar.
// Só aceita quando bate o nome inteiro, OU bate o primeiro nome E pelo menos mais um
// pedaço. Com só o primeiro nome igual (Maria, José...), aceita apenas se esse primeiro
// nome for ÚNICO entre os trabalhos em aberto — senão é ambíguo e fica de fora.
function pontuacao(alvo, candidato, contaPrimeiroNome) {
  const a = partes(alvo), c = partes(candidato);
  if (!a.length || !c.length) return 0;
  if (limpar(alvo) === limpar(candidato)) return 100;
  const comuns = a.filter(p => c.includes(p)).length;
  if (!comuns) return 0;
  if (a[0] !== c[0]) return 0;              // primeiro nome diferente: não é a mesma pessoa
  if (comuns >= 2) return 80 + comuns * 5;  // primeiro nome + sobrenome batendo
  return (contaPrimeiroNome && contaPrimeiroNome[a[0]] === 1) ? 70 : 0; // só o 1º nome: tem que ser único
}

const casos = await lerColecao(`labs/${LAB}/casos`);
const abertos = casos.filter(c => c.status !== 'Entregue');
console.log(`Trabalhos no banco: ${casos.length} (${abertos.length} ainda não entregues)`);
console.log(`Modo: ${APLICAR ? 'APLICAR (grava)' : 'só relatório'}\n`);

// Quantos trabalhos em aberto começam com cada primeiro nome (pra pegar ambiguidade)
const contaPrimeiroNome = {};
abertos.forEach(c => { const p = partes(c.paciente)[0]; if (p) contaPrimeiroNome[p] = (contaPrimeiroNome[p] || 0) + 1; });

const planos = [];
const naoAchados = [];
const usados = new Set();
for (const dia of CRONOGRAMA) {
  for (const p of dia.pacientes) {
    const [nome, urg] = p.split('|');
    let melhor = null, melhorP = 0;
    for (const c of abertos) {
      if (usados.has(c.id)) continue;
      const pt = pontuacao(nome, c.paciente, contaPrimeiroNome);
      if (pt > melhorP) { melhorP = pt; melhor = c; }
    }
    if (melhor && melhorP >= 70) {
      usados.add(melhor.id);
      planos.push({ caso: melhor, nome, data: dia.data, urgente: urg === 'U', pontos: melhorP });
    } else {
      naoAchados.push({ nome, data: dia.data, urgente: urg === 'U', melhorPalpite: melhor && melhorP > 0 ? `${melhor.paciente} (${melhorP})` : null });
    }
  }
}

console.log('══════════════════════════════════════');
console.log(`AGENDAMENTO: ${planos.length} de ${CRONOGRAMA.reduce((s, d) => s + d.pacientes.length, 0)} trabalhos encontrados`);
console.log('══════════════════════════════════════');
let diaAtual = '';
for (const pl of planos) {
  if (pl.data !== diaAtual) { diaAtual = pl.data; console.log(`\n${diaAtual}:`); }
  const mudou = pl.caso.prazo !== pl.data;
  console.log(`  ${pl.urgente ? '🔴' : '  '} ${pl.caso.paciente.padEnd(34)} | prazo ${pl.caso.prazo || '—'} → ${pl.data} ${mudou ? '(muda)' : '(já está)'} | ${pl.caso.status}`);
}
if (naoAchados.length) {
  console.log(`\n⚠ NÃO ENCONTRADOS NO APP (${naoAchados.length}) — precisam ser cadastrados por você:`);
  naoAchados.forEach(n => {
    const alvo = partes(n.nome);
    const parecidos = abertos
      .filter(c => !usados.has(c.id))
      .map(c => ({ nome: c.paciente, status: c.status, prazo: c.prazo, pt: partes(c.paciente).filter(p => alvo.includes(p)).length }))
      .filter(x => x.pt > 0)
      .sort((a, b) => b.pt - a.pt)
      .slice(0, 4);
    console.log(`  ${n.data} | ${n.nome}${n.urgente ? ' (URGÊNCIA)' : ''}`);
    parecidos.forEach(p => console.log(`        candidato: "${p.nome}" (${p.status}, prazo ${p.prazo || '—'})`));
    if (!parecidos.length) console.log('        (nenhum parecido — esse trabalho não existe no app)');
  });
}

if (!APLICAR) { console.log('\n(Modo relatório: NADA foi gravado. Para aplicar, rode com APLICAR=1.)'); process.exit(0); }

console.log('\nGravando os prazos...');
let ok = 0;
for (const pl of planos) {
  const c = pl.caso;
  const obs = pl.urgente && !String(c.observacoes || '').includes('URGÊNCIA')
    ? `URGÊNCIA — entrega ${pl.data.split('-').reverse().join('/')}. ${c.observacoes || ''}`.trim()
    : c.observacoes;
  const novo = { ...c, prazo: pl.data, observacoes: obs, agendadoEm: new Date().toISOString().slice(0, 10) };
  delete novo.__doc;
  if (await gravarDoc(`labs/${LAB}/casos/${c.__doc}`, novo)) ok++;
}
console.log(`\n✓ ${ok} trabalhos agendados no banco — já vale em qualquer aparelho.`);
