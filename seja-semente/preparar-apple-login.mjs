// Liga o ENTRAR COM A APPLE nos quatro aplicativos.
//
// A Apple exige (diretriz 4.8) que quem oferece login do Google ofereça
// também uma opção equivalente. É uma das reprovações mais comuns.
//
// O que este robô faz:
//   1. Na Apple: liga a permissão "Sign in with Apple" em cada identificador
//   2. Refaz os perfis de assinatura (o perfil precisa carregar a permissão)
//   3. No Firebase: liga o provedor apple.com
// Rodar pelo robô: robo-semente.yml com seja-semente/preparar-apple-login.mjs
import crypto from 'crypto';

const APPS = [
  { bundle: 'com.sejasemente.central',  perfil: 'SejaSemente AppStore', pasta: 'nativo-central' },
  { bundle: 'com.sejasemente.semeador', perfil: 'Semeador AppStore',      pasta: 'nativo-semeador' },
  { bundle: 'com.sejasemente.palmar',   perfil: 'Palmar AppStore',        pasta: 'nativo-palmar' },
  { bundle: 'com.sejasemente.colheita', perfil: 'Colheita AppStore',      pasta: 'nativo-colheita' },
];
const PROJETO = 'seja-semente-app';

// ─── Apple ───
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : {} };
};

console.log('══ 1. Permissão na Apple ══');
const certRef = await api('GET', '/profiles?filter[profileType]=IOS_APP_STORE&include=certificates&fields[certificates]=serialNumber&limit=1');
const certIds = ((certRef.json.data || [])[0]?.relationships?.certificates?.data || []).map(c => c.id);
if (!certIds.length) { console.log('✗ certificado de distribuição não encontrado'); process.exit(1); }

const perfisNovos = [];
for (const app of APPS) {
  console.log(`\n── ${app.bundle} ──`);
  const busca = await api('GET', `/bundleIds?filter[identifier]=${app.bundle}`);
  const bid = (busca.json.data || [])[0];
  if (!bid) { console.log('  ✗ identificador não encontrado'); continue; }

  const caps = await api('GET', `/bundleIds/${bid.id}/bundleIdCapabilities`);
  const jaTem = (caps.json.data || []).some(c => c.attributes?.capabilityType === 'APPLE_ID_AUTH');
  if (jaTem) console.log('  ✓ Entrar com a Apple já estava ligado');
  else {
    const liga = await api('POST', '/bundleIdCapabilities', {
      data: {
        type: 'bundleIdCapabilities',
        attributes: {
          capabilityType: 'APPLE_ID_AUTH',
          // A Apple pede que se escolha o tipo: este aplicativo é o
          // principal (não é uma extensão de outro app já existente)
          settings: [{ key: 'APPLE_ID_AUTH_APP_CONSENT', options: [{ key: 'PRIMARY_APP_CONSENT' }] }],
        },
        relationships: { bundleId: { data: { type: 'bundleIds', id: bid.id } } },
      },
    });
    console.log(liga.status < 300 ? '  ✓ Entrar com a Apple ligado'
      : `  ✗ ${liga.status}: ${JSON.stringify(liga.json.errors?.[0]?.detail || liga.json).slice(0, 200)}`);
  }

  // O perfil precisa ser refeito para carregar a permissão nova
  const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(app.perfil)}`);
  const antigo = (perfis.json.data || [])[0];
  if (antigo) await api('DELETE', `/profiles/${antigo.id}`);
  const novo = await api('POST', '/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: app.perfil, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: bid.id } },
        certificates: { data: certIds.map(id => ({ type: 'certificates', id })) },
      },
    },
  });
  if (novo.json.data?.attributes?.profileContent) {
    console.log(`  ✓ Perfil "${app.perfil}" refeito`);
    perfisNovos.push({ pasta: app.pasta, perfil: app.perfil, conteudo: novo.json.data.attributes.profileContent });
  } else {
    console.log(`  ✗ perfil: ${novo.status} ${JSON.stringify(novo.json.errors?.[0]?.detail || novo.json).slice(0, 200)}`);
  }
}

// ─── Firebase: liga o provedor apple.com ───
console.log('\n══ 2. Provedor no Firebase ══');
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
async function tokenGoogle() {
  const a = Math.floor(Date.now() / 1000);
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase', aud: SA.token_uri, iat: a, exp: a + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TKG = await tokenGoogle();
const gapi = async (metodo, url, corpo) => {
  const r = await fetch('https://identitytoolkit.googleapis.com/admin/v2' + url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TKG, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const jaLigado = await gapi('GET', `/projects/${PROJETO}/defaultSupportedIdpConfigs/apple.com`);
if (jaLigado.status === 200 && jaLigado.json.enabled) {
  console.log('  ✓ apple.com já estava ligado');
} else if (jaLigado.status === 200) {
  const liga = await gapi('PATCH', `/projects/${PROJETO}/defaultSupportedIdpConfigs/apple.com?updateMask=enabled`, { enabled: true });
  console.log(liga.status === 200 ? '  ✓ apple.com ligado' : `  ✗ ${liga.status}: ${JSON.stringify(liga.json.error?.message || liga.json).slice(0, 250)}`);
} else {
  // Para aplicativo instalado basta o provedor existir; o identificador de
  // serviço e a chave só são necessários para o login pelo NAVEGADOR
  const cria = await gapi('POST', `/projects/${PROJETO}/defaultSupportedIdpConfigs?idpId=apple.com`, { enabled: true });
  console.log(cria.status === 200 ? '  ✓ apple.com criado e ligado'
    : `  ✗ ${cria.status}: ${JSON.stringify(cria.json.error?.message || cria.json).slice(0, 300)}`);
}

// ─── Os perfis novos, para commitar ───
if (perfisNovos.length) {
  console.log('\n══ 3. Perfis novos (base64) ══');
  for (const p of perfisNovos) {
    console.log(`── PERFIL ${p.pasta} ──`);
    for (let i = 0; i < p.conteudo.length; i += 300) console.log(p.conteudo.slice(i, i + 300));
    console.log(`── FIM ${p.pasta} ──`);
  }
}
console.log('\n✓ Fim');
