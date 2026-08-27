// Duas coisas que ainda não olhei e que travam envio:
//  1. IDIOMAS: se a ficha tem outro idioma além do português com o texto
//     vazio, a Apple recusa a versão inteira.
//  2. PAÍSES: aplicativo novo precisa ter os países onde vai ficar
//     disponível. Se isso nunca foi escolhido, ela também recusa.
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
const erro = (r) => (r.json.errors || []).map(e => `[${e.code || '?'}] ${e.detail || e.title}`).join(' · ');
const vazio = (v) => !String(v || '').trim();

for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const a = await api('GET', `/v1/apps?filter[bundleId]=${bundle}`);
  const app = (a.json.data || []).find(x => x.attributes.bundleId === bundle);
  if (!app) { console.log('  sem ficha'); continue; }

  // ─── 1. Idiomas ───
  const infos = await api('GET', `/v1/apps/${app.id}/appInfos`);
  const info = infos.json.data?.[0];
  const il = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations?limit=50`);
  console.log(`  Idiomas da ficha: ${(il.json.data || []).map(l => l.attributes.locale).join(', ')}`);
  for (const l of (il.json.data || [])) {
    const at = l.attributes;
    const falta = [];
    if (vazio(at.name)) falta.push('nome');
    if (vazio(at.subtitle)) falta.push('subtítulo');
    if (vazio(at.privacyPolicyUrl)) falta.push('política de privacidade');
    console.log(`    [${at.locale}] ${falta.length ? '✗ falta ' + falta.join(', ') : '✓'}`);
  }

  const vs = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState`);
  const v = (vs.json.data || []).find(x => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  const vl = await api('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  console.log(`  Idiomas da versão: ${(vl.json.data || []).map(l => l.attributes.locale).join(', ')}`);
  for (const l of (vl.json.data || [])) {
    const at = l.attributes;
    const falta = [];
    if (vazio(at.description)) falta.push('descrição');
    if (vazio(at.keywords)) falta.push('palavras');
    if (vazio(at.supportUrl)) falta.push('suporte');
    const sets = await api('GET', `/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots`);
    const n = (sets.json.data || []).reduce((s, c) => s + (c.relationships?.appScreenshots?.data || []).length, 0);
    if (!n) falta.push('fotos de tela');
    console.log(`    [${at.locale}] ${falta.length ? '✗ falta ' + falta.join(', ') : '✓'} (${n} foto(s))`);
  }

  // ─── 2. Países ───
  const disp = await api('GET', `/v2/appAvailabilities/${app.id}?include=territoryAvailabilities&limit[territoryAvailabilities]=50`);
  if (disp.status === 200) {
    const t = (disp.json.included || []).filter(x => x.type === 'territoryAvailabilities');
    const liberados = t.filter(x => x.attributes?.available).length;
    console.log(`  Países: ${disp.json.data?.attributes?.availableInNewTerritories ? 'novos automáticos' : 'novos NÃO automáticos'} · ${liberados} liberado(s) de ${t.length} listado(s)`);
  } else {
    console.log(`  Países: ✗ ${disp.status} ${erro(disp)}  ← se não existe, nunca foi escolhido`);
  }
}
console.log('\n✓ Fim');
