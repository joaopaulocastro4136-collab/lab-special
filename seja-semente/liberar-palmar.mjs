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

// ─── 2. Caminho rápido: grupo INTERNO ───
console.log('\n══ 2. Grupo interno (sem esperar a Apple) ══');
const grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=20`);
for (const g of grupos.dados?.data || []) {
  console.log(`  grupo existente: "${g.attributes.name}" · interno: ${g.attributes.isInternalGroup} · link: ${g.attributes.publicLink || '—'}`);
}
let interno = (grupos.dados?.data || []).find(g => g.attributes.isInternalGroup);
if (!interno) {
  const cria = await api('POST', '/v1/betaGroups', {
    data: {
      type: 'betaGroups',
      attributes: { name: GRUPO_INTERNO, isInternalGroup: true },
      relationships: { app: { data: { type: 'apps', id: app.id } } },
    },
  });
  if (cria.status >= 200 && cria.status < 300) { interno = cria.dados.data; console.log(`  ✓ grupo interno criado (${interno.id})`); }
  else console.log(`  ✗ criar grupo interno: ${cria.status} ${erroDe(cria)}`);
}
if (interno) {
  const poe = await api('POST', `/v1/betaGroups/${interno.id}/relationships/builds`, {
    data: [{ type: 'builds', id: build.id }],
  });
  console.log(`  build no grupo interno: ${poe.status < 300 ? '✓ OK' : poe.status + ' ' + erroDe(poe)}`);

  // Usuários da conta como testadores internos
  const users = await api('GET', '/v1/users?limit=20&fields[users]=username,firstName,lastName,roles');
  for (const u of users.dados?.data || []) {
    const email = u.attributes.username;
    console.log(`  usuário da conta: ${email} (${(u.attributes.roles || []).join(', ')})`);
    const cria = await api('POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: { email, firstName: u.attributes.firstName || 'Gestor', lastName: u.attributes.lastName || 'Palmar' },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: interno.id }] } },
      },
    });
    console.log(`    convite: ${cria.status < 300 ? '✓ enviado' : cria.status + ' ' + erroDe(cria)}`);
  }
}
console.log('\n✓ Fim');
