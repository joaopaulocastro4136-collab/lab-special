// Robô do link público de teste: pega o build mais novo da Special Clinic no
// App Store Connect, garante o grupo "Dentistas" com link público do TestFlight,
// coloca o build no grupo e envia para a análise beta da Apple.
// Usa a API oficial com a chave da App Store (ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER = process.env.ASC_ISSUER_ID;
const P8 = process.env.ASC_KEY_P8;
const BUNDLE = 'com.laboratorio.specialclinic';
const GRUPO = 'Dentistas';

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
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* resposta vazia */ }
  return { status: r.status, dados };
}

function falha(msg, resp) {
  console.error('ERRO: ' + msg, resp ? JSON.stringify(resp.dados || {}).slice(0, 400) : '');
  process.exit(1);
}

// 1. Acha o app
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = apps.dados && apps.dados.data && apps.dados.data[0];
if (!app) falha('app não encontrado no App Store Connect', apps);
console.log(`App: ${app.attributes.name} (${app.id})`);

// 2. Build mais novo já processado
const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10`);
const build = ((builds.dados && builds.dados.data) || []).find(b => b.attributes.processingState === 'VALID');
if (!build) falha('nenhum build processado ainda — a Apple pode estar processando; tente de novo em alguns minutos', builds);
console.log(`Build escolhido: nº ${build.attributes.version} (${build.attributes.processingState})`);

// 3. Declaração de criptografia (destrava o "Missing Compliance")
const comp = await api('PATCH', `/v1/builds/${build.id}`, {
  data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
});
console.log('Compliance:', comp.status === 200 ? 'ok ✓' : `aviso (${comp.status})`);

// 4. Grupo "Dentistas" com link público
let grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&filter[name]=${encodeURIComponent(GRUPO)}`);
let grupo = grupos.dados && grupos.dados.data && grupos.dados.data[0];
if (!grupo) {
  const novo = await api('POST', '/v1/betaGroups', {
    data: {
      type: 'betaGroups',
      attributes: { name: GRUPO, publicLinkEnabled: true, publicLinkLimitEnabled: false },
      relationships: { app: { data: { type: 'apps', id: app.id } } },
    },
  });
  if (novo.status >= 300) falha('não consegui criar o grupo', novo);
  grupo = novo.dados.data;
  console.log('Grupo "Dentistas" criado ✓');
} else {
  console.log('Grupo "Dentistas" já existe ✓');
  if (!grupo.attributes.publicLinkEnabled) {
    const liga = await api('PATCH', `/v1/betaGroups/${grupo.id}`, {
      data: { type: 'betaGroups', id: grupo.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: false } },
    });
    if (liga.status < 300) grupo = liga.dados.data;
  }
}

// 5. Coloca o build no grupo
const vincula = await api('POST', `/v1/betaGroups/${grupo.id}/relationships/builds`, {
  data: [{ type: 'builds', id: build.id }],
});
console.log('Build no grupo:', vincula.status < 300 ? 'ok ✓' : `aviso (${vincula.status})`);

// 6. Envia para a análise beta (necessária só na primeira vez / builds novos)
const rev = await api('POST', '/v1/betaAppReviewSubmissions', {
  data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
});
if (rev.status < 300) console.log('Enviado para análise beta da Apple ✓ (geralmente aprova em horas)');
else {
  const msg = JSON.stringify(rev.dados || {});
  if (msg.includes('ALREADY') || msg.includes('already')) console.log('Análise beta: build já enviado/aprovado ✓');
  else console.log(`Análise beta: resposta ${rev.status} — ${msg.slice(0, 300)}`);
}

// 7. Mostra o link público
const fresco = await api('GET', `/v1/betaGroups/${grupo.id}`);
const link = fresco.dados && fresco.dados.data && fresco.dados.data.attributes.publicLink;
console.log('');
console.log('════════════════════════════════════════════');
console.log('LINK PÚBLICO PARA OS DENTISTAS:');
console.log(link || '(link ainda não gerado — veja o grupo Dentistas no App Store Connect)');
console.log('════════════════════════════════════════════');
