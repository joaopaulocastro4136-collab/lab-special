// Zera o contador DIÁRIO da IA Special (labs/principal/iaUso/<dia>_<pessoa>) do dia de hoje.
// Serve quando tentativas que falharam (sem crédito no Google) gastaram o limite da pessoa.
// Log só com contagens (o nome do documento tem e-mail — o repositório é público).
import crypto from 'crypto';
import { readFileSync } from 'fs';
const PROJETO = 'laboratorio-special';
const LAB = process.env.LAB || 'principal';
const DIA = process.env.DIA || new Date().toISOString().slice(0, 10);
const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600 });
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }) })).json();
if (!tok.access_token) { console.error('ERRO: sem token'); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
let token = '', docs = [];
do {
  const r = await fetch(`${BASE}/labs/${LAB}/iaUso?pageSize=300${token ? `&pageToken=${token}` : ''}`, { headers: H });
  const j = await r.json();
  if (j.error) { console.error('ERRO ao listar', JSON.stringify(j.error).slice(0, 200)); process.exit(1); }
  docs.push(...(j.documents || [])); token = j.nextPageToken || '';
} while (token);
const hoje = docs.filter(d => d.name.split('/').pop().startsWith(DIA + '_'));
let zerados = 0;
for (const d of hoje) {
  const n = Number((d.fields && d.fields.n && (d.fields.n.integerValue || d.fields.n.doubleValue)) || 0);
  const r = await fetch(`${BASE}/labs/${LAB}/iaUso/${d.name.split('/').pop()}?updateMask.fieldPaths=n`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { n: { integerValue: '0' } } }) });
  if (r.status === 200) { zerados++; console.log(`  contador de ${n} → 0 ✓`); } else console.log(`  falhou ${r.status}`);
}
console.log(`Dia ${DIA}: ${hoje.length} contador(es) encontrado(s), ${zerados} zerado(s). Total de contadores no histórico: ${docs.length}.`);
