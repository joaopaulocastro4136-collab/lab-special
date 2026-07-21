// Liga/desliga a FASE DE TESTE ABERTA: com aberto=true, qualquer conta Google
// entra direto na central (sem código/convite). ABRIR_TESTE=false para fechar.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';
const ABERTO = (process.env.ABRIR_TESTE || 'true').trim() !== 'false';

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

const url = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents/config/acesso`;
const r = await fetch(url, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { abertoParaTeste: { booleanValue: ABERTO }, atualizadoEm: { timestampValue: new Date().toISOString() } } }),
});
if (r.status === 200) console.log(`✓ Fase de teste ${ABERTO ? 'ABERTA — qualquer conta Google entra direto' : 'FECHADA — volta a exigir código/e-mail'}`);
else { console.log(`✗ Falha (${r.status}): ${(await r.text()).slice(0, 300)}`); process.exit(1); }
