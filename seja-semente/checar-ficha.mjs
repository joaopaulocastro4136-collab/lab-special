// ═══════════════════════════════════════════════════════════════════════════
//  O QUE AINDA FALTA NA FICHA DE CADA APLICATIVO
//
//  Antes de mandar para a análise, a Apple exige a ficha completa: texto,
//  fotos da tela, categoria, faixa etária, preço, política de privacidade e a
//  conta de demonstração. Este robô confere item por item e diz o que falta.
//  Não muda nada — só pergunta.
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/checar-ficha.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  const t = await r.text();
  let j = {};
  try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { cru: t.slice(0, 200) }; }
  return { status: r.status, json: j };
};
const marca = (ok) => ok ? '✓' : '✗ FALTA';
const cheio = (v) => !!String(v || '').trim();

for (const bundle of ['com.sejasemente.central', 'com.sejasemente.semeador', 'com.sejasemente.palmar', 'com.sejasemente.colheita']) {
  console.log(`\n══════ ${bundle} ══════`);
  const r = await api(`/v1/apps?filter[bundleId]=${bundle}&fields[apps]=name,primaryLocale,contentRightsDeclaration`);
  const app = r.json.data?.[0];
  if (!app) { console.log('  ✗ sem ficha'); continue; }
  console.log(`  ${app.attributes.name} · idioma ${app.attributes.primaryLocale}`);
  console.log(`  ${marca(cheio(app.attributes.contentRightsDeclaration))} direitos de conteúdo: ${app.attributes.contentRightsDeclaration || '—'}`);

  // Categoria
  const info = await api(`/v1/apps/${app.id}/appInfos?include=primaryCategory,secondaryCategory`);
  const ai = info.json.data?.[0];
  const cat = ai?.relationships?.primaryCategory?.data?.id;
  console.log(`  ${marca(!!cat)} categoria: ${cat || '—'}`);
  console.log(`  Estado da ficha: ${ai?.attributes?.appStoreState || '—'} · idade: ${ai?.attributes?.appStoreAgeRating || '—'}`);

  // Texto da ficha (nome, subtítulo, política de privacidade)
  if (ai) {
    const loc = await api(`/v1/appInfos/${ai.id}/appInfoLocalizations?fields[appInfoLocalizations]=locale,name,subtitle,privacyPolicyUrl`);
    for (const l of (loc.json.data || [])) {
      const a = l.attributes;
      console.log(`  Texto [${a.locale}] nome:${marca(cheio(a.name))} subtítulo:${marca(cheio(a.subtitle))} privacidade:${marca(cheio(a.privacyPolicyUrl))} ${a.privacyPolicyUrl || ''}`);
    }
  }

  // Faixa etária respondida?
  const idade = await api(`/v1/apps/${app.id}/ageRatingDeclaration`);
  console.log(`  ${marca(idade.status === 200 && !!idade.json.data)} faixa etária respondida`);

  // Preço
  const preco = await api(`/v1/apps/${app.id}/appPriceSchedule?include=baseTerritory`);
  console.log(`  ${marca(preco.status === 200 && !!preco.json.data)} preço definido`);

  // A versão da loja: texto, novidades, fotos de tela e dados da análise
  const vs = await api(`/v1/apps/${app.id}/appStoreVersions?limit=1&fields[appStoreVersions]=versionString,appStoreState`);
  const v = vs.json.data?.[0];
  if (!v) { console.log('  ✗ FALTA versão de loja'); continue; }
  console.log(`  Versão ${v.attributes.versionString} · ${v.attributes.appStoreState}`);

  const vloc = await api(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,description,keywords,supportUrl,whatsNew`);
  for (const l of (vloc.json.data || [])) {
    const a = l.attributes;
    console.log(`   Versão [${a.locale}] descrição:${marca(cheio(a.description))} palavras:${marca(cheio(a.keywords))} suporte:${marca(cheio(a.supportUrl))}`);
    // Fotos de tela
    const conj = await api(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType&include=appScreenshots`);
    const sets = conj.json.data || [];
    if (!sets.length) console.log('     ✗ FALTA fotos de tela (nenhuma)');
    for (const s of sets) {
      const n = (s.relationships?.appScreenshots?.data || []).length;
      console.log(`     ${marca(n > 0)} fotos ${s.attributes.screenshotDisplayType}: ${n}`);
    }
  }

  // Conta de demonstração e contato da análise
  const det = await api(`/v1/appStoreVersions/${v.id}/appStoreReviewDetail`);
  const d = det.json.data?.attributes;
  if (!d) console.log('   ✗ FALTA dados da análise (contato e conta de teste)');
  else console.log(`   contato:${marca(cheio(d.contactEmail))} login exigido:${d.demoAccountRequired ? 'sim' : 'NÃO'} conta:${marca(cheio(d.demoAccountName))} notas:${marca(cheio(d.notes))}`);

  // Já tem um build pendurado nesta versão?
  const bl = await api(`/v1/appStoreVersions/${v.id}/build?fields[builds]=version`);
  console.log(`   ${marca(!!bl.json.data)} build anexado: ${bl.json.data?.attributes?.version || '—'}`);
}
console.log('\n✓ Fim');
