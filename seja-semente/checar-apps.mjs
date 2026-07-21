// Confere se as fichas dos dois apps do Seja Semente já existem no
// App Store Connect (rodar pelo workflow "Ativar Sign In with Apple",
// passando este arquivo como script).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assin;

for (const bundle of ['com.sejasemente.central', 'com.sejasemente.semeador']) {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${bundle}`, {
    headers: { Authorization: 'Bearer ' + JWT },
  });
  const json = await r.json();
  const app = (json.data || [])[0];
  console.log(app
    ? `✓ ${bundle}: ficha EXISTE — "${app.attributes.name}" (${app.id})`
    : `✗ ${bundle}: ficha AINDA NÃO EXISTE no App Store Connect`);
}
