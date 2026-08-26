// Por que a Apple recusa o envio com "não pode ser analisado" e não diz o
// motivo. Confere os bloqueios que ela NÃO conta nessa mensagem.
// Rodar pelo robô: ativar-apple.yml com seja-semente/checar-envio.mjs
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
  if (!app) { console.log('  ✗ sem ficha'); continue; }

  // 1. A declaração de privacidade (as "etiquetas" da loja) — obrigatória
  const pv = await api(`/v1/apps/${app.id}/appDataUsagePublishState`);
  const pub = pv.json.data?.attributes?.published;
  console.log(`  Privacidade publicada: ${pv.status === 200 ? (pub ? '✓ SIM' : '✗ NÃO — é isso que trava') : '? ' + pv.status}`);
  const us = await api(`/v1/apps/${app.id}/appDataUsages?limit=50&include=category,purpose,dataProtection`);
  console.log(`  Respostas de privacidade gravadas: ${(us.json.data || []).length}`);

  // 2. A resposta de criptografia no envio pendurado
  const vs = await api(`/v1/apps/${app.id}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState,releaseType,earliestReleaseDate,downloadable`);
  const v = (vs.json.data || []).find(x => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!v) { console.log('  ✗ sem versão em preparação'); continue; }
  console.log(`  Versão ${v.attributes.versionString} · ${v.attributes.appStoreState} · lançamento ${v.attributes.releaseType}`);
  const b = await api(`/v1/appStoreVersions/${v.id}/build?fields[builds]=version,usesNonExemptEncryption,processingState`);
  const ba = b.json.data?.attributes;
  console.log(`  Envio nº ${ba?.version || '—'} · criptografia respondida: ${ba?.usesNonExemptEncryption === null || ba?.usesNonExemptEncryption === undefined ? '✗ NÃO' : '✓ ' + ba.usesNonExemptEncryption}`);

  // 3. Preço e disponibilidade
  const preco = await api(`/v1/apps/${app.id}/appPriceSchedule?include=baseTerritory,manualPrices`);
  console.log(`  Preço: ${preco.status === 200 && preco.json.data ? '✓' : '✗ ' + preco.status}`);
  const disp = await api(`/v1/apps/${app.id}/appAvailabilityV2`);
  console.log(`  Disponibilidade: ${disp.status === 200 ? '✓' : '✗ ' + disp.status}`);

  // 4. O ícone grande da loja
  const ai = await api(`/v1/apps/${app.id}/appInfos`);
  const info = ai.json.data?.[0];
  console.log(`  Estado da ficha: ${info?.attributes?.appStoreState || '—'} · idade: ${info?.attributes?.appStoreAgeRating || '(sem resposta)'}`);
}
console.log('\n✓ Fim');
