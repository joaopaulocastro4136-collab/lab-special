// Publica o "carteiro" (função que manda push quando nasce uma chamada):
// 1. Liga as APIs necessárias no projeto (functions, run, build, eventarc…)
// 2. Extrai o Team ID da Apple do perfil de distribuição já commitado
// 3. Escreve o .env da função (chave APNs, se os segredos existirem)
// 4. Faz o deploy com o firebase-tools usando a conta de serviço
// Roda pelo robô (workflow "Robô Seja Semente"). Sem os segredos
// APNS_KEY_P8 / APNS_KEY_ID a função sobe mesmo assim, mas fica dormindo.
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const PROJETO = 'seja-semente-app';
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// ─── 1. Liga as APIs (deploy de função gen2 precisa de todas) ───
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
  return (await r.json()).access_token;
}
const TK = await token('https://www.googleapis.com/auth/cloud-platform');
console.log('══ 1. Ligando as APIs ══');
const APIS = ['cloudfunctions.googleapis.com', 'run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'eventarc.googleapis.com', 'pubsub.googleapis.com'];
const liga = await fetch(`https://serviceusage.googleapis.com/v1/projects/${PROJETO}/services:batchEnable`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
  body: JSON.stringify({ serviceIds: APIS }),
});
console.log(`  batchEnable: ${liga.status}`);
if (liga.status >= 300) { console.log(await liga.text()); process.exit(1); }
await new Promise((r) => setTimeout(r, 20000)); // dá um tempo para as APIs acordarem

// ─── 2. Team ID da Apple (está dentro do perfil commitado) ───
const perfil = readFileSync(path.join(raiz, 'nativo-semeador/ios/Semeador_AppStore.mobileprovision'), 'latin1');
const team = /<key>TeamIdentifier<\/key>\s*<array>\s*<string>([A-Z0-9]+)<\/string>/.exec(perfil)?.[1] || '';
console.log(`\n══ 2. Team ID: ${team || 'NÃO ACHEI'} ══`);
if (!team) process.exit(1);

// ─── 3. .env da função (a chave APNs pode ainda não existir) ───
const P8 = process.env.APNS_KEY_P8 || '';
const KEY_ID = process.env.APNS_KEY_ID || '';
const env = [
  `APPLE_TEAM_ID=${team}`,
  `APNS_KEY_ID=${KEY_ID}`,
  `APNS_KEY_P8="${P8.replace(/\r/g, '').replace(/\n/g, '\\n')}"`,
].join('\n') + '\n';
writeFileSync(path.join(raiz, 'carteiro', `.env.${PROJETO}`), env);
console.log(`\n══ 3. Chave APNs nos segredos: ${P8 && KEY_ID ? 'SIM — carteiro vai entregar' : 'ainda não — carteiro sobe dormindo'} ══`);

// ─── 4. Deploy ───
console.log('\n══ 4. Deploy da função ══');
const saPath = '/tmp/sa-seja-semente.json';
writeFileSync(saPath, JSON.stringify(SA));
execSync('npm install --omit=dev --no-audit --no-fund', { cwd: path.join(raiz, 'carteiro'), stdio: 'inherit' });
execSync(`npx -y firebase-tools@14 deploy --only functions:carteiro --project ${PROJETO} --force --non-interactive`, {
  cwd: raiz,
  stdio: 'inherit',
  env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: saPath },
});
console.log('\n✓ Carteiro publicado');
