// Robô que tenta criar o projeto Firebase "seja-semente" do zero:
// 1. Cria o projeto no Google Cloud (separado do laboratorio-special)
// 2. Liga o Firebase nele
// 3. Cria o app Web e imprime a configuração (para o firebase-config.js)
// 4. Cria o banco Firestore
// 5. Liga a entrada por e-mail/senha (o Google entra depois, pelo console)
// Usa a conta de serviço do segredo FIREBASE_SERVICE_ACCOUNT.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';

// ─── Token de acesso da conta de serviço (JWT RS256 → OAuth2) ───
async function token(escopo) {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: escopo, aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  const j = await r.json();
  if (!j.access_token) { console.error('✗ não consegui token:', JSON.stringify(j)); process.exit(1); }
  return j.access_token;
}

const TK = await token('https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase');

async function api(metodo, url, corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}

async function esperarOperacao(url, rotulo) {
  for (let i = 0; i < 30; i++) {
    const op = await api('GET', url);
    if (op.dados?.done) return op.dados;
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`  aviso: operação ${rotulo} demorou — seguindo assim mesmo`);
  return null;
}

// ─── 1. Cria (ou acha) o projeto no Google Cloud ───
console.log('══ 1. Projeto no Google Cloud ══');
const existe = await api('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJETO}`);
if (existe.status === 200) {
  console.log(`  ✓ Projeto ${PROJETO} já existe`);
} else {
  const cria = await api('POST', 'https://cloudresourcemanager.googleapis.com/v1/projects', {
    projectId: PROJETO, name: 'Seja Semente',
  });
  if (cria.status >= 200 && cria.status < 300) {
    console.log('  Projeto sendo criado…');
    if (cria.dados?.name) await esperarOperacao(`https://cloudresourcemanager.googleapis.com/v1/${cria.dados.name}`, 'criar projeto');
    console.log(`  ✓ Projeto ${PROJETO} criado`);
  } else {
    console.log(`  ✗ Falha ao criar projeto (${cria.status}): ${JSON.stringify(cria.dados?.error || cria.dados || {}).slice(0, 400)}`);
    process.exit(1);
  }
}

// ─── 2. Liga o Firebase no projeto ───
console.log('\n══ 2. Firebase ══');
const temFb = await api('GET', `https://firebase.googleapis.com/v1beta1/projects/${PROJETO}`);
if (temFb.status === 200) {
  console.log('  ✓ Firebase já ligado');
} else {
  const add = await api('POST', `https://firebase.googleapis.com/v1beta1/projects/${PROJETO}:addFirebase`, {});
  if (add.status >= 200 && add.status < 300) {
    if (add.dados?.name) await esperarOperacao(`https://firebase.googleapis.com/v1beta1/${add.dados.name}`, 'ligar firebase');
    console.log('  ✓ Firebase ligado');
  } else {
    console.log(`  ✗ Falha (${add.status}): ${JSON.stringify(add.dados?.error || add.dados || {}).slice(0, 400)}`);
    process.exit(1);
  }
}

// ─── 3. App Web + configuração ───
console.log('\n══ 3. App Web ══');
const appsWeb = await api('GET', `https://firebase.googleapis.com/v1beta1/projects/${PROJETO}/webApps`);
let webApp = (appsWeb.dados?.apps || [])[0];
if (!webApp) {
  const cria = await api('POST', `https://firebase.googleapis.com/v1beta1/projects/${PROJETO}/webApps`, { displayName: 'Seja Semente Apps' });
  if (cria.dados?.name) await esperarOperacao(`https://firebase.googleapis.com/v1beta1/${cria.dados.name}`, 'criar app web');
  const denovo = await api('GET', `https://firebase.googleapis.com/v1beta1/projects/${PROJETO}/webApps`);
  webApp = (denovo.dados?.apps || [])[0];
}
if (!webApp) { console.log('  ✗ app web não apareceu'); process.exit(1); }
console.log(`  ✓ App web: ${webApp.appId}`);
const cfg = await api('GET', `https://firebase.googleapis.com/v1beta1/projects/${PROJETO}/webApps/${webApp.appId}/config`);
console.log('── CONFIG WEB (firebase-config.js) ──');
console.log(JSON.stringify(cfg.dados, null, 2));
console.log('── FIM DA CONFIG ──');

// ─── 4. Firestore ───
console.log('\n══ 4. Firestore ══');
await api('POST', `https://serviceusage.googleapis.com/v1/projects/${PROJETO}/services/firestore.googleapis.com:enable`, {});
await new Promise(r => setTimeout(r, 4000));
const temDb = await api('GET', `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)`);
if (temDb.status === 200) {
  console.log('  ✓ Banco já existe');
} else {
  const db = await api('POST', `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases?databaseId=(default)`, {
    type: 'FIRESTORE_NATIVE', locationId: 'southamerica-east1',
  });
  if (db.status >= 200 && db.status < 300) console.log('  ✓ Banco Firestore criado (São Paulo)');
  else console.log(`  ✗ Banco (${db.status}): ${JSON.stringify(db.dados?.error || db.dados || {}).slice(0, 300)}`);
}

// ─── 5. Entrada por e-mail/senha ───
console.log('\n══ 5. Entrada (Authentication) ══');
await api('POST', `https://serviceusage.googleapis.com/v1/projects/${PROJETO}/services/identitytoolkit.googleapis.com:enable`, {});
await new Promise(r => setTimeout(r, 4000));
const cfgAuth = await api('GET', `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config`);
if (cfgAuth.status !== 200) {
  console.log(`  Config auth ainda não existe (${cfgAuth.status}) — pode precisar abrir Authentication uma vez no console`);
} else {
  const liga = await api('PATCH', `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config?updateMask=signIn.email`, {
    signIn: { email: { enabled: true, passwordRequired: true } },
  });
  console.log(liga.status === 200 ? '  ✓ E-mail/senha ligado' : `  E-mail/senha: ${liga.status}`);
}

console.log('\n✓ Fim — se a config web saiu acima, é colar no firebase-config.js');
