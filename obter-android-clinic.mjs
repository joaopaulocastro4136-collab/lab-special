// Garante que o app ANDROID do Special Clinic existe no Firebase e baixa o
// google-services.json dele (necessário pro login Google e push no APK).
// Se o app ainda não existir no projeto, cria na hora pela API oficial.
// Saída: escreve o arquivo em DESTINO e o appId em $GITHUB_ENV (CLINIC_ANDROID_APP_ID).
import crypto from 'crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const PACOTE = 'com.laboratorio.specialclinic';
const PROJ = 'laboratorio-special';
const DESTINO = process.env.DESTINO || 'clinic-native/android/app/google-services.json';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
  aud: 'https://oauth2.googleapis.com/token',
  iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }),
})).json();
if (!tok.access_token) { console.error('ERRO: sem token', JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://firebase.googleapis.com/v1beta1' + caminho, {
    method: metodo, headers: H, body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { }
  return { status: r.status, d };
};

// 1) O app Android do Clinic já existe?
const lista = await api('GET', `/projects/${PROJ}/androidApps?pageSize=100`);
let app = ((lista.d && lista.d.apps) || []).find(a => a.packageName === PACOTE);
if (app) {
  console.log(`App Android do Clinic já existe: ${app.appId}`);
} else {
  console.log('App Android do Clinic não existe — criando...');
  const op = await api('POST', `/projects/${PROJ}/androidApps`, { packageName: PACOTE, displayName: 'Special Clinic (Android)' });
  if (op.status >= 300) { console.error('ERRO ao criar:', JSON.stringify(op.d).slice(0, 300)); process.exit(1); }
  // A criação é assíncrona: espera a operação terminar
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const l2 = await api('GET', `/projects/${PROJ}/androidApps?pageSize=100`);
    app = ((l2.d && l2.d.apps) || []).find(a => a.packageName === PACOTE);
    if (app) break;
    console.log(`  aguardando a criação (${i + 1}/20)...`);
  }
  if (!app) { console.error('ERRO: o app não apareceu após a criação.'); process.exit(1); }
  console.log(`App Android do Clinic criado: ${app.appId}`);
}

// 2) Baixa o google-services.json
const cfg = await api('GET', `/projects/${PROJ}/androidApps/${app.appId}/config`);
if (!cfg.d || !cfg.d.configFileContents) { console.error('ERRO ao baixar a configuração:', JSON.stringify(cfg.d).slice(0, 300)); process.exit(1); }
writeFileSync(DESTINO, Buffer.from(cfg.d.configFileContents, 'base64'));
console.log(`google-services.json gravado em ${DESTINO} ✓`);

// 3) Exporta o appId pros próximos passos do workflow (registro da SHA)
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `CLINIC_ANDROID_APP_ID=${app.appId}\n`);
console.log(`appId: ${app.appId}`);
