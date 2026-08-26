// ═══════════════════════════════════════════════════════════════════════════
//  SOBE AS FOTOS DE TELA DOS QUATRO APLICATIVOS DO SEJA SEMENTE
//
//  Lê fotos-loja/<alvo>-1.png … <alvo>-5.png (1290×2796, o tamanho que a
//  Apple pede) e põe na ficha da versão em preparação de cada um,
//  substituindo o que estiver lá.
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/subir-fotos-semente.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
import { readFileSync, readdirSync, existsSync } from 'fs';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const PASTA = 'fotos-loja';
const APPS = [
  { alvo: 'central',  bundle: 'com.sejasemente.central' },
  { alvo: 'semeador', bundle: 'com.sejasemente.semeador' },
  { alvo: 'palmar',   bundle: 'com.sejasemente.palmar' },
  { alvo: 'colheita', bundle: 'com.sejasemente.colheita' },
];

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
let deuErro = false;

for (const app of APPS) {
  console.log(`\n══════ ${app.alvo} ══════`);
  const arquivos = existsSync(PASTA)
    ? readdirSync(PASTA).filter(f => f.startsWith(app.alvo + '-') && f.endsWith('.png')).sort()
    : [];
  if (!arquivos.length) { console.log('  ✗ nenhuma foto em ' + PASTA + '/' + app.alvo + '-*.png'); deuErro = true; continue; }

  const apps = await api('GET', `/v1/apps?filter[bundleId]=${app.bundle}`);
  const ficha = (apps.dados?.data || []).find(a => a.attributes.bundleId === app.bundle);
  if (!ficha) { console.log('  ✗ sem ficha na loja'); deuErro = true; continue; }

  const vs = await api('GET', `/v1/apps/${ficha.id}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState`);
  const versao = (vs.dados?.data || []).find(v => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState));
  if (!versao) { console.log('  ✗ nenhuma versão aberta'); deuErro = true; continue; }
  console.log(`  Versão ${versao.attributes.versionString} (${versao.attributes.appStoreState})`);

  const locs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
  const loc = (locs.dados?.data || []).find(l => l.attributes.locale === 'pt-BR') || locs.dados?.data?.[0];
  if (!loc) { console.log('  ✗ ficha sem idioma'); deuErro = true; continue; }

  const sets = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`);
  let conjunto = (sets.dados?.data || []).find(s => ['APP_IPHONE_67', 'APP_IPHONE_69'].includes(s.attributes.screenshotDisplayType));
  if (!conjunto) {
    const novo = await api('POST', '/v1/appScreenshotSets', {
      data: {
        type: 'appScreenshotSets',
        attributes: { screenshotDisplayType: 'APP_IPHONE_67' },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
      },
    });
    if (novo.status >= 300) { console.log('  ✗ não consegui criar o conjunto: ' + JSON.stringify(novo.dados).slice(0, 200)); deuErro = true; continue; }
    conjunto = novo.dados.data;
  }

  const antigas = await api('GET', `/v1/appScreenshotSets/${conjunto.id}/appScreenshots?limit=20`);
  for (const f of (antigas.dados?.data || [])) await api('DELETE', `/v1/appScreenshots/${f.id}`);

  const idsNaOrdem = [];
  let falhou = false;
  for (const nome of arquivos) {
    const bytes = readFileSync(PASTA + '/' + nome);
    const reserva = await api('POST', '/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName: nome, fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: conjunto.id } } },
      },
    });
    if (reserva.status >= 300) { console.log(`  ✗ ${nome}: ${reserva.status} ${JSON.stringify(reserva.dados).slice(0, 180)}`); falhou = true; break; }
    const foto = reserva.dados.data;
    for (const op of foto.attributes.uploadOperations || []) {
      const cab = {};
      for (const h of op.requestHeaders || []) cab[h.name] = h.value;
      const up = await fetch(op.url, { method: op.method, headers: cab, body: bytes.subarray(op.offset, op.offset + op.length) });
      if (up.status >= 300) { console.log(`  ✗ ${nome}: envio falhou (${up.status})`); falhou = true; break; }
    }
    if (falhou) break;
    const md5 = crypto.createHash('md5').update(bytes).digest('hex');
    const fecha = await api('PATCH', `/v1/appScreenshots/${foto.id}`, {
      data: { type: 'appScreenshots', id: foto.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
    });
    if (fecha.status >= 300) { console.log(`  ✗ ${nome}: não confirmou (${fecha.status})`); falhou = true; break; }
    idsNaOrdem.push(foto.id);
    console.log(`  ✓ ${nome}`);
  }
  if (falhou) { deuErro = true; continue; }

  const ordena = await api('PATCH', `/v1/appScreenshotSets/${conjunto.id}/relationships/appScreenshots`, {
    data: idsNaOrdem.map(id => ({ type: 'appScreenshots', id })),
  });
  console.log(`  ${idsNaOrdem.length} fotos na ficha · ordem ${ordena.status < 300 ? 'ok' : 'aviso ' + ordena.status}`);
}

console.log(deuErro ? '\n✗ Fim com problema' : '\n✓ Fim — as quatro fichas com foto');
if (deuErro) process.exit(1);
