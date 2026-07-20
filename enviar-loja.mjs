// Robô de envio para a App Store: prepara a versão de loja do Lab Special,
// corrige a URL de suporte (exigência da Apple — regra 1.5), anexa o build
// mais novo do TestFlight e envia para a análise da Apple.
// Usa a API oficial com a chave da App Store (ASC_KEY_P8 / ASC_KEY_ID / ASC_ISSUER_ID).
// A versão visível vem da variável VERSAO (ex.: 7.3).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const BUNDLE = process.env.BUNDLE || 'com.laboratorio.special';
const VERSAO = (process.env.VERSAO || '').trim();
const URL_SUPORTE = 'https://laboratorio-special.web.app/suporte.html';

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
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* resposta vazia */ }
  return { status: r.status, dados };
}

function falha(msg, resp) {
  console.error('ERRO: ' + msg, resp ? JSON.stringify(resp.dados || {}).slice(0, 500) : '');
  process.exit(1);
}

// 1. Acha o app
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = apps.dados && apps.dados.data && apps.dados.data[0];
if (!app) falha('app não encontrado no App Store Connect', apps);
console.log(`App: ${app.attributes.name} (${app.id})`);

// 2. Build mais novo já processado no TestFlight
const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=preReleaseVersion`);
const build = ((builds.dados && builds.dados.data) || []).find(b => b.attributes.processingState === 'VALID' && !b.attributes.expired);
if (!build) falha('nenhum build válido — suba um build pelo workflow "iOS → TestFlight" e aguarde a Apple processar', builds);
const versoes = {};
for (const inc of (builds.dados.included || [])) versoes[inc.id] = inc.attributes.version;
const versaoDoBuild = versoes[build.relationships?.preReleaseVersion?.data?.id];
console.log(`Build escolhido: versão ${versaoDoBuild} (build ${build.attributes.version})`);
const versaoAlvo = VERSAO || versaoDoBuild;
if (!versaoAlvo) falha('não descobri a versão — informe VERSAO (ex.: 7.3)');

// 3. Declaração de criptografia (destrava o "Missing Compliance")
const comp = await api('PATCH', `/v1/builds/${build.id}`, {
  data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
});
console.log('Compliance:', comp.status === 200 ? 'ok ✓' : `aviso (${comp.status})`);

// 4. Versão de loja editável (reaproveita a reprovada/preparação; senão cria)
const ESTADOS_EDITAVEIS = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
const vers = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`);
let versao = ((vers.dados && vers.dados.data) || []).find(v => ESTADOS_EDITAVEIS.includes(v.attributes.appStoreState));
if (versao) {
  console.log(`Versão de loja encontrada: ${versao.attributes.versionString} (${versao.attributes.appStoreState})`);
  if (versao.attributes.versionString !== versaoAlvo) {
    const muda = await api('PATCH', `/v1/appStoreVersions/${versao.id}`, {
      data: { type: 'appStoreVersions', id: versao.id, attributes: { versionString: versaoAlvo } },
    });
    if (muda.status >= 300) falha(`não consegui mudar o número da versão para ${versaoAlvo} — sem isso o envio iria com o número errado`, muda);
    console.log(`Número da versão atualizado para ${versaoAlvo} ✓`);
  }
} else {
  const nova = await api('POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString: versaoAlvo },
      relationships: { app: { data: { type: 'apps', id: app.id } } },
    },
  });
  if (nova.status >= 300) falha('não consegui criar a versão de loja', nova);
  versao = nova.dados.data;
  console.log(`Versão de loja ${versaoAlvo} criada ✓`);
}

// 5. Anexa o build escolhido à versão de loja
const anexa = await api('PATCH', `/v1/appStoreVersions/${versao.id}/relationships/build`, {
  data: { type: 'builds', id: build.id },
});
if (anexa.status >= 300) falha('não consegui anexar o build à versão de loja', anexa);
console.log('Build anexado à versão ✓');

// 6. Corrige a URL de suporte (regra 1.5) em todos os idiomas da ficha —
// era um dos motivos da reprovação: se falhar, não adianta enviar
const locs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
for (const loc of ((locs.dados && locs.dados.data) || [])) {
  const atualiza = await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { supportUrl: URL_SUPORTE } },
  });
  if (atualiza.status >= 300) falha(`não consegui corrigir a URL de suporte (${loc.attributes.locale})`, atualiza);
  console.log(`URL de suporte (${loc.attributes.locale}) ✓`);
}

// 7. Envio para a análise. Estados possíveis de um envio aberto:
//   WAITING_FOR_REVIEW  → já está na fila da Apple; não dá pra mexer — pare e avise
//   UNRESOLVED_ISSUES   → foi reprovado; cancela e abre um envio novo limpo
//   READY_FOR_REVIEW    → aberto e ainda não enviado; reaproveita
let envio = null;
const envios = await api('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5`);
envio = ((envios.dados && envios.dados.data) || [])[0];
if (envio && envio.attributes.state === 'WAITING_FOR_REVIEW') {
  falha('já existe um envio aguardando a análise da Apple — cancele-o no App Store Connect (ou aguarde a resposta) antes de reenviar');
}
if (envio && envio.attributes.state === 'UNRESOLVED_ISSUES') {
  const cancela = await api('PATCH', `/v1/reviewSubmissions/${envio.id}`, {
    data: { type: 'reviewSubmissions', id: envio.id, attributes: { canceled: true } },
  });
  if (cancela.status >= 300) falha('não consegui cancelar o envio reprovado anterior — cancele-o no App Store Connect e rode de novo', cancela);
  console.log('Envio reprovado anterior cancelado ✓');
  envio = null;
}
if (!envio) {
  const novo = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: 'IOS' },
      relationships: { app: { data: { type: 'apps', id: app.id } } },
    },
  });
  if (novo.status >= 300) falha('não consegui abrir o envio para análise', novo);
  envio = novo.dados.data;
  console.log('Envio para análise aberto ✓');
} else {
  console.log('Envio aberto (ainda não enviado) — reaproveitando ✓');
}

// 7b. Garante que a NOSSA versão de loja está dentro do envio
const itens = await api('GET', `/v1/reviewSubmissions/${envio.id}/items?include=appStoreVersion&limit=10`);
const listaItens = (itens.dados && itens.dados.data) || [];
const itemDaVersao = listaItens.find(i => i.relationships?.appStoreVersion?.data?.id === versao.id);
if (listaItens.length > 0 && !itemDaVersao) {
  falha('o envio aberto contém OUTRA versão — cancele-o no App Store Connect e rode de novo');
}
if (!itemDaVersao) {
  const item = await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: envio.id } },
        appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } },
      },
    },
  });
  if (item.status >= 300) falha('não consegui colocar a versão dentro do envio', item);
  console.log('Versão colocada no envio ✓');
} else {
  console.log('Envio já contém esta versão ✓');
}

// 7c. Aperta o botão "Enviar"
const manda = await api('PATCH', `/v1/reviewSubmissions/${envio.id}`, {
  data: { type: 'reviewSubmissions', id: envio.id, attributes: { submitted: true } },
});
if (manda.status < 300) {
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log(`ENVIADO PARA A ANÁLISE DA APPLE ✓ — versão ${versaoAlvo} (build ${build.attributes.version})`);
  console.log('A resposta costuma sair em 1 a 3 dias. Acompanhe no App Store Connect.');
  console.log('════════════════════════════════════════════');
} else {
  falha(`não consegui concluir o envio (${manda.status})`, manda);
}
