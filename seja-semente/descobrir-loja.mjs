// Sonda os caminhos da App Store Connect para achar o questionário de
// privacidade e a tabela de preço. Só lê — não muda nada.
import crypto from 'crypto';
const KEY_ID = process.env.ASC_KEY_ID.trim(), ISSUER = process.env.ASC_ISSUER_ID.trim(), P8 = process.env.ASC_KEY_P8;
function jwt() {
  const t = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const s = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: t, exp: t + 1200, aud: 'appstoreconnect-v1' });
  return s + '.' + crypto.sign('sha256', Buffer.from(s), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
async function api(c) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + c, { headers: { Authorization: 'Bearer ' + jwt() } });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
  return { status: r.status, dados: d, cru: t };
}
const app = await api('/v1/apps?filter[bundleId]=com.sejasemente.central');
const ID = (app.dados?.data || []).find(a => a.attributes.bundleId === 'com.sejasemente.central')?.id;
console.log('app central:', ID);

const sondas = [
  '/v1/appDataUsageCategories?limit=60',
  '/v1/appDataUsagePurposes?limit=60',
  '/v1/appDataUsageDataProtections?limit=60',
  `/v1/apps/${ID}/appDataUsages?limit=50&include=category,grouping,purposes,dataProtections`,
  `/v1/apps/${ID}/appDataUsagesPublishState`,
  `/v1/apps/${ID}/appPricePoints?filter[territory]=BRA&limit=3`,
  `/v1/apps/${ID}/appPriceSchedule?include=manualPrices,baseTerritory`,
  `/v1/appPricePoints?filter[app]=${ID}&filter[territory]=BRA&limit=3`,
  `/v2/apps/${ID}/appPriceSchedule`,
  `/v1/apps/${ID}/appAvailabilityV2?include=territoryAvailabilities`,
  `/v1/appDataUsages?filter[app]=${ID}&limit=50`,
  `/v1/apps/${ID}?include=appPriceSchedule,appAvailabilityV2,appInfos,endUserLicenseAgreement`,
];
for (const s of sondas) {
  const r = await api(s);
  const n = Array.isArray(r.dados?.data) ? r.dados.data.length : (r.dados?.data ? 1 : 0);
  console.log(`\n${r.status}  ${s}   → ${n} item(ns)`);
  if (r.status >= 300) { console.log('   ', (r.dados?.errors || []).map(e => e.code + ': ' + e.detail).join(' | ').slice(0, 300)); continue; }
  const amostra = Array.isArray(r.dados?.data) ? r.dados.data.slice(0, 6) : [r.dados?.data];
  for (const x of amostra) if (x) console.log('   ', x.type, x.id, JSON.stringify(x.attributes || {}).slice(0, 220));
  for (const x of (r.dados?.included || []).slice(0, 8)) console.log('   inc:', x.type, x.id, JSON.stringify(x.attributes || {}).slice(0, 160));
}
