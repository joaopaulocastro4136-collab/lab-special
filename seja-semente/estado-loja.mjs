// ═══════════════════════════════════════════════════════════════════════════
//  ONDE CADA APLICATIVO ESTÁ NA APPLE
//
//  Mostra, para os quatro: a ficha na loja, o último envio (build), se ele
//  terminou de processar, se passou pela análise do TestFlight e em que pé
//  está a versão da LOJA (que é a que vai para a análise de verdade).
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/estado-loja.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : {} };
};

const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];

for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const r = await api(`/v1/apps?filter[bundleId]=${bundle}`);
  const app = r.json.data?.[0];
  if (!app) { console.log('  ✗ não tem ficha na loja'); continue; }
  console.log(`  Ficha: ${app.attributes.name}  (id ${app.id})`);

  // Os últimos envios
  const bs = await api(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5&fields[builds]=version,processingState,uploadedDate,expired`);
  const builds = bs.json.data || [];
  if (!builds.length) console.log('  Envios: nenhum');
  for (const b of builds) {
    const a = b.attributes;
    const sub = await api(`/v1/betaAppReviewSubmissions?filter[build]=${b.id}&fields[betaAppReviewSubmissions]=betaReviewState`);
    const beta = sub.json.data?.[0]?.attributes?.betaReviewState || 'não enviado';
    console.log(`  Envio nº ${a.version} · ${a.processingState}${a.expired ? ' · VENCIDO' : ''} · teste: ${beta} · ${String(a.uploadedDate).slice(0, 16)}`);
  }

  // A versão da LOJA
  const vs = await api(`/v1/apps/${app.id}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,platform,createdDate`);
  const versoes = vs.json.data || [];
  if (!versoes.length) console.log('  Versão de loja: nenhuma criada');
  for (const v of versoes) {
    console.log(`  Versão de loja ${v.attributes.versionString} · ${v.attributes.appStoreState}`);
  }
}
console.log('\n✓ Fim');
