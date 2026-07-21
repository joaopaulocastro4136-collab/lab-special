// Robô que prepara os dois apps do Seja Semente no Apple Developer:
// 1. Registra os bundle IDs (com.sejasemente.central e com.sejasemente.semeador)
// 2. Cria os perfis de distribuição usando o MESMO certificado dos apps Special
// 3. Imprime os .mobileprovision em base64 no log, pra serem commitados
// Roda pelo GitHub Actions (workflow "Preparar Apple — Seja Semente"),
// que tem as chaves ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID.
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

// Certificado: pega do perfil da Special Clinic, que é o mesmo do segredo IOS_P12_BASE64
const perfilRef = await api('GET', `/profiles?filter[name]=${encodeURIComponent('SpecialClinic AppStore')}&include=certificates&fields[certificates]=serialNumber`);
const ref = (perfilRef.json.data || [])[0];
const certIds = (ref?.relationships?.certificates?.data || []).map(c => c.id);
if (!certIds.length) { console.error('✗ Não achei o certificado de distribuição (perfil da Clinic)'); process.exit(1); }
console.log(`Certificado(s) de distribuição: ${certIds.join(', ')}`);

const APPS = [
  { bundle: 'com.sejasemente.central', nomeBundle: 'Seja Semente Central', perfil: 'SejaSemente AppStore', arquivo: 'seja-semente/nativo-central/ios/SejaSemente_AppStore.mobileprovision' },
  { bundle: 'com.sejasemente.semeador', nomeBundle: 'Semeador Seja Semente', perfil: 'Semeador AppStore', arquivo: 'seja-semente/nativo-semeador/ios/Semeador_AppStore.mobileprovision' },
];

let deuErro = false;

for (const app of APPS) {
  console.log(`\n══ ${app.bundle} ══`);

  // ── Registra (ou acha) o bundle ID ──
  const busca = await api('GET', `/bundleIds?filter[identifier]=${app.bundle}`);
  let registro = (busca.json.data || []).find(d => d.attributes.identifier === app.bundle);
  if (registro) {
    console.log(`  ✓ Bundle ID já registrado (${registro.id})`);
  } else {
    const cria = await api('POST', '/bundleIds', {
      data: { type: 'bundleIds', attributes: { identifier: app.bundle, name: app.nomeBundle, platform: 'IOS' } },
    });
    if (!(cria.status >= 200 && cria.status < 300)) {
      console.log(`  ✗ Falha ao registrar bundle ID (${cria.status}): ${JSON.stringify(cria.json.errors || cria.json)}`);
      deuErro = true;
      continue;
    }
    registro = cria.json.data;
    console.log(`  ✓ Bundle ID registrado agora (${registro.id})`);
  }

  // ── Cria o perfil de distribuição (apaga antes se já existir) ──
  const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(app.perfil)}`);
  const antigo = (perfis.json.data || []).find(p => p.attributes.name === app.perfil);
  if (antigo) {
    const apaga = await api('DELETE', `/profiles/${antigo.id}`);
    console.log(apaga.status === 204 ? '  Perfil antigo apagado' : `  Aviso: não apaguei o perfil antigo (${apaga.status})`);
  }
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
    console.log(`  ✗ Falha ao criar o perfil (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json)}`);
    deuErro = true;
    continue;
  }
  console.log(`  ✓ Perfil "${app.perfil}" criado (${novo.json.data.id})`);
  console.log(`── PERFIL ${app.arquivo} ──`);
  const conteudo = novo.json.data.attributes.profileContent;
  for (let i = 0; i < conteudo.length; i += 300) console.log(conteudo.slice(i, i + 300));
  console.log('── FIM DO PERFIL ──');
}

if (deuErro) { console.log('\n✗ Alguma etapa falhou — veja acima'); process.exit(1); }
console.log('\n✓ Bundle IDs registrados e perfis gerados para os dois apps do Seja Semente');
