// Sobe as fotos de loja (fotos-loja/<app>-N.png) para a ficha da App Store,
// substituindo as fotos de iPhone da versão em preparação.
//   APP_ALVO = lab | clinic   (padrão: lab)
// Usa a API do App Store Connect (ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID).
import crypto from 'crypto';
import { readFileSync, readdirSync } from 'fs';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const ALVO = (process.env.APP_ALVO || 'lab').trim();
const BUNDLE = ALVO === 'clinic' ? 'com.laboratorio.specialclinic' : 'com.laboratorio.special';

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}
function falha(msg, resp) {
  console.error('ERRO: ' + msg, resp ? JSON.stringify(resp.dados || {}).slice(0, 400) : '');
  process.exit(1);
}

// 1. App e versão em preparação
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
// O filtro da Apple casa por PREFIXO (special também devolve specialclinic) — casamento exato aqui
const app = (apps.dados?.data || []).find(a => a.attributes.bundleId === BUNDLE);
if (!app) falha('app não encontrado');
console.log(`App: ${app.attributes.name}`);
const versoes = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,REJECTED,DEVELOPER_REJECTED,METADATA_REJECTED&limit=5`);
let versao = versoes.dados?.data?.[0];
if (!versao) {
  // App já publicado sem versão nova aberta: cria a versão de atualização aqui mesmo
  const num = (process.env.VERSAO || '7.3').trim();
  const nova = await api('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: num, releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: app.id } } },
    },
  });
  if (nova.status >= 300) falha('não consegui criar a versão de loja ' + num, nova);
  versao = nova.dados.data;
  console.log(`Versão de loja ${num} criada ✓`);
}
console.log(`Versão de loja: ${versao.attributes.versionString} (${versao.attributes.appStoreState})`);

// 2. Localização da ficha (pega a primeira — pt-BR)
const locs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
const loc = locs.dados?.data?.[0];
if (!loc) falha('ficha sem idioma');
console.log(`Idioma da ficha: ${loc.attributes.locale}`);

// 3. Conjunto de fotos do iPhone 6,9" (cria se não existir)
const sets = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
let conjunto = (sets.dados?.data || []).find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_69')
  || (sets.dados?.data || []).find(s => s.attributes.screenshotDisplayType === 'APP_IPHONE_67');
if (!conjunto) {
  // A API só aceita 'APP_IPHONE_67' (o slot de 6,7"/6,9" da ficha)
  const novo = await api('POST', '/v1/appScreenshotSets', {
    data: {
      type: 'appScreenshotSets',
      attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
      relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
    },
  });
  if (novo.status >= 300) falha('não consegui criar o conjunto de fotos', novo);
  conjunto = novo.dados.data;
}
console.log(`Conjunto: ${conjunto.attributes.screenshotDisplayType}`);

// 4. Apaga as fotos antigas do conjunto
const antigas = await api('GET', `/v1/appScreenshotSets/${conjunto.id}/appScreenshots?limit=10`);
for (const f of (antigas.dados?.data || [])) {
  const del = await api('DELETE', `/v1/appScreenshots/${f.id}`);
  console.log(`  foto antiga removida (${del.status})`);
}

// 5. Sobe as novas, na ordem 1..5
const arquivos = readdirSync('fotos-loja').filter(f => f.startsWith(ALVO + '-') && f.endsWith('.png')).sort();
if (arquivos.length === 0) falha('nenhuma foto em fotos-loja/ para ' + ALVO);
const idsNaOrdem = [];
for (const nome of arquivos) {
  const bytes = readFileSync('fotos-loja/' + nome);
  const reserva = await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName: nome, fileSize: bytes.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: conjunto.id } } },
    },
  });
  if (reserva.status >= 300) falha('não consegui reservar o envio de ' + nome, reserva);
  const foto = reserva.dados.data;
  for (const op of foto.attributes.uploadOperations || []) {
    const cab = {};
    for (const h of op.requestHeaders || []) cab[h.name] = h.value;
    const parte = bytes.subarray(op.offset, op.offset + op.length);
    const up = await fetch(op.url, { method: op.method, headers: cab, body: parte });
    if (up.status >= 300) falha(`falha no envio do pedaço de ${nome} (${up.status})`);
  }
  const md5 = crypto.createHash('md5').update(bytes).digest('hex');
  const fecha = await api('PATCH', `/v1/appScreenshots/${foto.id}`, {
    data: { type: 'appScreenshots', id: foto.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  if (fecha.status >= 300) falha('não consegui confirmar ' + nome, fecha);
  idsNaOrdem.push(foto.id);
  console.log(`  ${nome} enviada ✓`);
}

// 6. Garante a ordem 1..5
const ordena = await api('PATCH', `/v1/appScreenshotSets/${conjunto.id}/relationships/appScreenshots`, {
  data: idsNaOrdem.map(id => ({ type: 'appScreenshots', id })),
});
console.log('Ordem das fotos:', ordena.status < 300 ? 'ok ✓' : `aviso (${ordena.status})`);

console.log(`\nPRONTO: ${arquivos.length} fotos novas na ficha do ${app.attributes.name} ✓`);
