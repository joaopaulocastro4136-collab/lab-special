// Roda DENTRO do build Mac (Catalyst). O certificado iOS do projeto é do
// tipo antigo (só iOS), então aqui a gente cria uma assinatura Mac completa
// e EFÊMERA via API — vale só para este build e é recriada na próxima:
//   1. Apaga os certificados efêmeros anteriores (Apple Distribution e
//      Mac Installer criados por este script)
//   2. Cria os dois de novo, com chaves geradas agora
//   3. Cria o perfil "SejaSemente MacCatalyst" apontando pro novo certificado
//   4. Grava tudo em $RUNNER_TEMP: dist-mac.key/.cer, instalador.key/.cer,
//      SejaSemente_MacCatalyst.provisionprofile
// Obs.: o certificado iOS (6KAXX6ZGN2) não é tocado — os builds do iPhone
// continuam funcionando como sempre.
import crypto from 'crypto';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const TEMP = process.env.RUNNER_TEMP || '/tmp';

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

// 1. Limpa os efêmeros anteriores (DISTRIBUTION novo-estilo e MAC_INSTALLER).
//    O certificado iOS é IOS_DISTRIBUTION — nunca entra nesses filtros.
for (const tipo of ['DISTRIBUTION', 'MAC_INSTALLER_DISTRIBUTION']) {
  const lista = await api('GET', `/certificates?filter[certificateType]=${tipo}&limit=20`);
  for (const c of lista.json.data || []) {
    const del = await api('DELETE', `/certificates/${c.id}`);
    console.log(`${tipo} antigo ${c.id}: ${del.status === 204 ? 'apagado' : 'não apagou (' + del.status + ')'}`);
  }
}

// 2. Cria os dois certificados com chaves novas
async function criarCert(tipo, apelido, arquivoBase) {
  const chave = join(TEMP, arquivoBase + '.key');
  const csr = join(TEMP, arquivoBase + '.csr');
  execSync(`openssl genrsa -out ${chave} 2048 2>/dev/null`);
  execSync(`openssl req -new -key ${chave} -out ${csr} -subj "/CN=${apelido}/O=CI"`);
  const cria = await api('POST', '/certificates', {
    data: { type: 'certificates', attributes: { certificateType: tipo, csrContent: readFileSync(csr).toString() } },
  });
  if (!(cria.status >= 200 && cria.status < 300)) {
    console.log(`✗ Falha ao criar ${tipo} (${cria.status}): ${JSON.stringify(cria.json.errors || cria.json).slice(0, 400)}`);
    process.exit(1);
  }
  writeFileSync(join(TEMP, arquivoBase + '.cer'), Buffer.from(cria.json.data.attributes.certificateContent, 'base64'));
  console.log(`✓ ${tipo} criado (${cria.json.data.id})`);
  return cria.json.data.id;
}
const distId = await criarCert('DISTRIBUTION', 'Seja Semente Mac', 'dist-mac');
await criarCert('MAC_INSTALLER_DISTRIBUTION', 'Seja Semente Instalador', 'instalador');

// 3. Perfil Mac Catalyst apontando pro certificado novo
const busca = await api('GET', '/bundleIds?filter[identifier]=com.sejasemente.central');
const registro = (busca.json.data || []).find(d => d.attributes.identifier === 'com.sejasemente.central');
if (!registro) { console.log('✗ Bundle ID não encontrado'); process.exit(1); }

const NOME = 'SejaSemente MacCatalyst';
const perfis = await api('GET', `/profiles?filter[name]=${encodeURIComponent(NOME)}`);
for (const p of perfis.json.data || []) await api('DELETE', `/profiles/${p.id}`);
const novo = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: NOME, profileType: 'MAC_CATALYST_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: registro.id } },
      certificates: { data: [{ type: 'certificates', id: distId }] },
    },
  },
});
if (!novo.json.data?.attributes?.profileContent) {
  console.log(`✗ Falha no perfil (${novo.status}): ${JSON.stringify(novo.json.errors || novo.json).slice(0, 400)}`);
  process.exit(1);
}
writeFileSync(join(TEMP, 'SejaSemente_MacCatalyst.provisionprofile'), Buffer.from(novo.json.data.attributes.profileContent, 'base64'));
console.log(`✓ Perfil "${NOME}" criado (${novo.json.data.id}) — assinatura Mac pronta em $RUNNER_TEMP`);
