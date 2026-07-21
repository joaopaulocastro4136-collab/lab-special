// Adiciona um e-mail como testador EXTERNO dos dois apps no TestFlight — a
// Apple envia o convite por e-mail para essa conta. E-mail em CONVIDAR_EMAIL.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const EMAIL = (process.env.CONVIDAR_EMAIL || 'sejasemente@gmail.com').trim();

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
  let dados = null; try { dados = texto ? JSON.parse(texto) : null; } catch (e) {}
  return { status: r.status, dados };
}

for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  console.log(`\n══ ${nome} ══`);
  // Grupos externos (não-internos) — são os que enviam convite por e-mail
  const grupos = await api('GET', `/v1/betaGroups?filter[app]=${appId}&filter[isInternalGroup]=false`);
  const grupo = (grupos.dados?.data || [])[0];
  if (!grupo) { console.log('  ✗ nenhum grupo externo encontrado'); continue; }
  console.log(`  Grupo externo: "${grupo.attributes.name}"`);

  // Já é testador?
  const jaTem = await api('GET', `/v1/betaTesters?filter[apps]=${appId}&filter[email]=${encodeURIComponent(EMAIL)}`);
  let tester = jaTem.dados?.data?.[0];
  if (!tester) {
    const poe = await api('POST', '/v1/betaTesters', {
      data: { type: 'betaTesters', attributes: { email: EMAIL, firstName: 'Seja', lastName: 'Semente' },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: grupo.id }] } } },
    });
    if (poe.status >= 200 && poe.status < 300) { tester = poe.dados.data; console.log(`  ✓ ${EMAIL} adicionado ao grupo`); }
    else { console.log(`  ✗ adição: ${JSON.stringify(poe.dados?.errors?.[0]?.detail || poe.dados || {}).slice(0, 220)}`); continue; }
  } else {
    console.log(`  ${EMAIL} já é testador (estado: ${tester.attributes.state}) — garantindo no grupo`);
    await api('POST', `/v1/betaGroups/${grupo.id}/relationships/betaTesters`, { data: [{ type: 'betaTesters', id: tester.id }] });
  }

  // Dispara o convite por e-mail
  const conv = await api('POST', '/v1/betaTesterInvitations', {
    data: { type: 'betaTesterInvitations', relationships: {
      betaTester: { data: { type: 'betaTesters', id: tester.id } },
      app: { data: { type: 'apps', id: appId } },
    } },
  });
  console.log(conv.status >= 200 && conv.status < 300
    ? `  ✓ CONVITE ENVIADO pela Apple para ${EMAIL}`
    : `  Convite: ${JSON.stringify(conv.dados?.errors?.[0]?.detail || conv.dados || {}).slice(0, 220)}`);
}
console.log('\nFim.');
