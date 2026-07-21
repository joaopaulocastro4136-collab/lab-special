// Publica as regras de segurança do Firestore do seja-semente-app:
// só quem estiver logado (Google ou e-mail/senha) lê e escreve.
// Fase de teste — depois refinamos por papel (central × voluntário).
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';

const REGRAS = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

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
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://firebaserules.googleapis.com/v1' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// 1. Cria o conjunto de regras
const rs = await api('POST', `/projects/${PROJETO}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: REGRAS }] },
});
if (!rs.json.name) { console.log(`✗ Falha ao criar regras (${rs.status}): ${JSON.stringify(rs.json).slice(0, 300)}`); process.exit(1); }
console.log(`✓ Regras criadas: ${rs.json.name}`);

// 2. Publica (release) para o Firestore
const releaseName = `projects/${PROJETO}/releases/cloud.firestore`;
const upd = await api('PATCH', `/${releaseName}`, {
  release: { name: releaseName, rulesetName: rs.json.name },
});
if (upd.status === 200) {
  console.log('✓ Regras PUBLICADAS no Firestore');
} else {
  const cria = await api('POST', `/projects/${PROJETO}/releases`, { name: releaseName, rulesetName: rs.json.name });
  console.log(cria.status === 200 ? '✓ Regras PUBLICADAS no Firestore' : `✗ Falha ao publicar (${cria.status}): ${JSON.stringify(cria.json).slice(0, 300)}`);
}
