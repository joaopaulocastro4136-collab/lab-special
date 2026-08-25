// Diagnostica o Palmar no TestFlight e abre o caminho RÁPIDO: um grupo
// INTERNO (que não espera a análise beta da Apple) com a build dentro e os
// usuários da conta App Store Connect como testadores. O grupo externo
// "Equipe" continua a caminho, liberado quando a Apple aprovar a análise.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const BUNDLE = 'com.sejasemente.palmar';
const GRUPO_INTERNO = 'Gestores (interno)';

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}
const erroDe = (r) => JSON.stringify(r.dados?.errors?.[0]?.detail || r.dados?.errors?.[0] || r.dados || {}).slice(0, 220);

// ─── 1. Diagnóstico ───
console.log('══ 1. Estado do Palmar ══');
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = apps.dados?.data?.[0];
if (!app) { console.log('✗ app não achado'); process.exit(1); }
console.log(`App: ${app.attributes.name} (${app.id})`);

const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=3&fields[builds]=version,processingState,uploadedDate`);
const build = (builds.dados?.data || []).find(b => b.attributes.processingState === 'VALID') || builds.dados?.data?.[0];
if (!build) { console.log('✗ nenhuma build'); process.exit(1); }
console.log(`Build nº ${build.attributes.version} · processamento: ${build.attributes.processingState}`);

const det = await api('GET', `/v1/builds/${build.id}/buildBetaDetail?fields[buildBetaDetails]=internalBuildState,externalBuildState`);
console.log(`  interno: ${det.dados?.data?.attributes?.internalBuildState} · externo: ${det.dados?.data?.attributes?.externalBuildState}`);

const sub = await api('GET', `/v1/builds/${build.id}/betaAppReviewSubmission?fields[betaAppReviewSubmissions]=betaReviewState`);
console.log(`  análise beta: ${sub.dados?.data?.attributes?.betaReviewState || '(nenhuma)'}`);

// ─── 2. Quem já pode instalar (grupo interno) ───
console.log('\n══ 2. Testadores internos ══');
const grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=20`);
for (const g of grupos.dados?.data || []) {
  const dentro = await api('GET', `/v1/betaGroups/${g.id}/betaTesters?limit=20&fields[betaTesters]=email,firstName,lastName,state`);
  console.log(`  "${g.attributes.name}" · interno: ${g.attributes.isInternalGroup} · testadores: ${(dentro.dados?.data || []).length}`);
  for (const t of dentro.dados?.data || []) console.log(`      ${t.attributes.email} · ${t.attributes.state}`);
}
// Todos os testadores do app, com o estado da instalação
const todos = await api('GET', `/v1/betaTesters?filter[apps]=${app.id}&limit=20&fields[betaTesters]=email,state`);
console.log(`  testadores do app: ${(todos.dados?.data || []).length}`);
for (const t of todos.dados?.data || []) console.log(`      ${t.attributes.email} · ${t.attributes.state}`);

console.log('\n✓ Fim');
