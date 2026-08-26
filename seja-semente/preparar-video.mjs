// Prepara o GUARDA-VÍDEOS do projeto (Firebase Storage): garante que o
// depósito de arquivos existe, está ligado ao Firebase e só aceita quem
// está logado. É onde ficam os vídeos dos depoimentos — foto cabe dentro
// do banco, vídeo não cabe.
// Rodar pelo robô: robo-semente.yml com seja-semente/preparar-video.mjs
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
const pedir = async (metodo, url, corpo) => {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// ─── 0. Ligar o serviço de arquivos no Google ───
console.log('══ 0. Serviço de arquivos ══');
const NUMERO = '474886604901'; // número do projeto (o mesmo do GCM_SENDER_ID)
for (const servico of ['storage.googleapis.com', 'firebasestorage.googleapis.com']) {
  const r = await pedir('POST', `https://serviceusage.googleapis.com/v1/projects/${NUMERO}/services/${servico}:enable`, {});
  console.log(r.status === 200
    ? `  ✓ ${servico} ligado`
    : `  ${servico}: ${r.status} ${JSON.stringify(r.json.error?.message || r.json).slice(0, 160)}`);
}
// O Google leva alguns segundos para o serviço valer
await new Promise(r => setTimeout(r, 15000));

// ─── 1. O depósito ───
console.log('\n══ 1. Depósito de arquivos ══');
const lista = await pedir('GET', `https://firebasestorage.googleapis.com/v1beta/projects/${PROJETO}/buckets`);
const baldes = (lista.json.buckets || []).map(b => String(b.name).split('/').pop());
console.log(baldes.length ? `  Já ligados ao Firebase: ${baldes.join(', ')}` : '  Nenhum ligado ainda');

// O nome que o aplicativo usa (vem do GoogleService-Info.plist)
const BALDE = baldes.find(b => b.startsWith(PROJETO)) || `${PROJETO}.firebasestorage.app`;

if (!baldes.includes(BALDE)) {
  // O depósito em si pode nem existir ainda — cria antes de ligar
  const existe = await pedir('GET', `https://storage.googleapis.com/storage/v1/b/${BALDE}`);
  if (existe.status !== 200) {
    const cria = await pedir('POST', `https://storage.googleapis.com/storage/v1/b?project=${PROJETO}`, {
      name: BALDE,
      location: 'SOUTHAMERICA-EAST1',
      storageClass: 'STANDARD',
      iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
    });
    console.log(cria.status === 200
      ? `  ✓ ${BALDE} criado`
      : `  ✗ não deu para criar (${cria.status}): ${JSON.stringify(cria.json.error?.message || cria.json).slice(0, 250)}`);
    await new Promise(r => setTimeout(r, 5000));
  } else {
    console.log(`  ${BALDE} já existe`);
  }
  const liga = await pedir('POST', `https://firebasestorage.googleapis.com/v1beta/projects/${PROJETO}/buckets/${BALDE}:addFirebase`);
  console.log(liga.status === 200
    ? `  ✓ ${BALDE} ligado ao Firebase`
    : `  ✗ não deu para ligar (${liga.status}): ${JSON.stringify(liga.json.error?.message || liga.json).slice(0, 250)}`);
}
console.log(`  Depósito em uso: ${BALDE}`);

// ─── 2. As regras: só quem está logado ───
console.log('\n══ 2. Regras do depósito ══');
const REGRAS = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Só quem entrou com a conta guarda e vê arquivo. Vídeo de depoimento
    // até 200 MB — o suficiente para um recado de celular.
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.resource.size < 200 * 1024 * 1024;
    }
  }
}`;

const rs = await pedir('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJETO}/rulesets`, {
  source: { files: [{ name: 'storage.rules', content: REGRAS }] },
});
if (!rs.json.name) {
  console.log(`  ✗ não deu para criar as regras (${rs.status}): ${JSON.stringify(rs.json.error?.message || rs.json).slice(0, 250)}`);
  process.exit(1);
}
console.log(`  ✓ Regras criadas: ${rs.json.name}`);

const nomeRelease = `projects/${PROJETO}/releases/firebase.storage%2F${BALDE}`;
const upd = await pedir('PATCH', `https://firebaserules.googleapis.com/v1/${nomeRelease}`, {
  release: { name: `projects/${PROJETO}/releases/firebase.storage/${BALDE}`, rulesetName: rs.json.name },
});
if (upd.status === 200) {
  console.log('  ✓ Regras PUBLICADAS no depósito');
} else {
  const cria = await pedir('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJETO}/releases`, {
    name: `projects/${PROJETO}/releases/firebase.storage/${BALDE}`, rulesetName: rs.json.name,
  });
  console.log(cria.status === 200
    ? '  ✓ Regras PUBLICADAS no depósito'
    : `  ✗ não deu para publicar (${cria.status}): ${JSON.stringify(cria.json.error?.message || cria.json).slice(0, 250)}`);
}
console.log('\n✓ Fim');
