// Prepara o PALMAR nas nuvens da Apple e do Google, num tiro só:
//   1. Registra o app iOS com.sejasemente.palmar no Firebase e imprime o
//      GoogleService-Info.plist (base64) para commitar
//   2. Na Apple: registra o bundle ID, liga a permissão de PUSH e gera o
//      perfil de distribuição "Palmar AppStore" (base64 no log)
//   3. Tenta criar a ficha do app na App Store Connect pela API (a Apple
//      às vezes só deixa pelo site — o log registra a resposta)
// Roda pelo robô (workflow "Robô Seja Semente").
import crypto from 'crypto';

const BUNDLE = 'com.sejasemente.palmar';
const PROJETO = 'seja-semente-app';

// ─── 1. Firebase: app iOS + GoogleService-Info.plist ───
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
async function tokenGoogle() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase', aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TKG = await tokenGoogle();
const gapi = async (metodo, url, corpo) => {
  const r = await fetch('https://firebase.googleapis.com/v1beta1' + url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TKG, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

console.log('══ 1. Firebase (app iOS do Palmar) ══');
let registro = ((await gapi('GET', `/projects/${PROJETO}/iosApps`)).json.apps || []).find(a => a.bundleId === BUNDLE);
if (!registro) {
  const cria = await gapi('POST', `/projects/${PROJETO}/iosApps`, { bundleId: BUNDLE, displayName: 'Palmar (iOS)' });
  if (!(cria.status >= 200 && cria.status < 300)) { console.log(`✗ registro (${cria.status}): ${JSON.stringify(cria.json).slice(0, 300)}`); process.exit(1); }
  for (let i = 0; i < 20 && !registro; i++) {
    await new Promise(r => setTimeout(r, 2000));
    registro = ((await gapi('GET', `/projects/${PROJETO}/iosApps`)).json.apps || []).find(a => a.bundleId === BUNDLE);
  }
}
if (!registro) { console.log('✗ app iOS não apareceu'); process.exit(1); }
console.log(`✓ App iOS: ${registro.appId}`);
const cfg = await gapi('GET', `/projects/${PROJETO}/iosApps/${registro.appId}/config`);
if (cfg.json.configFileContents) {
  console.log('── PLIST nativo-palmar ──');
  const c = cfg.json.configFileContents;
  for (let i = 0; i < c.length; i += 300) console.log(c.slice(i, i + 300));
  console.log('── FIM DO PLIST ──');
} else console.log(`✗ sem plist (${cfg.status})`);

// ─── 2. Apple: bundle ID + PUSH + perfil ───
console.log('\n══ 2. Apple (bundle, push e perfil) ══');
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agoraA = Math.floor(Date.now() / 1000);
const b64a = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64a({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64a({ iss: ISSUER, iat: agoraA, exp: agoraA + 1200, aud: 'appstoreconnect-v1' });
const assinA = crypto.sign('sha256', Buffer.from(semAssin), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assinA;
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : {};
  return { status: r.status, json };
};

// Certificado de distribuição (o mesmo dos outros)
const perfilRef = await api('GET', `/profiles?filter[name]=${encodeURIComponent('SpecialClinic AppStore')}&include=certificates&fields[certificates]=serialNumber`);
const certIds = ((perfilRef.json.data || [])[0]?.relationships?.certificates?.data || []).map(c => c.id);
if (!certIds.length) { console.log('✗ certificado não encontrado'); process.exit(1); }

// Bundle ID
const busca = await api('GET', `/bundleIds?filter[identifier]=${BUNDLE}`);
let bid = (busca.json.data || []).find(d => d.attributes.identifier === BUNDLE);
if (bid) console.log(`✓ Bundle ID já registrado (${bid.id})`);
else {
  const cria = await api('POST', '/bundleIds', {
    data: { type: 'bundleIds', attributes: { identifier: BUNDLE, name: 'Palmar Seja Semente', platform: 'IOS' } },
  });
  if (!(cria.status >= 200 && cria.status < 300)) { console.log(`✗ bundle (${cria.status}): ${JSON.stringify(cria.json.errors || cria.json)}`); process.exit(1); }
  bid = cria.json.data;
  console.log(`✓ Bundle ID registrado (${bid.id})`);
}
// PUSH
const caps = await api('GET', `/bundleIds/${bid.id}/bundleIdCapabilities`);
if ((caps.json.data || []).some(c => c.attributes?.capabilityType === 'PUSH_NOTIFICATIONS')) console.log('✓ PUSH já ligado');
else {
  const liga = await api('POST', '/bundleIdCapabilities', {
    data: { type: 'bundleIdCapabilities', attributes: { capabilityType: 'PUSH_NOTIFICATIONS' }, relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } } } },
  });
  console.log(liga.status < 300 ? '✓ PUSH ligado' : `✗ PUSH (${liga.status}): ${JSON.stringify(liga.json.errors || liga.json).slice(0, 200)}`);
}
// Perfil
const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent('Palmar AppStore')}`);
const antigo = (perfis.json.data || []).find(p => p.attributes.name === 'Palmar AppStore');
if (antigo) await api('DELETE', `/profiles/${antigo.id}`);
const novo = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: 'Palmar AppStore', profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bid.id } },
      certificates: { data: certIds.map(id => ({ type: 'certificates', id })) },
    },
  },
});
if (novo.json.data?.attributes?.profileContent) {
  console.log('✓ Perfil "Palmar AppStore" criado');
  console.log('── PERFIL nativo-palmar ──');
  const c = novo.json.data.attributes.profileContent;
  for (let i = 0; i < c.length; i += 300) console.log(c.slice(i, i + 300));
  console.log('── FIM DO PERFIL ──');
} else { console.log(`✗ perfil (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json).slice(0, 300)}`); process.exit(1); }

// ─── 3. Ficha do app na App Store Connect (a API pode recusar) ───
console.log('\n══ 3. Ficha na App Store Connect ══');
const ja = await api('GET', `/apps?filter[bundleId]=${BUNDLE}`);
if ((ja.json.data || []).length) console.log(`✓ Ficha já existe (${ja.json.data[0].id})`);
else {
  const cria = await api('POST', '/apps', {
    data: {
      type: 'apps',
      attributes: { name: 'Palmar Seja Semente', bundleId: BUNDLE, sku: 'palmar-seja-semente', primaryLocale: 'pt-BR' },
    },
  });
  console.log(`POST /apps → ${cria.status}: ${JSON.stringify(cria.json.errors?.[0] || cria.json.data?.id || cria.json).slice(0, 300)}`);
  if (cria.status >= 300) console.log('⚠ A Apple não deixou criar a ficha pela API — criar no site appstoreconnect.apple.com (Meus apps → + → Novo app, nome "Palmar Seja Semente", bundle com.sejasemente.palmar, SKU palmar-seja-semente).');
}
console.log('\n✓ Fim');
