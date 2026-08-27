// Raio-x da ficha de loja: mostra, cru, tudo que a Apple exige antes de deixar
// enviar — inclusive as coisas que não aparecem na conferência normal
// (privacidade do app, direitos de conteúdo, categoria, preço, compliance).
import crypto from 'crypto';
const APPS = {
  central: 'com.sejasemente.central', semeador: 'com.sejasemente.semeador',
  palmar: 'com.sejasemente.palmar', colheita: 'com.sejasemente.colheita',
};
const QUAL = (process.env.APP || '').trim() || 'central';
const KEY_ID = process.env.ASC_KEY_ID.trim(), ISSUER = process.env.ASC_ISSUER_ID.trim(), P8 = process.env.ASC_KEY_P8;
function jwt() {
  const t = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const s = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: t, exp: t + 1200, aud: 'appstoreconnect-v1' });
  return s + '.' + crypto.sign('sha256', Buffer.from(s), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
async function api(m, c, b) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + c, {
    method: m, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
  return { status: r.status, dados: d, ok: r.status < 300, cru: t };
}

const bundle = APPS[QUAL];
const apps = await api('GET', `/v1/apps?filter[bundleId]=${bundle}&include=appInfos`);
const app = (apps.dados.data || []).find(a => a.attributes.bundleId === bundle);
console.log(`\n══════ ${app.attributes.name} (${app.id}) ══════`);
console.log('contentRightsDeclaration:', app.attributes.contentRightsDeclaration);
console.log('availableInNewTerritories:', app.attributes.availableInNewTerritories);

// Categoria e estado da ficha
const infos = await api('GET', `/v1/apps/${app.id}/appInfos?include=primaryCategory,secondaryCategory`);
for (const i of (infos.dados.data || [])) {
  console.log(`appInfo ${i.id}: estado=${i.attributes.appStoreState} · idade=${i.attributes.appStoreAgeRating} · marca=${i.attributes.brazilAgeRating}`);
  console.log('   categoria principal:', i.relationships?.primaryCategory?.data?.id || 'VAZIA');
  console.log('   categoria secundária:', i.relationships?.secondaryCategory?.data?.id || '(nenhuma)');
}

// Privacidade do app (o questionário de coleta de dados) — trava o envio
const usos = await api('GET', `/v1/apps/${app.id}/appDataUsages?limit=50`);
console.log('appDataUsages:', usos.status, (usos.dados?.data || []).length, 'resposta(s)');
const pub = await api('GET', `/v1/apps/${app.id}/appDataUsagesPublishState`);
console.log('privacidade publicada:', pub.status, JSON.stringify(pub.dados?.data?.attributes || pub.cru.slice(0, 200)));

// Preço / disponibilidade
const preco = await api('GET', `/v1/apps/${app.id}/appPriceSchedule?include=baseTerritory`);
console.log('tabela de preço:', preco.status, preco.ok ? 'existe' : preco.cru.slice(0, 200));
const terr = await api('GET', `/v1/apps/${app.id}/appAvailabilityV2?include=territoryAvailabilities`);
console.log('disponibilidade:', terr.status, terr.ok ? `${(terr.dados?.included || []).length} território(s)` : terr.cru.slice(0, 200));

// Build e compliance
const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=3`);
for (const b of (builds.dados.data || [])) {
  console.log(`build nº ${b.attributes.version}: ${b.attributes.processingState} · criptografia=${b.attributes.usesNonExemptEncryption}`);
}

// Versão de loja e o envio aberto
const vers = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5&include=build`);
const versao = (vers.dados.data || [])[0];
console.log(`versão ${versao.attributes.versionString}: ${versao.attributes.appStoreState} · lançamento=${versao.attributes.releaseType} · build=${versao.relationships?.build?.data?.id || 'NENHUM'}`);

const envios = await api('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&limit=5&include=items`);
for (const e of (envios.dados?.data || [])) {
  console.log(`envio ${e.id}: estado=${e.attributes.state} · submetido=${e.attributes.submitted} · itens=${(e.relationships?.items?.data || []).length}`);
}

// A tentativa de colocar a versão no envio, com o erro CRU e completo
const aberto = (envios.dados?.data || []).find(e => e.attributes.state === 'READY_FOR_REVIEW');
if (aberto) {
  const t = await api('POST', '/v1/reviewSubmissionItems', {
    data: { type: 'reviewSubmissionItems', relationships: {
      reviewSubmission: { data: { type: 'reviewSubmissions', id: aberto.id } },
      appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } },
    } },
  });
  console.log('\n─── erro cru da Apple ao colocar a versão no envio ───');
  console.log(t.status, t.cru.slice(0, 2000));
}
