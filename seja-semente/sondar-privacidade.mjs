// Procura por onde a API deixa mexer na declaração de privacidade da loja.
// Imprime o que cada endereço responde, para a gente parar de adivinhar.
import crypto from 'crypto';
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  const t = await r.text();
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
  const erro = j.errors?.[0];
  return `${r.status}${erro ? ' ' + (erro.code || '') + ' ' + String(erro.detail || erro.title).slice(0, 70) : (j.data ? ' · ' + (Array.isArray(j.data) ? j.data.length + ' item(ns)' : 'ok') : '')}`;
};
const r = await (await fetch('https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=com.sejasemente.colheita', { headers: { Authorization: 'Bearer ' + JWT } })).json();
const id = r.data?.[0]?.id;
console.log('app id:', id);
for (const c of [
  `/v1/apps/${id}/appDataUsages`,
  `/v1/apps/${id}/dataUsages`,
  `/v1/apps/${id}/appDataUsagesPublishState`,
  `/v1/apps/${id}/appDataUsagePublishState`,
  `/v2/apps/${id}/appDataUsages`,
  `/v1/appDataUsages?filter[app]=${id}`,
  `/v1/apps/${id}/appPriceSchedule`,
  `/v1/apps/${id}/appAvailabilityV2`,
  `/v1/apps/${id}/appAvailabilities`,
  `/v1/apps/${id}/appStoreVersions?limit=1`,
  `/v1/apps/${id}/appCustomProductPages`,
  `/v1/apps/${id}/appEncryptionDeclarations`,
]) console.log(`  ${c.replace('/v1/apps/'+id, '…')} → ${await api(c)}`);
console.log('\n✓ Fim');
