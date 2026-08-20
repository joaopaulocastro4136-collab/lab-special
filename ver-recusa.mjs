// Lê o MOTIVO da recusa do Lab Special direto da Apple (Resolution Center),
// usando os endpoints novos da API (resolutionCenterThreads / Messages) e,
// como reserva, as submissões de análise com os itens rejeitados.
// READ-ONLY: não altera nada.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const BUNDLE = 'com.laboratorio.special';

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(caminho) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + jwt() } });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}

const apps = await api(`/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = ((apps.dados && apps.dados.data) || []).find(a => a.attributes.bundleId === BUNDLE);
if (!app) { console.log('app não encontrado'); process.exit(1); }
console.log(`App: ${app.attributes.name} (${app.id})\n`);

// 1) Resolution Center: threads e mensagens
console.log('── Resolution Center (threads) ──');
const th = await api(`/v1/resolutionCenterThreads?filter[app]=${app.id}&limit=10`);
console.log(`status ${th.status}; threads: ${((th.dados && th.dados.data) || []).length}`);
if (th.dados && th.dados.errors) console.log('erros:', JSON.stringify(th.dados.errors).slice(0, 400));
for (const t of (th.dados && th.dados.data) || []) {
  console.log(`\nthread ${t.id} | ${JSON.stringify(t.attributes)}`);
  const msgs = await api(`/v1/resolutionCenterThreads/${t.id}/resolutionCenterMessages?limit=20&sort=-createdDate`);
  console.log(`  mensagens (status ${msgs.status}): ${((msgs.dados && msgs.dados.data) || []).length}`);
  for (const m of (msgs.dados && msgs.dados.data) || []) {
    console.log(`  ── mensagem ${m.attributes.createdDate || ''} ──`);
    console.log('  ' + JSON.stringify(m.attributes).slice(0, 4000));
  }
}

// 2) Reserva: submissões de análise + itens (estado da rejeição)
console.log('\n── Submissões de análise ──');
const subs = await api(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=IOS&limit=5`);
if (subs.dados && subs.dados.errors) console.log('erros:', JSON.stringify(subs.dados.errors).slice(0, 400));
console.log(`status ${subs.status}; submissões: ${((subs.dados && subs.dados.data) || []).length}`);
for (const s of (subs.dados && subs.dados.data) || []) {
  console.log(`\nsubmissão ${s.id} | ${JSON.stringify(s.attributes)}`);
  const itens = await api(`/v1/reviewSubmissions/${s.id}/items?limit=10`);
  for (const it of (itens.dados && itens.dados.data) || []) {
    console.log(`  item: ${JSON.stringify(it.attributes)}`);
  }
}
console.log('\nFim.');
