// Registra os dois apps iOS no projeto Firebase seja-semente-app e imprime
// os GoogleService-Info.plist em base64 (para o login Google nativo no iPhone).
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
const api = async (metodo, url, corpo) => {
  const r = await fetch('https://firebase.googleapis.com/v1beta1' + url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const APPS = [
  { bundle: 'com.sejasemente.central', nome: 'Seja Semente (iOS)', arquivo: 'nativo-central' },
  { bundle: 'com.sejasemente.semeador', nome: 'Semeador (iOS)', arquivo: 'nativo-semeador' },
];

for (const app of APPS) {
  console.log(`\n══ ${app.bundle} ══`);
  const lista = await api('GET', `/projects/${PROJETO}/iosApps`);
  let registro = (lista.json.apps || []).find(a => a.bundleId === app.bundle);
  if (registro) {
    console.log(`  ✓ App iOS já registrado (${registro.appId})`);
  } else {
    const cria = await api('POST', `/projects/${PROJETO}/iosApps`, { bundleId: app.bundle, displayName: app.nome });
    if (!(cria.status >= 200 && cria.status < 300)) {
      console.log(`  ✗ Falha ao registrar (${cria.status}): ${JSON.stringify(cria.json).slice(0, 300)}`);
      continue;
    }
    // espera a operação terminar
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const denovo = await api('GET', `/projects/${PROJETO}/iosApps`);
      registro = (denovo.json.apps || []).find(a => a.bundleId === app.bundle);
      if (registro) break;
    }
    if (!registro) { console.log('  ✗ app não apareceu após criar'); continue; }
    console.log(`  ✓ App iOS registrado (${registro.appId})`);
  }

  const cfg = await api('GET', `/projects/${PROJETO}/iosApps/${registro.appId}/config`);
  if (!cfg.json.configFileContents) { console.log(`  ✗ sem config (${cfg.status})`); continue; }
  console.log(`── PLIST ${app.arquivo} ──`);
  const conteudo = cfg.json.configFileContents;
  for (let i = 0; i < conteudo.length; i += 300) console.log(conteudo.slice(i, i + 300));
  console.log('── FIM DO PLIST ──');
}
console.log('\nFim.');
