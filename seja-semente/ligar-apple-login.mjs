// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRA OS QUATRO APLICATIVOS NO ENTRAR COM A APPLE (Firebase)
//
//  O provedor apple.com estava LIGADO mas VAZIO: nenhum identificador de
//  aplicativo registrado. Quando o iPhone entrega o crachá da Apple, o
//  Firebase confere para qual aplicativo ele foi emitido — com a lista
//  vazia, ele recusa todos. Era isso que dava o erro vermelho na tela.
//
//  Para o aplicativo INSTALADO basta a lista de identificadores. O
//  identificador de serviço e a chave só entram quando o login é pelo
//  navegador, que não é o nosso caso.
//
//  Rodar pelo robô: robo-semente.yml com seja-semente/ligar-apple-login.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const PROJETO = 'seja-semente-app';
const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: SA.token_uri, iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
const TK = (await (await fetch(SA.token_uri, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
})).json()).access_token;
if (!TK) { console.log('✗ sem chave do Google'); process.exit(1); }

const gapi = async (metodo, url, dados) => {
  const r = await fetch('https://identitytoolkit.googleapis.com/admin/v2' + url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: dados ? JSON.stringify(dados) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

console.log('══ Antes ══');
let cfg = await gapi('GET', `/projects/${PROJETO}/defaultSupportedIdpConfigs/apple.com`);
if (cfg.status !== 200) { console.log('✗ o provedor apple.com nem existe: ' + cfg.status); process.exit(1); }
console.log(`  ligado: ${cfg.json.enabled ? 'sim' : 'NÃO'}`);
console.log(`  identificadores registrados: ${(cfg.json.appleSignInConfig?.bundleIds || []).join(', ') || '(nenhum)'}`);

// Junta o que já estava com os quatro nossos, sem apagar nada de ninguém
const juntos = [...new Set([...(cfg.json.appleSignInConfig?.bundleIds || []), ...APPS])];
const p = await gapi('PATCH',
  `/projects/${PROJETO}/defaultSupportedIdpConfigs/apple.com?updateMask=enabled,appleSignInConfig.bundleIds`,
  { enabled: true, appleSignInConfig: { bundleIds: juntos } });
console.log(`\n══ Gravando ══\n  ${p.status === 200 ? '✓ gravado' : '✗ ' + p.status + ': ' + JSON.stringify(p.json.error?.message || p.json).slice(0, 300)}`);

console.log('\n══ Depois ══');
cfg = await gapi('GET', `/projects/${PROJETO}/defaultSupportedIdpConfigs/apple.com`);
const agoraLista = cfg.json.appleSignInConfig?.bundleIds || [];
console.log(`  ligado: ${cfg.json.enabled ? 'sim' : 'NÃO'}`);
console.log(`  identificadores registrados: ${agoraLista.join(', ') || '(nenhum)'}`);
const faltando = APPS.filter(a => !agoraLista.includes(a));
if (faltando.length) { console.log(`\n✗ ainda falta: ${faltando.join(', ')}`); process.exit(1); }
console.log('\n✓ Os quatro estão registrados — o Entrar com a Apple deve funcionar.');
