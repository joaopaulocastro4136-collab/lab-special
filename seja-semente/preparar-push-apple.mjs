// Liga a permissão de PUSH nos dois apps do Seja Semente na Apple e gera
// perfis de distribuição novos (os antigos ficam inválidos quando a
// permissão muda). Os perfis saem em base64 no log, para serem commitados
// por cima dos .mobileprovision atuais — igual ao preparar-apple.mjs.
// Roda pelo robô (workflow "Robô Seja Semente").
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
  const json = texto ? JSON.parse(texto) : {};
  return { status: r.status, json };
};

// O mesmo certificado de distribuição dos builds atuais
const perfilRef = await api('GET', `/profiles?filter[name]=${encodeURIComponent('SpecialClinic AppStore')}&include=certificates&fields[certificates]=serialNumber`);
const certIds = ((perfilRef.json.data || [])[0]?.relationships?.certificates?.data || []).map(c => c.id);
if (!certIds.length) { console.error('✗ Não achei o certificado de distribuição'); process.exit(1); }

const APPS = [
  { bundle: 'com.sejasemente.central', perfil: 'SejaSemente AppStore', arquivo: 'seja-semente/nativo-central/ios/SejaSemente_AppStore.mobileprovision' },
  { bundle: 'com.sejasemente.semeador', perfil: 'Semeador AppStore', arquivo: 'seja-semente/nativo-semeador/ios/Semeador_AppStore.mobileprovision' },
];

let deuErro = false;
for (const app of APPS) {
  console.log(`\n══ ${app.bundle} ══`);
  const busca = await api('GET', `/bundleIds?filter[identifier]=${app.bundle}`);
  const registro = (busca.json.data || []).find(d => d.attributes.identifier === app.bundle);
  if (!registro) { console.log('  ✗ bundle ID não registrado'); deuErro = true; continue; }

  // ── 1. Liga a permissão de push ──
  const caps = await api('GET', `/bundleIds/${registro.id}/bundleIdCapabilities`);
  const jaTem = (caps.json.data || []).some(c => c.attributes?.capabilityType === 'PUSH_NOTIFICATIONS');
  if (jaTem) console.log('  ✓ PUSH já estava ligado');
  else {
    const liga = await api('POST', '/bundleIdCapabilities', {
      data: {
        type: 'bundleIdCapabilities',
        attributes: { capabilityType: 'PUSH_NOTIFICATIONS' },
        relationships: { bundleId: { data: { type: 'bundleIds', id: registro.id } } },
      },
    });
    if (liga.status >= 200 && liga.status < 300) console.log('  ✓ PUSH ligado agora');
    else { console.log(`  ✗ Falha ao ligar PUSH (${liga.status}): ${JSON.stringify(liga.json.errors || liga.json)}`); deuErro = true; continue; }
  }

  // ── 2. Perfil novo (apaga o antigo, que ficou inválido) ──
  const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(app.perfil)}`);
  const antigo = (perfis.json.data || []).find(p => p.attributes.name === app.perfil);
  if (antigo) await api('DELETE', `/profiles/${antigo.id}`);
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
    console.log(`  ✗ Falha no perfil (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json)}`);
    deuErro = true;
    continue;
  }
  console.log(`  ✓ Perfil "${app.perfil}" novo (com push)`);
  console.log(`── PERFIL ${app.arquivo} ──`);
  const conteudo = novo.json.data.attributes.profileContent;
  for (let i = 0; i < conteudo.length; i += 300) console.log(conteudo.slice(i, i + 300));
  console.log('── FIM DO PERFIL ──');
}

if (deuErro) { console.log('\n✗ Alguma etapa falhou'); process.exit(1); }
console.log('\n✓ Push ligado e perfis novos gerados para os dois apps');
