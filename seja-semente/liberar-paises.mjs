// ═══════════════════════════════════════════════════════════════════════════
//  ESCOLHE OS PAÍSES ONDE OS APLICATIVOS FICAM DISPONÍVEIS
//
//  Aplicativo novo não vai para a análise sem isso, e a Apple recusa sem
//  dizer o motivo. Nos quatro isso nunca tinha sido escolhido.
//
//  Vai o mundo inteiro, que é o padrão da loja — não custa nada e o dia que
//  alguém de fora quiser ver o projeto, consegue.
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/liberar-paises.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';
const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; }
  return { status: r.status, json: j };
};
// A Apple repete o mesmo erro para cada país; mostrar dois já basta
const erro = (r) => {
  const es = r.json.errors || [];
  const txt = es.slice(0, 2).map(e => `[${e.code || '?'}] ${e.detail || e.title}`).join(' · ');
  return (txt || JSON.stringify(r.json).slice(0, 200)) + (es.length > 2 ? ` (… e mais ${es.length - 2} iguais)` : '');
};

// A lista de países que a Apple aceita — pergunta a ela
let paises = [];
for (let pagina = 0; pagina < 4; pagina++) {
  const r = await api('GET', `/v1/territories?limit=200${pagina ? '&cursor=' + pagina : ''}`);
  const lote = (r.json.data || []).map(t => t.id);
  paises.push(...lote);
  if (!r.json.links?.next) break;
}
paises = [...new Set(paises)];
console.log(`══ A Apple aceita ${paises.length} países ══`);
if (!paises.length) { console.log('✗ não consegui a lista'); process.exit(1); }

for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const a = await api('GET', `/v1/apps?filter[bundleId]=${bundle}`);
  const app = (a.json.data || []).find(x => x.attributes.bundleId === bundle);
  if (!app) { console.log('  ✗ sem ficha'); continue; }

  const ja = await api('GET', `/v2/appAvailabilities/${app.id}`);
  if (ja.status === 200) { console.log('  ✓ os países já estavam escolhidos'); continue; }

  // Cada país entra com um APELIDO interno no pedido (${p0}, ${p1}…). O
  // código de verdade do país (BRA, PRT…) vai lá dentro, na ligação com o
  // território. Mandando o código direto no lugar do apelido, a Apple recusa
  // item por item: "o id precisa ser um id local".
  const apelido = (i) => '${p' + i + '}';
  const r = await api('POST', '/v2/appAvailabilities', {
    data: {
      type: 'appAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        app: { data: { type: 'apps', id: app.id } },
        territoryAvailabilities: { data: paises.map((_, i) => ({ type: 'territoryAvailabilities', id: apelido(i) })) },
      },
    },
    included: paises.map((codigo, i) => ({
      type: 'territoryAvailabilities', id: apelido(i),
      attributes: { available: true },
      relationships: { territory: { data: { type: 'territories', id: codigo } } },
    })),
  });
  console.log(`  ${r.status < 300 ? `✓ liberado em ${paises.length} países` : '✗ ' + r.status + ': ' + erro(r)}`);
}
console.log('\n✓ Fim');
