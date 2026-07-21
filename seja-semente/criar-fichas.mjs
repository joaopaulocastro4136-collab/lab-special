// Tenta criar as fichas dos dois apps do Seja Semente direto pela API da
// App Store Connect (a Apple normalmente só permite pelo site — este robô
// tenta e registra a resposta real da Apple como prova).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

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

const APPS = [
  { nome: 'Seja Semente', bundle: 'com.sejasemente.central', sku: 'seja-semente-central' },
  { nome: 'Semeador', bundle: 'com.sejasemente.semeador', sku: 'seja-semente-semeador' },
];

for (const app of APPS) {
  console.log(`\n══ ${app.nome} (${app.bundle}) ══`);

  const bid = await api('GET', `/v1/bundleIds?filter[identifier]=${app.bundle}`);
  const registro = (bid.dados?.data || []).find(d => d.attributes.identifier === app.bundle);
  console.log(`  Bundle ID: ${registro ? registro.id : 'NÃO ACHADO'}`);

  // Tentativa 1: POST /v1/apps (formato clássico de criação de recurso)
  const t1 = await api('POST', '/v1/apps', {
    data: {
      type: 'apps',
      attributes: { name: app.nome, bundleId: app.bundle, sku: app.sku, primaryLocale: 'pt-BR' },
    },
  });
  console.log(`  POST /v1/apps → ${t1.status}: ${JSON.stringify(t1.dados?.errors?.[0] || t1.dados || {}).slice(0, 300)}`);
  if (t1.status >= 200 && t1.status < 300) { console.log('  ✓ FICHA CRIADA!'); continue; }

  // Tentativa 2: com relacionamento para o bundle ID registrado
  if (registro) {
    const t2 = await api('POST', '/v1/apps', {
      data: {
        type: 'apps',
        attributes: { name: app.nome, sku: app.sku, primaryLocale: 'pt-BR' },
        relationships: { bundleId: { data: { type: 'bundleIds', id: registro.id } } },
      },
    });
    console.log(`  POST /v1/apps (c/ bundleId) → ${t2.status}: ${JSON.stringify(t2.dados?.errors?.[0] || t2.dados || {}).slice(0, 300)}`);
    if (t2.status >= 200 && t2.status < 300) { console.log('  ✓ FICHA CRIADA!'); continue; }
  }
}
console.log('\nFim das tentativas — veja acima as respostas da Apple.');
