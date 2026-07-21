// Diagnóstico do login: mostra os domínios autorizados e os provedores ativos
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
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TK = await token();

const cfg = await (await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config`, {
  headers: { Authorization: 'Bearer ' + TK },
})).json();
console.log('Domínios autorizados:', JSON.stringify(cfg.authorizedDomains || []));
console.log('signIn.allowDuplicateEmails:', cfg.signIn?.allowDuplicateEmails);

const provs = await (await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/defaultSupportedIdpConfigs`, {
  headers: { Authorization: 'Bearer ' + TK },
})).json();
for (const p of provs.defaultSupportedIdpConfigs || []) {
  console.log(`Provedor ${p.name?.split('/').pop()}: enabled=${p.enabled} clientId=${p.clientId ? p.clientId.slice(0, 24) + '…' : '(vazio)'} temSegredo=${!!p.clientSecret}`);
}
if (!(provs.defaultSupportedIdpConfigs || []).length) console.log('⚠ Nenhum provedor configurado via API (pode estar só no console).');
