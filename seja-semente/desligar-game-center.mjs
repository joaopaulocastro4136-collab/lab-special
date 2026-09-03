// ═══════════════════════════════════════════════════════════════════════════
//  DESLIGA O GAME CENTER DA VERSÃO
//
//  A Apple recusou o Semeador com:
//    "Your appStoreVersion has gameCenterConfigurations relationship but
//     build is missing com.apple.developer.game-center key."
//  Ou seja: a versão da loja está marcada como usando o Game Center (placares,
//  conquistas), mas o aplicativo não tem esse direito — e não usa isso mesmo.
//  O jogo de ludo é só brincadeira local. Este robô desliga o Game Center
//  na versão em preparação de cada aplicativo que estiver assim.
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/desligar-game-center.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
  return { status: r.status, json: j };
};
const erro = (r) => (r.json.errors || []).map(e => `[${e.code || '?'}] ${e.detail || e.title}`).join(' · ') || JSON.stringify(r.json).slice(0, 200);

let deuErro = false;
for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const a = await api('GET', `/v1/apps?filter[bundleId]=${bundle}`);
  const app = (a.json.data || []).find(x => x.attributes.bundleId === bundle);
  if (!app) { console.log('  sem ficha'); continue; }
  const vs = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState`);
  const v = (vs.json.data || []).find(x => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!v) { console.log('  nenhuma versão em preparação — nada a fazer'); continue; }

  const gc = await api('GET', `/v1/appStoreVersions/${v.id}/gameCenterAppVersion`);
  const g = gc.json.data;
  if (!g) { console.log('  ✓ Game Center não está ligado nesta versão'); continue; }
  console.log(`  Game Center encontrado (ligado: ${g.attributes?.enabled})`);
  if (g.attributes?.enabled === false) { console.log('  ✓ já estava desligado'); continue; }

  const p = await api('PATCH', `/v1/gameCenterAppVersions/${g.id}`, {
    data: { type: 'gameCenterAppVersions', id: g.id, attributes: { enabled: false } },
  });
  if (p.status < 300) console.log('  ✓ Game Center DESLIGADO');
  else { deuErro = true; console.log(`  ✗ não desligou: ${p.status} ${erro(p)}`); }
}
console.log(deuErro ? '\n✗ Fim com problema' : '\n✓ Fim');
if (deuErro) process.exit(1);
