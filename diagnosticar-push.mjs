// Diagnóstico do carteiro de notificações: por que o aviso de aprovação
// não chega no Special Clinic? Olha (1) os aparelhos registrados p/ push,
// (2) os pedidos de aprovação pendentes nos casos, (3) o cadastro dos
// dentistas e (4) os logs recentes da função aoMudarCaso na nuvem.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }),
})).json();
if (!tok.access_token) { console.error('ERRO: sem token', JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const valor = (v) => v?.stringValue ?? v?.integerValue ?? v?.doubleValue ?? v?.booleanValue ?? (v?.nullValue !== undefined ? null : v);

// 1. Aparelhos registrados para push
console.log('══ APARELHOS REGISTRADOS (pushTokens) ══');
const toks = await (await fetch(`${BASE}/labs/principal/pushTokens?pageSize=100`, { headers: H })).json();
for (const d of toks.documents || []) {
  const f = d.fields || {};
  console.log(`  tipo=${valor(f.tipo)} | dentista=${valor(f.dentista) || '-'} | plataforma=${valor(f.plataforma)} | atualizado=${valor(f.atualizadoEm)} | token=${String(valor(f.token)).slice(0, 14)}…`);
}
if (!(toks.documents || []).length) console.log('  NENHUM aparelho registrado!');

// 2. Dentistas cadastrados (nome usado pelo carteiro)
console.log('\n══ DENTISTAS (dentistasAcesso) ══');
const dents = await (await fetch(`${BASE}/labs/principal/dentistasAcesso?pageSize=50`, { headers: H })).json();
for (const d of dents.documents || []) {
  const f = d.fields || {};
  console.log(`  email=${d.name.split('/').pop()} | nome="${valor(f.nome)}" | dias=${valor(f.diasPagamento)} | data=${valor(f.dataPagamento)}`);
}

// 3. Casos com aprovação pendente
console.log('\n══ CASOS COM APROVAÇÃO PENDENTE ══');
let pagina = null;
let achou = 0;
do {
  const url = `${BASE}/labs/principal/casos?pageSize=300${pagina ? `&pageToken=${pagina}` : ''}`;
  const cs = await (await fetch(url, { headers: H })).json();
  for (const d of cs.documents || []) {
    const f = d.fields || {};
    const anexos = f.anexos?.arrayValue?.values || [];
    for (const a of anexos) {
      const af = a.mapValue?.fields || {};
      const ap = af.aprovacao?.mapValue?.fields;
      if (ap && valor(ap.status) === 'pendente') {
        achou++;
        console.log(`  caso=${valor(f.id)} | paciente=${valor(f.paciente)} | dentista="${valor(f.dentista)}" | anexo=${valor(af.nome)} | pedidaEm=${valor(ap.pedidaEm)}`);
      }
    }
  }
  pagina = cs.nextPageToken || null;
} while (pagina);
if (!achou) console.log('  nenhum pedido de aprovação pendente encontrado');

// 3b. Últimos casos (para ver anexos e aprovações como estão no banco)
console.log('\n══ ÚLTIMOS 6 CASOS (anexos e aprovações) ══');
const todosDocs = [];
let pg = null;
do {
  const url = `${BASE}/labs/principal/casos?pageSize=300${pg ? `&pageToken=${pg}` : ''}`;
  const cs = await (await fetch(url, { headers: H })).json();
  for (const d of cs.documents || []) todosDocs.push({ nomeDoc: d.name.split('/').pop(), f: d.fields || {} });
  pg = cs.nextPageToken || null;
} while (pg);
const todos = todosDocs.map(d => d.f);
todos.sort((a, b) => String(valor(b.id)).localeCompare(String(valor(a.id))));
for (const f of todos.slice(0, 6)) {
  console.log(`  caso=${valor(f.id)} | paciente=${valor(f.paciente)} | dentista="${valor(f.dentista)}" | status=${valor(f.status)} | dataHora=${valor(f.dataHora)}`);
  const anexos = f.anexos?.arrayValue?.values || [];
  if (!anexos.length) console.log('    (sem anexos)');
  for (const a of anexos) {
    const af = a.mapValue?.fields || {};
    const ap = af.aprovacao?.mapValue?.fields;
    console.log(`    anexo=${valor(af.nome)} | categoria=${valor(af.categoria)} | aprovacao=${ap ? valor(ap.status) : '—'}`);
  }
}

// 3b2. Saúde dos documentos de caso: id faltando, nome do doc diferente do id, duplicados
console.log('\n══ SAÚDE DOS CASOS NO BANCO ══');
console.log(`  total de documentos: ${todosDocs.length}`);
const contagemIds = {};
let problemas = 0;
for (const d of todosDocs) {
  const id = valor(d.f.id);
  const paciente = valor(d.f.paciente);
  if (!id) { problemas++; console.log(`  ⚠ SEM CAMPO id: doc=${d.nomeDoc} | paciente=${paciente}`); continue; }
  if (id !== d.nomeDoc) { problemas++; console.log(`  ⚠ NOME ≠ id: doc=${d.nomeDoc} | id=${id} | paciente=${paciente}`); }
  contagemIds[id] = (contagemIds[id] || 0) + 1;
}
for (const id in contagemIds) {
  if (contagemIds[id] > 1) { problemas++; console.log(`  ⚠ id DUPLICADO em ${contagemIds[id]} docs: ${id}`); }
}
if (!problemas) console.log('  todos os documentos saudáveis ✓');
// Caso "pary" (o que o usuário não consegue excluir): mostra como está no banco
for (const d of todosDocs) {
  const paciente = String(valor(d.f.paciente) || '');
  if (/par/i.test(paciente)) {
    console.log(`  🔎 possível "pary": doc=${d.nomeDoc} | id=${valor(d.f.id)} | paciente="${paciente}" | status=${valor(d.f.status)} | dentista=${valor(d.f.dentista)} | dataEntrada=${valor(d.f.dataEntrada)}`);
  }
}

// 3c. E-mails com acesso ao Lab (regras de gravação)
const acessoKV = await (await fetch(`${BASE}/labs/principal/kv/acesso`, { headers: H })).json();
const emailsAcesso = (acessoKV.fields?.emails?.arrayValue?.values || []).map(v => v.stringValue);
console.log('\n══ ACESSO AO LAB (kv/acesso) ══\n  ' + (emailsAcesso.join(', ') || 'vazio'));

// 3d. Canal reserva e telemetria do app
console.log('\n══ AVISOS DE APROVAÇÃO (canal reserva) ══');
const avs = await (await fetch(`${BASE}/labs/principal/avisosAprovacao?pageSize=20`, { headers: H })).json();
const avList = (avs.documents || []).map(d => d.fields || {});
avList.sort((a, b) => String(valor(b.em)).localeCompare(String(valor(a.em))));
for (const f of avList.slice(0, 10)) console.log(`  ${valor(f.em)} | dentista="${valor(f.dentista)}" | paciente=${valor(f.paciente)} | anexo=${valor(f.anexoNome)}`);
if (!avList.length) console.log('  (nenhum — o Lab ainda não pediu aprovação pela versão nova)');

console.log('\n══ TELEMETRIA DO APP (logsApp) ══');
const lgs = await (await fetch(`${BASE}/labs/principal/logsApp?pageSize=40`, { headers: H })).json();
const lgList = (lgs.documents || []).map(d => d.fields || {});
lgList.sort((a, b) => String(valor(b.em)).localeCompare(String(valor(a.em))));
for (const f of lgList.slice(0, 15)) console.log(`  ${valor(f.em)} | ${valor(f.acao)} | caso=${valor(f.casoId)} | v=${valor(f.versao)} ${valor(f.plataforma) || ''} ${valor(f.email) || ''} | ${valor(f.resultado) || ''}`);
if (!lgList.length) console.log('  (sem registros ainda)');

// 4. Logs recentes do carteiro (aoMudarCaso e aoCriarCaso)
console.log('\n══ LOGS DO CARTEIRO (últimas 24h) ══');
const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
for (const fn of ['aomudarcaso', 'aocriarcaso', 'aopediraprovacao']) {
  console.log(`--- ${fn} ---`);
  const lr = await (await fetch('https://logging.googleapis.com/v2/entries:list', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      resourceNames: [`projects/${PROJETO}`],
      filter: `resource.type="cloud_run_revision" AND resource.labels.service_name="${fn}" AND timestamp>="${desde}"`,
      orderBy: 'timestamp desc',
      pageSize: 40,
    }),
  })).json();
  const entradas = (lr.entries || []).reverse();
  if (!entradas.length) console.log('  (sem logs — a função não rodou nas últimas 24h)');
  for (const e of entradas) {
    const txt = e.textPayload || JSON.stringify(e.jsonPayload || {}).slice(0, 220);
    console.log(`  ${e.timestamp} [${e.severity}] ${String(txt).slice(0, 220)}`);
  }
}
console.log('\nDiagnóstico concluído ✓');
