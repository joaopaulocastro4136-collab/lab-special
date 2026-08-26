// Em vez de adivinhar endereços, pede para a própria Apple listar tudo o que
// ela tem pendurado no aplicativo e na versão. É assim que a gente descobre
// se existe algum caminho para a declaração de privacidade.
import crypto from 'crypto';
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (c) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + c, { headers: { Authorization: 'Bearer ' + JWT } });
  const t = await r.text();
  try { return { status: r.status, json: JSON.parse(t) }; } catch (e) { return { status: r.status, json: {} }; }
};

const a = await api('/v1/apps?filter[bundleId]=com.sejasemente.colheita');
const app = a.json.data?.[0];
console.log('══ Tudo o que a Apple tem no APLICATIVO ══');
console.log(Object.keys(app?.relationships || {}).sort().join('\n'));

const vs = await api(`/v1/apps/${app.id}/appStoreVersions?limit=3`);
const v = (vs.json.data || []).find(x => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
console.log('\n══ Tudo o que ela tem na VERSÃO ══');
console.log(Object.keys(v?.relationships || {}).sort().join('\n'));
console.log('\nAtributos da versão:', JSON.stringify(v?.attributes, null, 1));

const ai = await api(`/v1/apps/${app.id}/appInfos`);
console.log('\n══ Tudo o que ela tem na FICHA ══');
console.log(Object.keys(ai.json.data?.[0]?.relationships || {}).sort().join('\n'));
console.log('\nAtributos da ficha:', JSON.stringify(ai.json.data?.[0]?.attributes, null, 1));
console.log('\n✓ Fim');
