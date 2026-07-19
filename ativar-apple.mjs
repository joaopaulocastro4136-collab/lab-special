// Robô que ativa o "Sign In with Apple" direto no Apple Developer:
// 1. Liga a capacidade APPLE_ID_AUTH nos dois apps (Lab e Clinic)
// 2. Apaga e recria os dois perfis de distribuição (mesmo nome, mesmo certificado)
// 3. Salva os novos .mobileprovision no lugar dos antigos, prontos pra commitar
import crypto from 'crypto';
import fs from 'fs';

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
  const json = texto ? JSON.parse(texto) : {};
  return { status: r.status, json };
};

const APPS = [
  { bundle: 'com.laboratorio.special', perfil: 'LabSpecial AppStore', arquivo: 'ios/LabSpecial_AppStore.mobileprovision' },
  { bundle: 'com.laboratorio.specialclinic', perfil: 'SpecialClinic AppStore', arquivo: 'clinic-native/ios/SpecialClinic_AppStore.mobileprovision' },
];

let deuErro = false;

for (const app of APPS) {
  console.log(`\n══ ${app.bundle} ══`);

  // ── Acha o registro do bundle ID na Apple ──
  const busca = await api('GET', `/bundleIds?filter[identifier]=${app.bundle}`);
  const registro = (busca.json.data || []).find(d => d.attributes.identifier === app.bundle);
  if (!registro) { console.log('  ✗ Bundle ID não encontrado na Apple!'); deuErro = true; continue; }
  console.log(`  Bundle ID achado (${registro.id})`);

  // ── Passo 2: liga a capacidade "Sign In with Apple" ──
  const caps = await api('GET', `/bundleIds/${registro.id}/bundleIdCapabilities`);
  const jaTem = (caps.json.data || []).some(c => c.attributes.capabilityType === 'APPLE_ID_AUTH');
  if (jaTem) {
    console.log('  ✓ Sign In with Apple já estava ligado');
  } else {
    const liga = await api('POST', '/bundleIdCapabilities', {
      data: {
        type: 'bundleIdCapabilities',
        attributes: { capabilityType: 'APPLE_ID_AUTH', settings: [] },
        relationships: { bundleId: { data: { type: 'bundleIds', id: registro.id } } },
      },
    });
    if (liga.status >= 200 && liga.status < 300) {
      console.log('  ✓ Sign In with Apple LIGADO agora');
    } else {
      console.log(`  ✗ Falha ao ligar (${liga.status}): ${JSON.stringify(liga.json.errors || liga.json)}`);
      deuErro = true;
      continue;
    }
  }

  // ── Passo 3: apaga o perfil antigo e cria um novo com o mesmo nome e certificado ──
  const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(app.perfil)}&include=certificates&fields[certificates]=serialNumber`);
  const antigo = (perfis.json.data || []).find(p => p.attributes.name === app.perfil);
  if (!antigo) { console.log(`  ✗ Perfil "${app.perfil}" não encontrado na Apple!`); deuErro = true; continue; }
  const certIds = (antigo.relationships?.certificates?.data || []).map(c => c.id);
  console.log(`  Perfil antigo achado (${antigo.id}, estado ${antigo.attributes.profileState}) com ${certIds.length} certificado(s)`);
  if (!certIds.length) { console.log('  ✗ Perfil sem certificados — não dá pra recriar igual'); deuErro = true; continue; }

  const apaga = await api('DELETE', `/profiles/${antigo.id}`);
  if (apaga.status !== 204) { console.log(`  ✗ Falha ao apagar o perfil antigo (${apaga.status}): ${JSON.stringify(apaga.json.errors || apaga.json)}`); deuErro = true; continue; }
  console.log('  Perfil antigo apagado');

  const novo = await api('POST', '/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: app.perfil, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: registro.id } },
        certificates: { data: certIds.map(id => ({ type: 'certificates', id })) },
      },
    },
  });
  if (!(novo.status >= 200 && novo.status < 300) || !novo.json.data?.attributes?.profileContent) {
    console.log(`  ✗ Falha ao criar o perfil novo (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json)}`);
    deuErro = true;
    continue;
  }
  fs.writeFileSync(app.arquivo, Buffer.from(novo.json.data.attributes.profileContent, 'base64'));
  console.log(`  ✓ Perfil novo criado (${novo.json.data.id}) e salvo em ${app.arquivo}`);
}

if (deuErro) { console.log('\n✗ Alguma etapa falhou — veja acima'); process.exit(1); }
console.log('\n✓ Tudo pronto: capacidade ligada e perfis novos salvos nos dois apps');
