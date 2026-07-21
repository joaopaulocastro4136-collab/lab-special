// Garante o teste interno dos dois apps: grupo interno com acesso a todos os
// builds e o dono da conta (joaopaulocastro4136@gmail.com) como testador.
// Teste interno não passa pela análise beta — o app aparece na hora.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const EMAIL = 'joaopaulocastro4136@gmail.com'; // usuário do time (ACCOUNT_HOLDER)

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

for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  console.log(`\n══ ${nome} ══`);

  const grupos = await api('GET', `/v1/betaGroups?filter[app]=${appId}&filter[isInternalGroup]=true`);
  const grupo = grupos.dados?.data?.[0];
  if (!grupo) { console.log('  ✗ sem grupo interno'); continue; }
  console.log(`  Grupo interno "${grupo.attributes.name}" — acesso a todos os builds: ${grupo.attributes.hasAccessToAllBuilds}`);

  if (!grupo.attributes.hasAccessToAllBuilds) {
    const liga = await api('PATCH', `/v1/betaGroups/${grupo.id}`, {
      data: { type: 'betaGroups', id: grupo.id, attributes: { hasAccessToAllBuilds: true } },
    });
    console.log(`  Acesso a todos os builds ligado: ${liga.status}`);
  }

  const testers = await api('GET', `/v1/betaGroups/${grupo.id}/betaTesters?fields[betaTesters]=email,state`);
  const lista = testers.dados?.data || [];
  for (const t of lista) console.log(`  Testador no grupo: ${t.attributes.email} (${t.attributes.state || 's/ estado'})`);

  if (!lista.some(t => (t.attributes.email || '').toLowerCase() === EMAIL)) {
    const poe = await api('POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: { email: EMAIL },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: grupo.id }] } },
      },
    });
    console.log(poe.status >= 200 && poe.status < 300
      ? `  ✓ ${EMAIL} adicionado`
      : `  Adição: ${JSON.stringify(poe.dados?.errors?.[0]?.detail || poe.dados || {}).slice(0, 200)}`);
  } else {
    console.log(`  ✓ ${EMAIL} já está no grupo`);
  }
}
console.log('\nFim.');
