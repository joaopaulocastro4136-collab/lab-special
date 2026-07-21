// Publica a VERSÃO WEB dos aplicativos no Firebase Hosting — para abrir no
// Mac (ou qualquer computador) direto no navegador, com o mesmo banco:
//   Central Seja Semente → https://seja-semente-app.web.app
//   Semeador             → https://seja-semente-semeador.web.app
// Rodar pelo robô: robo-semente.yml com script seja-semente/hospedar.mjs
import crypto from 'crypto';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const raiz = dirname(fileURLToPath(import.meta.url));
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';

// 1. Compila os dois aplicativos (dist-semente/ e dist-semeador/)
console.log('Instalando dependências e compilando…');
execSync('npm ci --no-audit --no-fund', { cwd: raiz, stdio: 'inherit' });
execSync('node semente/build.mjs', { cwd: raiz, stdio: 'inherit' });
execSync('node semeador/build.mjs', { cwd: raiz, stdio: 'inherit' });

// 2. Token do Google (mesmo caminho dos outros robôs)
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
  const r = await fetch('https://firebasehosting.googleapis.com/v1beta1' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// Garante que o site existe (o padrão tem o id do projeto; o do Semeador é criado)
async function garantirSite(siteId) {
  const existe = await api('GET', `/projects/${PROJETO}/sites/${siteId}`);
  if (existe.status === 200) return true;
  const cria = await api('POST', `/projects/${PROJETO}/sites?siteId=${siteId}`, {});
  if (cria.status === 200) { console.log(`✓ Site ${siteId} criado`); return true; }
  console.log(`✗ Site ${siteId}: ${cria.status} ${JSON.stringify(cria.json).slice(0, 200)}`);
  return false;
}

// Sobe uma pasta dist para um site do Hosting
async function publicar(siteId, pasta) {
  if (!(await garantirSite(siteId))) return false;
  const arquivos = {};
  const conteudos = {};
  for (const nome of readdirSync(join(raiz, pasta))) {
    const gz = zlib.gzipSync(readFileSync(join(raiz, pasta, nome)), { level: 9 });
    const hash = crypto.createHash('sha256').update(gz).digest('hex');
    arquivos['/' + nome] = hash;
    conteudos[hash] = gz;
  }
  const ver = await api('POST', `/sites/${siteId}/versions`, { config: {
    rewrites: [{ glob: '**', path: '/index.html' }],
    // Sem cache: garante que o navegador sempre pegue a versão mais nova
    headers: [{ glob: '**', headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }],
  } });
  if (!ver.json.name) { console.log(`✗ versão: ${ver.status} ${JSON.stringify(ver.json).slice(0, 200)}`); return false; }
  const pop = await api('POST', `/${ver.json.name}:populateFiles`, { files: arquivos });
  for (const hash of pop.json.uploadRequiredHashes || []) {
    const r = await fetch(`${pop.json.uploadUrl}/${hash}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/octet-stream' },
      body: conteudos[hash],
    });
    if (r.status !== 200) { console.log(`✗ upload ${hash.slice(0, 8)}: ${r.status}`); return false; }
  }
  await api('PATCH', `/${ver.json.name}?update_mask=status`, { status: 'FINALIZED' });
  const rel = await api('POST', `/sites/${siteId}/releases?versionName=${ver.json.name}`, {});
  const ok = rel.status === 200;
  console.log(ok ? `✓ ${siteId} NO AR → https://${siteId}.web.app` : `✗ release ${siteId}: ${rel.status} ${JSON.stringify(rel.json).slice(0, 200)}`);
  return ok;
}

const okCentral = await publicar(PROJETO, 'dist-semente');
const okSemeador = await publicar('seja-semente-semeador', 'dist-semeador');
if (!okCentral && !okSemeador) process.exit(1);
