// ═══════════════════════════════════════════════════════════════════════════
//  MANDA OS QUATRO PARA A ANÁLISE DA APP STORE
//
//  Faz o último passo: pendura o envio (build) mais novo e válido na versão
//  da loja e aperta o botão de enviar para análise.
//
//  Antes de apertar, o robô CONFERE tudo o que a Apple exige e, se faltar
//  alguma coisa, NÃO envia aquele aplicativo — diz o que falta e segue para
//  o próximo. É de propósito: envio incompleto vira reprovação, e reprovação
//  entra no histórico da conta.
//
//  SÓ CONFERIR, sem enviar: ponha SO_CONFERIR=1
//  Rodar pelo robô: ativar-apple.yml com seja-semente/enviar-analise.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const SO_CONFERIR = !!process.env.SO_CONFERIR;
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const APPS = ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita'];

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j = {};
  try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { cru: t.slice(0, 300) }; }
  return { status: r.status, json: j };
};
const porque = (r) => r.json?.errors?.map(e => e.detail || e.title).join(' · ') || JSON.stringify(r.json).slice(0, 220);
const cheio = (v) => !!String(v || '').trim();

let algumFalhou = false;

for (const bundle of APPS) {
  console.log(`\n══════ ${bundle} ══════`);
  const falta = [];

  const r = await api('GET', `/v1/apps?filter[bundleId]=${bundle}`);
  const app = (r.json.data || []).find(a => a.attributes.bundleId === bundle);
  if (!app) { console.log('  ✗ sem ficha na loja'); algumFalhou = true; continue; }

  // A versão que vamos enviar
  const vs = await api('GET', `/v1/apps/${app.id}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState,releaseType`);
  const versao = (vs.json.data || []).find(v => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState));
  if (!versao) {
    const jaEnviada = (vs.json.data || [])[0];
    console.log(`  ⏸ nada a enviar — versão ${jaEnviada?.attributes.versionString || '?'} está em ${jaEnviada?.attributes.appStoreState || '?'}`);
    continue;
  }
  const numero = versao.attributes.versionString;
  console.log(`  Versão ${numero} (${versao.attributes.appStoreState})`);

  // ── O envio (build): o mais novo que terminou de processar e casa com o número ──
  const bs = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=20&fields[builds]=version,processingState,expired&include=preReleaseVersion&fields[preReleaseVersions]=version`);
  const versoesPre = {};
  for (const inc of (bs.json.included || [])) versoesPre[inc.id] = inc.attributes?.version;
  const combina = (bs.json.data || []).filter(b =>
    b.attributes.processingState === 'VALID' && !b.attributes.expired
    && versoesPre[b.relationships?.preReleaseVersion?.data?.id] === numero);
  const build = combina[0];
  if (!build) {
    const vistos = (bs.json.data || []).slice(0, 5)
      .map(b => `nº${b.attributes.version}=${versoesPre[b.relationships?.preReleaseVersion?.data?.id] || '?'} (${b.attributes.processingState})`).join(', ');
    falta.push(`nenhum envio pronto com a versão ${numero} — os últimos são: ${vistos}`);
  } else {
    const pendurado = await api('GET', `/v1/appStoreVersions/${versao.id}/build?fields[builds]=version`);
    if (pendurado.json.data?.id === build.id) {
      console.log(`  ✓ envio nº ${build.attributes.version} já estava pendurado`);
    } else {
      const p = await api('PATCH', `/v1/appStoreVersions/${versao.id}/relationships/build`, {
        data: { type: 'builds', id: build.id },
      });
      if (p.status < 300) console.log(`  ✓ envio nº ${build.attributes.version} pendurado na versão`);
      else falta.push(`não consegui pendurar o envio nº ${build.attributes.version}: ${porque(p)}`);
    }
  }

  // ── Conferindo o resto ──
  const infos = await api('GET', `/v1/apps/${app.id}/appInfos?include=primaryCategory`);
  const info = infos.json.data?.[0];
  if (!info?.relationships?.primaryCategory?.data?.id) falta.push('categoria');
  if (info) {
    const decl = await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
    if (!decl.json.data) falta.push('faixa etária');
    const locs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
    const l = (locs.json.data || []).find(x => x.attributes.locale === 'pt-BR') || locs.json.data?.[0];
    if (!cheio(l?.attributes?.privacyPolicyUrl)) falta.push('política de privacidade');
    if (!cheio(l?.attributes?.subtitle)) falta.push('subtítulo');
  }

  const vlocs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
  const vl = (vlocs.json.data || []).find(x => x.attributes.locale === 'pt-BR') || vlocs.json.data?.[0];
  if (!cheio(vl?.attributes?.description)) falta.push('descrição');
  if (!cheio(vl?.attributes?.keywords)) falta.push('palavras de busca');
  if (!cheio(vl?.attributes?.supportUrl)) falta.push('endereço de suporte');
  if (vl) {
    const sets = await api('GET', `/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets?include=appScreenshots`);
    const quantas = (sets.json.data || []).reduce((s, c) => s + (c.relationships?.appScreenshots?.data || []).length, 0);
    if (!quantas) falta.push('fotos de tela');
    else console.log(`  ✓ ${quantas} foto(s) de tela`);
  }

  const det = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreReviewDetail`);
  const d = det.json.data?.attributes;
  if (!d) falta.push('dados da análise');
  else {
    if (!cheio(d.contactEmail) || !cheio(d.contactPhone)) falta.push('contato da análise');
    if (!d.demoAccountRequired || !cheio(d.demoAccountName) || !cheio(d.demoAccountPassword)) falta.push('conta de demonstração');
    if (!cheio(d.notes)) falta.push('notas da análise');
  }

  if (falta.length) {
    console.log('  ✗ NÃO ENVIEI. Falta: ' + falta.join('; '));
    algumFalhou = true;
    continue;
  }
  console.log('  ✓ ficha completa');
  if (SO_CONFERIR) { console.log('  ⏸ só conferindo — não enviei'); continue; }

  // ── Enviar ──
  // Sai do ar só depois de aprovado, e por conta própria
  await api('PATCH', `/v1/appStoreVersions/${versao.id}`, {
    data: { type: 'appStoreVersions', id: versao.id, attributes: { releaseType: 'AFTER_APPROVAL' } },
  });

  const abertos = await api('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`);
  let envio = (abertos.json.data || []).find(s => s.attributes.state === 'READY_FOR_REVIEW');
  if (!envio) {
    const cria = await api('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions', attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    });
    if (cria.status >= 300) { console.log('  ✗ não consegui abrir o envio: ' + porque(cria)); algumFalhou = true; continue; }
    envio = cria.json.data;
  }

  const itens = await api('GET', `/v1/reviewSubmissions/${envio.id}/items`);
  const jaTem = (itens.json.data || []).some(i => i.relationships?.appStoreVersion?.data?.id === versao.id);
  if (!jaTem) {
    const item = await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: envio.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } },
        },
      },
    });
    if (item.status >= 300) { console.log('  ✗ não consegui pôr a versão no envio: ' + porque(item)); algumFalhou = true; continue; }
  }

  const manda = await api('PATCH', `/v1/reviewSubmissions/${envio.id}`, {
    data: { type: 'reviewSubmissions', id: envio.id, attributes: { submitted: true } },
  });
  if (manda.status < 300) console.log(`  ✓✓ ENVIADO para a análise — versão ${numero}`);
  else { console.log('  ✗ não consegui enviar: ' + porque(manda)); algumFalhou = true; }
}

console.log(algumFalhou ? '\n✗ Fim — algum aplicativo não foi' : '\n✓ Fim');
if (algumFalhou) process.exit(1);
