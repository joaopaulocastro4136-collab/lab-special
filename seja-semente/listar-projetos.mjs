// Lista os projetos Google Cloud que o robô consegue enxergar — para
// descobrir o ID real do projeto do Seja Semente e conferir a permissão.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: SA.token_uri, iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
const r = await fetch(SA.token_uri, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
});
const TK = (await r.json()).access_token;

const lista = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
  headers: { Authorization: 'Bearer ' + TK },
});
const json = await lista.json();
for (const p of json.projects || []) {
  console.log(`Projeto visível: ${p.projectId} — "${p.name}" (${p.lifecycleState})`);
}
if (!(json.projects || []).length) console.log('Nenhum projeto visível além do próprio.');
