// Autoriza os endereços da versão web no login do Firebase (Authentication →
// domínios autorizados). Sem isso o Google recusa entrar pelo site.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';

async function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase', aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TK = await token();

const DOMINIOS = [
  'localhost',
  `${PROJETO}.firebaseapp.com`,
  `${PROJETO}.web.app`,
  'seja-semente-semeador.web.app',
  'seja-semente-semeador.firebaseapp.com',
];

const r = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config?updateMask=authorizedDomains`, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ authorizedDomains: DOMINIOS }),
});
const json = await r.json().catch(() => ({}));
if (r.status === 200) {
  console.log('✓ Domínios autorizados no login: ' + (json.authorizedDomains || DOMINIOS).join(', '));
} else {
  console.log(`✗ Falha (${r.status}): ${JSON.stringify(json).slice(0, 300)}`);
  process.exit(1);
}
