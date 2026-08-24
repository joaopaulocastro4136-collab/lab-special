// Autoriza as contas do João Paulo na central (entram direto, sem código),
// mesmo depois que a fase de teste aberta for fechada.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';
const EMAILS = ['joaopaulocastro41@gmail.com', 'joaopaulocastro4136@gmail.com', 'sejasemente@gmail.com'];

async function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TK = await token();

for (const email of EMAILS) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents/central-autorizados/${encodeURIComponent(email)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: {
      email: { stringValue: email },
      autorizadoPor: { stringValue: 'coordenação' },
      criadoEm: { timestampValue: new Date().toISOString() },
    } }),
  });
  console.log(r.status === 200 ? `✓ ${email} autorizado na central` : `✗ ${email}: falha (${r.status})`);
}
console.log('Fim.');
