// Cria o grupo de teste INTERNO dos dois apps e coloca o dono da conta nele —
// teste interno não passa pela análise beta, o app aparece na hora no TestFlight.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const EMAIL = 'joaopaulocastro41@gmail.com';

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

// Confere quem é o time (e o e-mail do dono) — útil pro diagnóstico
const usuarios = await api('GET', '/v1/users?limit=10&fields[users]=username,roles');
for (const u of usuarios.dados?.data || []) {
  console.log(`Usuário do time: ${u.attributes.username} (${(u.attributes.roles || []).join(', ')})`);
}

let deuErro = false;

for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  console.log(`\n══ ${nome} ══`);

  // Grupo interno com acesso a todos os builds
  const grupos = await api('GET', `/v1/betaGroups?filter[app]=${appId}&filter[isInternalGroup]=true`);
  let grupo = grupos.dados?.data?.[0];
  if (!grupo) {
    const cria = await api('POST', '/v1/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: { name: 'Coordenação (interno)', isInternalGroup: true, hasAccessToAllBuilds: true },
        relationships: { app: { data: { type: 'apps', id: appId } } },
      },
    });
    grupo = cria.dados?.data;
    if (!grupo) { console.log(`  ✗ Grupo interno: ${JSON.stringify(cria.dados?.errors?.[0] || {}).slice(0, 250)}`); deuErro = true; continue; }
    console.log(`  Grupo interno criado (${grupo.id})`);
  } else {
    console.log(`  Grupo interno já existe: "${grupo.attributes.name}" (${grupo.id})`);
  }

  // Coloca o dono da conta como testador do grupo interno
  const poe = await api('POST', '/v1/betaTesters', {
    data: {
      type: 'betaTesters',
      attributes: { email: EMAIL },
      relationships: { betaGroups: { data: [{ type: 'betaGroups', id: grupo.id }] } },
    },
  });
  if (poe.status >= 200 && poe.status < 300) console.log(`  ✓ ${EMAIL} adicionado como testador interno`);
  else console.log(`  Testador: ${JSON.stringify(poe.dados?.errors?.[0] || poe.dados || {}).slice(0, 250)}`);
}

if (deuErro) process.exit(1);
console.log('\n✓ Teste interno pronto — o app deve aparecer no TestFlight do iPhone');
