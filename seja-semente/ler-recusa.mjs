// Depois que a Apple RECUSA uma versão na análise: mostra o estado de cada
// envio (reviewSubmissions) e dos itens dele. O texto da recusa em si a
// Apple só entrega no site (App Store Connect → Mensagens do App Review)
// e no e-mail — a API não tem esse texto. Aqui a gente confere o que dá.
// Rodar pelo robô: ativar-apple.yml com seja-semente/ler-recusa.mjs
import crypto from 'crypto';
const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  const t = await r.text();
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { cru: t.slice(0, 200) }; }
  return { status: r.status, json: j };
};
for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const r = await api(`/v1/apps?filter[bundleId]=${bundle}`);
  const app = (r.json.data || []).find(a => a.attributes.bundleId === bundle);
  if (!app) { console.log('  sem ficha'); continue; }
  const vs = await api(`/v1/apps/${app.id}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState,appVersionState,reviewType,createdDate`);
  for (const v of vs.json.data || []) {
    const a = v.attributes;
    console.log(`  Versão ${a.versionString} · ${a.appStoreState} / ${a.appVersionState || '—'} · tipo ${a.reviewType || '—'} · criada ${a.createdDate}`);
  }
  const rs = await api(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=5&include=items&fields[reviewSubmissions]=state,submittedDate,platform,items&fields[reviewSubmissionItems]=state,appStoreVersion`);
  if (rs.status !== 200) { console.log('  envios → ' + rs.status + ' ' + JSON.stringify(rs.json).slice(0, 200)); continue; }
  const itens = new Map((rs.json.included || []).map(i => [i.id, i]));
  for (const s of rs.json.data || []) {
    console.log(`  Envio ${s.id} · ${s.attributes.state} · enviado ${s.attributes.submittedDate || '—'}`);
    for (const it of s.relationships?.items?.data || []) {
      const x = itens.get(it.id);
      console.log(`     item ${it.id} · ${x?.attributes?.state || '?'}`);
    }
  }
}
console.log('\n✓ Fim');
