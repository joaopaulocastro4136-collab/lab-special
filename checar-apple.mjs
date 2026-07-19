// Inspeção (somente leitura): compara a configuração do Sign In with Apple
// dos dois apps no Apple Developer — capacidade, ajustes e perfis.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 900, aud: 'appstoreconnect-v1' });
const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assin;
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  return r.json();
};

for (const bundle of ['com.laboratorio.special', 'com.laboratorio.specialclinic']) {
  console.log(`\n══ ${bundle} ══`);
  const busca = await api(`/bundleIds?filter[identifier]=${bundle}`);
  const reg = (busca.data || []).find(d => d.attributes.identifier === bundle);
  if (!reg) { console.log('  bundle não encontrado'); continue; }
  console.log(`  seedId=${reg.attributes.seedId} | id=${reg.id}`);
  const caps = await api(`/bundleIds/${reg.id}/bundleIdCapabilities`);
  for (const c of caps.data || []) {
    console.log(`  capacidade: ${c.attributes.capabilityType}`);
    console.log(`    settings: ${JSON.stringify(c.attributes.settings)}`);
  }
  const perfis = await api(`/profiles?filter[profileType]=IOS_APP_STORE&limit=50`);
  for (const p of perfis.data || []) {
    // mostra só os perfis dos nossos dois apps (pelo nome usado no repositório)
    if (p.attributes.name === 'LabSpecial AppStore' || p.attributes.name === 'SpecialClinic AppStore') {
      console.log(`  perfil "${p.attributes.name}": ${p.attributes.profileState} (uuid ${p.attributes.uuid})`);
    }
  }
}
console.log('\nInspeção concluída ✓');
