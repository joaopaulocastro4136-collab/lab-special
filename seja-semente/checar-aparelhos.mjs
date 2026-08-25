// Mostra os iPhones registrados para notificação de chamada (coleção
// aparelhos): quantos são, de quem e de qual app. O token nunca aparece
// inteiro — só o comecinho, para diferenciar aparelhos.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: SA.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: SA.token_uri, iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
const r = await fetch(SA.token_uri, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
});
const TK = (await r.json()).access_token;

const docs = await (await fetch(
  `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents/aparelhos?pageSize=100`,
  { headers: { Authorization: 'Bearer ' + TK } }
)).json();

const lista = docs.documents || [];
console.log(`Aparelhos registrados: ${lista.length}`);
for (const d of lista) {
  const f = d.fields || {};
  const token = d.name.split('/').pop();
  console.log(`  ${token.slice(0, 8)}… · ${f.nome?.stringValue || '?'} · app ${f.app?.stringValue || '?'} · uid ${String(f.uid?.stringValue || '?').slice(0, 8)}…`);
}
if (!lista.length) console.log('  (nenhum ainda — o app precisa estar na versão 6.8, aberto uma vez, com a notificação PERMITIDA)');
