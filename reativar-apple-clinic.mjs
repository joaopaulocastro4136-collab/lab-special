// Plano B: desliga e religa o Sign In with Apple da Special Clinic na Apple
// (para forçar os servidores deles a registrarem a ativação de novo) e
// regenera o perfil de distribuição. O perfil novo sai no log em base64.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assin;
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, json: texto ? JSON.parse(texto) : {} };
};

const BUNDLE = 'com.laboratorio.specialclinic';
const PERFIL = 'SpecialClinic AppStore';
const ARQUIVO = 'clinic-native/ios/SpecialClinic_AppStore.mobileprovision';

const busca = await api('GET', `/bundleIds?filter[identifier]=${BUNDLE}`);
const reg = (busca.json.data || []).find(d => d.attributes.identifier === BUNDLE);
if (!reg) { console.log('✗ bundle não encontrado'); process.exit(1); }
console.log(`Bundle ${BUNDLE} (${reg.id})`);

// 1. Desliga a capacidade atual
const caps = await api('GET', `/bundleIds/${reg.id}/bundleIdCapabilities`);
const capApple = (caps.json.data || []).find(c => c.attributes.capabilityType === 'APPLE_ID_AUTH');
if (capApple) {
  const del = await api('DELETE', `/bundleIdCapabilities/${capApple.id}`);
  console.log(del.status === 204 ? '✓ Capacidade desligada' : `✗ Falha ao desligar (${del.status}): ${JSON.stringify(del.json.errors || del.json)}`);
  if (del.status !== 204) process.exit(1);
} else {
  console.log('· Capacidade não estava ligada');
}
await new Promise(r => setTimeout(r, 3000));

// 2. Religa
const liga = await api('POST', '/bundleIdCapabilities', {
  data: {
    type: 'bundleIdCapabilities',
    attributes: {
      capabilityType: 'APPLE_ID_AUTH',
      settings: [{ key: 'APPLE_ID_AUTH_APP_CONSENT', options: [{ key: 'PRIMARY_APP_CONSENT' }] }],
    },
    relationships: { bundleId: { data: { type: 'bundleIds', id: reg.id } } },
  },
});
if (!(liga.status >= 200 && liga.status < 300)) {
  console.log(`✗ Falha ao religar (${liga.status}): ${JSON.stringify(liga.json.errors || liga.json)}`);
  process.exit(1);
}
console.log('✓ Capacidade religada do zero');

// 3. Regenera o perfil (o religamento invalida o antigo)
const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(PERFIL)}&include=certificates&fields[certificates]=serialNumber`);
const antigo = (perfis.json.data || []).find(p => p.attributes.name === PERFIL);
if (!antigo) { console.log('✗ perfil não encontrado'); process.exit(1); }
const certIds = (antigo.relationships?.certificates?.data || []).map(c => c.id);
console.log(`Perfil antigo ${antigo.id} (${antigo.attributes.profileState}) com ${certIds.length} certificado(s)`);
const apaga = await api('DELETE', `/profiles/${antigo.id}`);
if (apaga.status !== 204) { console.log(`✗ falha ao apagar perfil (${apaga.status})`); process.exit(1); }
const novo = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: PERFIL, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: reg.id } },
      certificates: { data: certIds.map(id => ({ type: 'certificates', id })) },
    },
  },
});
if (!(novo.status >= 200 && novo.status < 300) || !novo.json.data?.attributes?.profileContent) {
  console.log(`✗ Falha ao criar perfil novo (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json)}`);
  process.exit(1);
}
console.log(`✓ Perfil novo criado (${novo.json.data.id})`);
console.log(`── PERFIL ${ARQUIVO} ──`);
const conteudo = novo.json.data.attributes.profileContent;
for (let i = 0; i < conteudo.length; i += 300) console.log(conteudo.slice(i, i + 300));
console.log('── FIM DO PERFIL ──');
console.log('\n✓ Reativação concluída');
