// Prepara a versão MAC (Catalyst) do app central Seja Semente:
// 1. Confere o tipo do certificado de distribuição (precisa ser "Apple
//    Distribution", que vale para iOS e Mac)
// 2. Cria o perfil MAC_CATALYST_APP_STORE e imprime em base64 pra commitar
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

// 1. Certificados de distribuição — tipo e validade
const certs = await api('GET', '/certificates?limit=50');
const todos = certs.json.data || [];
for (const c of todos) {
  console.log(`Certificado: ${c.id} · tipo=${c.attributes.certificateType} · nome=${c.attributes.name} · expira=${(c.attributes.expirationDate || '').slice(0, 10)}`);
}
// Para o Catalyst serve o "Apple Distribution" (tipo DISTRIBUTION)
const dist = todos.filter(c => c.attributes.certificateType === 'DISTRIBUTION');
if (!dist.length) {
  console.log('✗ Nenhum certificado "Apple Distribution" (tipo DISTRIBUTION) — o do iOS deve ser antigo (IOS_DISTRIBUTION), que NÃO assina Mac.');
  process.exit(1);
}
const certIds = dist.map(c => c.id);
console.log(`\n✓ Apple Distribution: ${certIds.join(', ')} — serve para o Mac Catalyst`);

// 2. Bundle ID do app central
const busca = await api('GET', '/bundleIds?filter[identifier]=com.sejasemente.central');
const registro = (busca.json.data || []).find(d => d.attributes.identifier === 'com.sejasemente.central');
if (!registro) { console.log('✗ Bundle ID com.sejasemente.central não encontrado'); process.exit(1); }

// 3. Perfil MAC_CATALYST_APP_STORE (apaga o antigo se existir)
const NOME = 'SejaSemente MacCatalyst';
const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(NOME)}`);
const antigo = (perfis.json.data || []).find(p => p.attributes.name === NOME);
if (antigo) {
  const apaga = await api('DELETE', `/profiles/${antigo.id}`);
  console.log(apaga.status === 204 ? 'Perfil antigo apagado' : `Aviso: não apaguei o antigo (${apaga.status})`);
}
const novo = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: NOME, profileType: 'MAC_CATALYST_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: registro.id } },
      certificates: { data: certIds.map(id => ({ type: 'certificates', id })) },
    },
  },
});
if (!(novo.status >= 200 && novo.status < 300) || !novo.json.data?.attributes?.profileContent) {
  console.log(`✗ Falha ao criar o perfil (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json).slice(0, 400)}`);
  process.exit(1);
}
console.log(`✓ Perfil "${NOME}" criado (${novo.json.data.id})`);
console.log('── PERFIL seja-semente/nativo-central/ios/SejaSemente_MacCatalyst.provisionprofile ──');
const conteudo = novo.json.data.attributes.profileContent;
for (let i = 0; i < conteudo.length; i += 300) console.log(conteudo.slice(i, i + 300));
console.log('── FIM DO PERFIL ──');
