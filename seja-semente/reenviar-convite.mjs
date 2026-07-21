// Reenvia o convite de testador interno dos dois apps para o dono da conta
// e mostra o estado da análise beta dos links públicos.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const EMAIL = 'joaopaulocastro4136@gmail.com';

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

  // Reenvia o convite interno
  const testers = await api('GET', `/v1/betaTesters?filter[apps]=${appId}&filter[email]=${encodeURIComponent(EMAIL)}`);
  const tester = testers.dados?.data?.[0];
  if (!tester) { console.log('  ✗ testador não encontrado'); continue; }
  console.log(`  Testador: ${tester.attributes.email} (estado: ${tester.attributes.state})`);
  const conv = await api('POST', '/v1/betaTesterInvitations', {
    data: {
      type: 'betaTesterInvitations',
      relationships: {
        betaTester: { data: { type: 'betaTesters', id: tester.id } },
        app: { data: { type: 'apps', id: appId } },
      },
    },
  });
  console.log(conv.status >= 200 && conv.status < 300
    ? '  ✓ CONVITE REENVIADO agora para o e-mail'
    : `  Reenvio: ${JSON.stringify(conv.dados?.errors?.[0]?.detail || conv.dados || {}).slice(0, 200)}`);

  // Estado da análise beta (link público)
  const builds = await api('GET', `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=1`);
  const build = builds.dados?.data?.[0];
  if (build) {
    const sub = await api('GET', `/v1/betaAppReviewSubmissions?filter[build]=${build.id}&fields[betaAppReviewSubmissions]=betaReviewState`);
    console.log(`  Análise beta (link público): ${sub.dados?.data?.[0]?.attributes?.betaReviewState || '—'}`);
  }
}
console.log('\nFim.');
