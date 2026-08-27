// Por que o ENTRAR COM A APPLE não entra: confere as duas pontas.
//  1. Na Apple: a permissão está ligada em cada identificador?
//  2. No Firebase: o provedor apple.com está ligado, e com o quê?
// Rodar pelo robô: ativar-apple.yml com seja-semente/checar-apple-login.mjs
import crypto from 'crypto';

const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];
const PROJETO = 'seja-semente-app';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : {} };
};

console.log('══ 1. Na Apple ══');
for (const bundle of APPS) {
  const b = await api(`/bundleIds?filter[identifier]=${bundle}`);
  const bid = b.json.data?.[0];
  if (!bid) { console.log(`  ${bundle}: ✗ identificador não existe`); continue; }
  const caps = await api(`/bundleIds/${bid.id}/bundleIdCapabilities`);
  const lista = (caps.json.data || []).map(c => c.attributes?.capabilityType);
  const tem = lista.includes('APPLE_ID_AUTH');
  console.log(`  ${bundle}: ${tem ? '✓ Entrar com a Apple ligado' : '✗ FALTA Entrar com a Apple'} · ${lista.join(', ')}`);
  // COMO ela foi configurada: aplicativo principal ou agrupado com outro?
  // Agrupado apontando para o lugar errado é o que faz a Apple recusar com
  // "Inscrição não concluída" mesmo com tudo o resto certo.
  const auth = (caps.json.data || []).find(c => c.attributes?.capabilityType === 'APPLE_ID_AUTH');
  if (auth) console.log(`      configuração: ${JSON.stringify(auth.attributes?.settings || 'nenhuma')}`);
}

console.log('\n══ 2. No Firebase ══');
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: SA.token_uri, iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
const tk = await (await fetch(SA.token_uri, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
})).json();
const TKG = tk.access_token;
if (!TKG) { console.log('  ✗ sem chave do Google'); process.exit(1); }
const gapi = async (url) => {
  const r = await fetch('https://identitytoolkit.googleapis.com/admin/v2' + url, { headers: { Authorization: 'Bearer ' + TKG } });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const cfg = await gapi(`/projects/${PROJETO}/defaultSupportedIdpConfigs/apple.com`);
console.log(`  apple.com: ${cfg.status} ${cfg.status === 200 ? (cfg.json.enabled ? '✓ LIGADO' : '✗ existe mas DESLIGADO') : '✗ NÃO EXISTE'}`);
if (cfg.status === 200) {
  console.log(`    identificador de serviço: ${cfg.json.clientId || '(vazio)'}`);
  const s = cfg.json.appleSignInConfig || {};
  console.log(`    time da Apple: ${s.teamId || '(vazio)'} · chave: ${s.keyId || '(vazio)'} · segredo: ${cfg.json.clientSecret ? 'posto' : '(vazio)'}`);
  console.log(`    identificadores de app registrados: ${(s.bundleIds || []).join(', ') || '(nenhum)'}`);
}

// Os quatro identificadores precisam estar listados aqui para o login
// do aplicativo INSTALADO ser aceito
const faltando = APPS.filter(a => !((cfg.json.appleSignInConfig?.bundleIds) || []).includes(a));
if (faltando.length) console.log(`\n  ⚠ FALTA registrar no Firebase: ${faltando.join(', ')}`);
else console.log('\n  ✓ os quatro identificadores estão registrados no Firebase');
console.log('\n✓ Fim');
