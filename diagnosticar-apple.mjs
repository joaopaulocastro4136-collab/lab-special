// Diagnóstico completo do "Entrar com Apple" (somente leitura + conserto opcional):
//   1. O provedor apple.com está LIGADO no Firebase Authentication? (peça que ninguém conferiu)
//   2. Alguém já conseguiu entrar com Apple? (procura contas com provedor apple.com)
//   3. Registros recentes de erro gravados pelos apps (logsApp)
// Se CONSERTAR=sim e o provedor estiver desligado, liga na hora.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit',
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

const PROJ = 'laboratorio-special';

// ── 1. Provedor apple.com no Firebase Authentication ──
console.log('══ 1. Provedor apple.com no Firebase Authentication ══');
const idp = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJ}/defaultSupportedIdpConfigs/apple.com`, { headers: H });
const idpJson = await idp.json().catch(() => ({}));
if (idp.status === 404) {
  console.log('  ✗ PROVEDOR APPLE NÃO EXISTE no Firebase — é ESTA a causa provável!');
  if (process.env.CONSERTAR === 'sim') {
    const cria = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJ}/defaultSupportedIdpConfigs?idpId=apple.com`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ enabled: true }),
    });
    const cj = await cria.json().catch(() => ({}));
    console.log(cria.status < 300 ? '  ✓ Provedor apple.com CRIADO e LIGADO agora' : `  ✗ falha ao criar (${cria.status}): ${JSON.stringify(cj).slice(0, 300)}`);
  } else {
    console.log('  (rode com CONSERTAR=sim para ligar automaticamente)');
  }
} else if (idp.status === 200) {
  console.log(`  provedor existe | enabled=${idpJson.enabled === true} | clientId=${idpJson.clientId || '(vazio)'}`);
  if (idpJson.enabled !== true) {
    console.log('  ✗ PROVEDOR APPLE DESLIGADO — é ESTA a causa provável!');
    if (process.env.CONSERTAR === 'sim') {
      const liga = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJ}/defaultSupportedIdpConfigs/apple.com?updateMask=enabled`, {
        method: 'PATCH', headers: H,
        body: JSON.stringify({ enabled: true }),
      });
      console.log(liga.status < 300 ? '  ✓ Provedor apple.com LIGADO agora' : `  ✗ falha ao ligar (${liga.status})`);
    } else {
      console.log('  (rode com CONSERTAR=sim para ligar automaticamente)');
    }
  } else {
    console.log('  ✓ ligado — este lado está ok');
  }
} else {
  console.log(`  aviso: resposta ${idp.status}: ${JSON.stringify(idpJson).slice(0, 200)}`);
}

// ── 2. Alguém já entrou com Apple? ──
console.log('\n══ 2. Contas que já entraram com Apple ══');
const usuarios = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJ}/accounts:query`, {
  method: 'POST', headers: H, body: JSON.stringify({ returnUserInfo: true, limit: '500' }),
});
const uj = await usuarios.json().catch(() => ({}));
const lista = (uj.userInfo || []);
let achou = 0;
for (const u of lista) {
  const provs = (u.providerUserInfo || []).map(p => p.providerId);
  if (provs.includes('apple.com')) {
    achou++;
    console.log(`  ✓ ${u.email || u.localId} entrou com Apple (provedores: ${provs.join(', ')})`);
  }
}
console.log(achou === 0 ? `  nenhuma das ${lista.length} contas tem provedor apple.com (ninguém conseguiu ainda)` : `  total: ${achou}`);

// ── 3. Registros recentes dos apps (logsApp) ──
console.log('\n══ 3. Últimos registros dos apps (logsApp) ══');
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`;
for (const lab of ['principal']) {
  const q = await fetch(`${BASE}:runQuery`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'logsApp', allDescendants: true }],
        orderBy: [{ field: { fieldPath: 'em' }, direction: 'DESCENDING' }],
        limit: 25,
      },
    }),
  });
  const docs = await q.json().catch(() => []);
  for (const d of (Array.isArray(docs) ? docs : [])) {
    if (!d.document) continue;
    const f = d.document.fields || {};
    const plain = {};
    for (const [k, v] of Object.entries(f)) plain[k] = v.stringValue ?? v.integerValue ?? JSON.stringify(v).slice(0, 60);
    console.log('  ' + JSON.stringify(plain).slice(0, 220));
  }
}
console.log('\nDiagnóstico concluído ✓');
