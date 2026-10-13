// Destrava o TestFlight pra um testador AGORA:
//  1) mostra o estado da revisão do beta de cada build nos grupos externos (e manda
//     pra revisão o que ainda não foi);
//  2) convida o e-mail como USUÁRIO da equipe (papel mínimo) — testador interno
//     não espera revisão nenhuma: aceitou o convite, o app aparece no TestFlight.
import crypto from 'crypto';
const KEY_ID = process.env.ASC_KEY_ID.trim(), ISSUER = process.env.ASC_ISSUER_ID.trim(), P8 = process.env.ASC_KEY_P8;
const BUNDLE = process.env.BUNDLE || 'com.laboratorio.special';
const EMAILS = String(process.env.EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { }
  return { status: r.status, d };
}
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = ((apps.d && apps.d.data) || []).find(a => a.attributes.bundleId === BUNDLE);
if (!app) { console.error('app não encontrado'); process.exit(1); }

// ── 1) Grupos externos: build por build, estado da revisão do beta ──
const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=15&include=preReleaseVersion`);
const versoes = {}; for (const inc of (builds.d && builds.d.included) || []) versoes[inc.id] = inc.attributes.version;
const nomeBuild = (b) => `${versoes[b.relationships?.preReleaseVersion?.data?.id] || '?'} (${b.attributes.version})`;
const grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=50`);
console.log('── GRUPOS EXTERNOS ──');
for (const g of ((grupos.d && grupos.d.data) || []).filter(g => !g.attributes.isInternalGroup)) {
  console.log(`\n${g.attributes.name} | link: ${g.attributes.publicLink || '(sem link)'} | limite: ${g.attributes.publicLinkLimitEnabled ? g.attributes.publicLinkLimit : 'sem limite'}`);
  const bs = await api('GET', `/v1/betaGroups/${g.id}/builds?limit=20`);
  for (const b of (bs.d && bs.d.data) || []) {
    const rev = await api('GET', `/v1/builds/${b.id}/betaAppReviewSubmission`);
    const estado = rev.d && rev.d.data ? rev.d.data.attributes.betaReviewState : 'NUNCA ENVIADO PRA REVISÃO';
    const bInfo = ((builds.d && builds.d.data) || []).find(x => x.id === b.id);
    console.log(`   build ${bInfo ? nomeBuild(bInfo) : b.id}: ${estado}`);
    if (!rev.d || !rev.d.data) {
      const sub = await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: b.id } } } } });
      console.log(`     → enviado pra revisão do beta: ${sub.status < 300 ? 'ok ✓' : 'falhou ' + sub.status + ' ' + JSON.stringify(sub.d || {}).slice(0, 160)}`);
    }
  }
}

// ── 2) Testador INTERNO: convite como usuário da equipe (papel mínimo, só este app) ──
console.log('\n── TESTADOR INTERNO (sem revisão) ──');
for (const email of EMAILS) {
  const conv = await api('POST', '/v1/userInvitations', {
    data: { type: 'userInvitations', attributes: { email, firstName: 'Testador', lastName: 'Special', roles: ['CUSTOMER_SUPPORT'], allAppsVisible: false, provisioningAllowed: false },
      relationships: { visibleApps: { data: [{ type: 'apps', id: app.id }] } } },
  });
  if (conv.status < 300) console.log(`Convite de equipe enviado para ${email} ✓ (ela precisa ACEITAR o e-mail da Apple)`);
  else console.log(`Convite para ${email}: ${conv.status} ${JSON.stringify(conv.d || {}).slice(0, 220)}`);
}
// Grupo interno existente ganha o build mais novo
const grupoInterno = ((grupos.d && grupos.d.data) || []).find(g => g.attributes.isInternalGroup);
const valido = ((builds.d && builds.d.data) || []).find(b => b.attributes.processingState === 'VALID' && !b.attributes.expired);
if (grupoInterno && valido) {
  const add = await api('POST', `/v1/betaGroups/${grupoInterno.id}/relationships/builds`, { data: [{ type: 'builds', id: valido.id }] });
  console.log(`Build ${nomeBuild(valido)} no grupo interno "${grupoInterno.attributes.name}": ${add.status < 300 ? 'ok ✓' : 'aviso ' + add.status}`);
}
