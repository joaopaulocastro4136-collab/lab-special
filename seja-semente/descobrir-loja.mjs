// Lista os códigos que a Apple usa no questionário de privacidade e na tabela
// de preço, para o robô da loja poder preencher os dois sozinho.
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

console.log('─── categorias de dado ───');
const cat = await api('/v1/appDataUsageCategories?limit=100');
for (const c of (cat.dados?.data || [])) console.log(' ', c.id, '·', c.attributes?.deprecated ? '(antigo)' : '');
console.log(cat.status, (cat.dados?.data || []).length, 'categoria(s)');

console.log('\n─── finalidades ───');
const fin = await api('/v1/appDataUsagePurposes?limit=100');
for (const c of (fin.dados?.data || [])) console.log(' ', c.id, JSON.stringify(c.attributes || {}));

console.log('\n─── proteções ───');
const pro = await api('/v1/appDataUsageDataProtections?limit=100');
for (const c of (pro.dados?.data || [])) console.log(' ', c.id, JSON.stringify(c.attributes || {}));

console.log('\n─── preço grátis (BRA) ───');
const terr = await api('/v1/territories?limit=200');
const bra = (terr.dados?.data || []).find(t => t.id === 'BRA');
console.log('território BRA:', bra ? 'ok' : 'não achei');
const app = await api('/v1/apps?filter[bundleId]=com.sejasemente.central');
const idApp = (app.dados?.data || [])[0]?.id;
console.log('app central:', idApp);
const pontos = await api(`/v2/apps/${idApp}/appPricePoints?filter[territory]=BRA&limit=5`);
console.log('pontos de preço:', pontos.status);
for (const p of (pontos.dados?.data || []).slice(0, 5)) console.log(' ', p.id, JSON.stringify(p.attributes || {}));
if (pontos.status >= 300) console.log(pontos.cru.slice(0, 500));
