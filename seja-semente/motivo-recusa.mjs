// Arranca da Apple o MOTIVO de ela recusar o envio.
//
// O caminho novo (reviewSubmissions) só diz "não pode ser analisado". O
// caminho antigo (appStoreVersionSubmissions) costuma dizer com todas as
// letras o que falta. Aqui a gente pergunta pelos dois e imprime tudo.
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
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { cru: t.slice(0, 300) }; }
  return { status: r.status, json: j };
};
const tudo = (r) => (r.json.errors || []).map(e =>
  `      [${e.code || e.status}] ${e.detail || e.title}${e.source ? ' → ' + JSON.stringify(e.source) : ''}`).join('\n') || '      ' + JSON.stringify(r.json).slice(0, 300);

for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const a = await api('GET', `/v1/apps?filter[bundleId]=${bundle}`);
  const app = (a.json.data || []).find(x => x.attributes.bundleId === bundle);
  if (!app) { console.log('  sem ficha'); continue; }
  const vs = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState`);
  const v = (vs.json.data || []).find(x => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
  if (!v) { console.log('  sem versão em preparação'); continue; }

  // O caminho ANTIGO — é ele que costuma dizer o que falta
  const velho = await api('POST', '/v1/appStoreVersionSubmissions', {
    data: {
      type: 'appStoreVersionSubmissions',
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } },
    },
  });
  console.log(`  caminho antigo → ${velho.status}`);
  console.log(tudo(velho));

  // E o novo, para comparar
  const abertos = await api('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW`);
  let envio = (abertos.json.data || [])[0];
  if (!envio) {
    const cria = await api('POST', '/v1/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } },
    });
    envio = cria.json.data;
    if (!envio) { console.log('  caminho novo → não abriu:'); console.log(tudo(cria)); continue; }
  }
  const item = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: envio.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } },
      },
    },
  });
  console.log(`  caminho novo → ${item.status}`);
  console.log(tudo(item));
}
console.log('\n✓ Fim');
