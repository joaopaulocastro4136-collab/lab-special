// Abre a "porta" da função transformarSorriso: permite que o app a chame
// (invocação pública — a segurança de verdade é o login checado dentro da função).
// Necessário porque o firebase-tools só configura isso na criação da função.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }),
})).json();
if (!tok.access_token) { console.error('ERRO: não consegui o token de acesso', JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

let abriu = false;
// Caminho 1: API do Cloud Functions v2 (sincroniza com o Cloud Run por baixo)
const nomeFn = 'projects/laboratorio-special/locations/southamerica-east1/functions/transformarSorriso';
const r1 = await fetch(`https://cloudfunctions.googleapis.com/v2/${nomeFn}:setIamPolicy`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ policy: { bindings: [{ role: 'roles/cloudfunctions.invoker', members: ['allUsers'] }] } }),
});
console.log('Porta via Cloud Functions:', r1.status, r1.status < 300 ? 'aberta ✓' : (await r1.text()).slice(0, 200));
if (r1.status < 300) abriu = true;

// Caminho 2: direto no serviço Cloud Run (nome minúsculo)
const nomeRun = 'projects/laboratorio-special/locations/southamerica-east1/services/transformarsorriso';
const r2 = await fetch(`https://run.googleapis.com/v2/${nomeRun}:setIamPolicy`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ policy: { bindings: [{ role: 'roles/run.invoker', members: ['allUsers'] }] } }),
});
console.log('Porta via Cloud Run:', r2.status, r2.status < 300 ? 'aberta ✓' : (await r2.text()).slice(0, 200));
if (r2.status < 300) abriu = true;

if (!abriu) { console.error('ERRO: nenhum dos caminhos conseguiu abrir a porta.'); process.exit(1); }
console.log('Função pronta para o app ✓');
