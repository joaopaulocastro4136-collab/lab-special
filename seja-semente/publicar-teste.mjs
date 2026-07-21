// Robô do link público de teste dos apps do Seja Semente: pega o build mais
// novo de cada app no App Store Connect, garante o grupo "Equipe" com link
// público do TestFlight, coloca o build no grupo e envia para a análise beta.
// Rodar pelo workflow "Ativar Sign In with Apple" passando este arquivo.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const GRUPO = 'Equipe';

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

let deuErro = false;

for (const BUNDLE of ['com.sejasemente.central', 'com.sejasemente.semeador']) {
  console.log(`\n══ ${BUNDLE} ══`);

  const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
  const app = apps.dados?.data?.[0];
  if (!app) { console.log('  ✗ Ficha do app não existe no App Store Connect'); deuErro = true; continue; }
  console.log(`  App: ${app.attributes.name} (${app.id})`);

  const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10`);
  const build = (builds.dados?.data || []).find(b => b.attributes.processingState === 'VALID');
  if (!build) { console.log('  ✗ Nenhum build processado ainda — a Apple pode estar processando; tente em alguns minutos'); deuErro = true; continue; }
  console.log(`  Build: nº ${build.attributes.version}`);

  // Destrava o "Missing Compliance" (não usa criptografia própria)
  await api('PATCH', `/v1/builds/${build.id}`, {
    data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
  });

  // Grupo com link público
  const grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&filter[name]=${encodeURIComponent(GRUPO)}`);
  let grupo = grupos.dados?.data?.[0];
  if (!grupo) {
    const cria = await api('POST', '/v1/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: { name: GRUPO, publicLinkEnabled: true, publicLinkLimitEnabled: false },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    });
    grupo = cria.dados?.data;
    if (!grupo) { console.log(`  ✗ Falha ao criar grupo: ${JSON.stringify(cria.dados?.errors || {}).slice(0, 300)}`); deuErro = true; continue; }
    console.log('  Grupo "Equipe" criado com link público');
  } else if (!grupo.attributes.publicLinkEnabled) {
    const liga = await api('PATCH', `/v1/betaGroups/${grupo.id}`, {
      data: { type: 'betaGroups', id: grupo.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: false } },
    });
    grupo = liga.dados?.data || grupo;
  }

  const poe = await api('POST', `/v1/betaGroups/${grupo.id}/relationships/builds`, {
    data: [{ type: 'builds', id: build.id }],
  });
  console.log(poe.status === 204 ? '  Build colocado no grupo' : `  Build no grupo: status ${poe.status}`);

  // Envia para a análise beta da Apple (necessária para o link público valer)
  const beta = await api('POST', '/v1/betaAppReviewSubmissions', {
    data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
  });
  if (beta.status >= 200 && beta.status < 300) console.log('  Enviado para análise beta da Apple');
  else console.log(`  Análise beta: ${JSON.stringify(beta.dados?.errors?.[0]?.detail || beta.dados || {}).slice(0, 200)}`);

  const linkFinal = (grupo.attributes.publicLink || '').trim();
  console.log(linkFinal
    ? `  ➜ CONVITE (${app.attributes.name}): ${linkFinal}`
    : '  (o link público aparece alguns instantes depois — rode de novo para vê-lo)');
}

if (deuErro) process.exit(1);
console.log('\n✓ Grupos prontos — convites acima');
