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

// Os endereços dos quatro aplicativos na web
const DOMINIOS = [
  'localhost',
  `${PROJETO}.firebaseapp.com`,
  `${PROJETO}.web.app`,
  'seja-semente-semeador.web.app',
  'seja-semente-semeador.firebaseapp.com',
  'seja-semente-palmar.web.app',
  'seja-semente-palmar.firebaseapp.com',
  'seja-semente-colheita.web.app',
  'seja-semente-colheita.firebaseapp.com',
];

const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config`;
const cabecalho = { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' };

// Lê o que já está autorizado e SOMA os nossos — nunca apaga o que alguém
// tenha acrescentado à mão no console do Firebase
const atual = await fetch(url, { headers: cabecalho }).then(r => r.json()).catch(() => ({}));
const jaTinha = atual.authorizedDomains || [];
const todos = [...new Set([...jaTinha, ...DOMINIOS])];
const novos = todos.filter(d => !jaTinha.includes(d));

if (!novos.length) {
  console.log('✓ Nada a fazer — já estavam todos autorizados: ' + todos.join(', '));
} else {
  const r = await fetch(`${url}?updateMask=authorizedDomains`, {
    method: 'PATCH', headers: cabecalho, body: JSON.stringify({ authorizedDomains: todos }),
  });
  const json = await r.json().catch(() => ({}));
  if (r.status === 200) {
    console.log('✓ Acrescentados: ' + novos.join(', '));
    console.log('  Lista completa: ' + (json.authorizedDomains || todos).join(', '));
  } else {
    console.log(`✗ Falha (${r.status}): ${JSON.stringify(json).slice(0, 300)}`);
    process.exit(1);
  }
}
