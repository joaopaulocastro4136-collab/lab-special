// Convida um testador no TestFlight do Lab Special e liga o LINK PÚBLICO do grupo
// de testadores externos (qualquer pessoa com o link instala o beta).
// Usa a API oficial da App Store Connect (chave ASC_* dos segredos).
// E-mails a convidar: variável EMAILS (separados por vírgula).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const BUNDLE = process.env.BUNDLE || 'com.laboratorio.special';
const EMAILS = String(process.env.EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const NOME_GRUPO = process.env.GRUPO || 'Equipe Special';

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text(); let d = null;
  try { d = t ? JSON.parse(t) : null; } catch (e) { }
  return { status: r.status, d };
}
const falha = (m, r) => { console.error('ERRO: ' + m, r ? JSON.stringify(r.d || {}).slice(0, 400) : ''); process.exit(1); };

// 1) App
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = ((apps.d && apps.d.data) || []).find(a => a.attributes.bundleId === BUNDLE);
if (!app) falha('app não encontrado');
console.log(`App: ${app.attributes.name} (${app.id})`);

// 2) Grupo de testadores EXTERNOS (qualquer e-mail entra; interno exige conta na equipe da Apple)
const grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=50`);
let lista = (grupos.d && grupos.d.data) || [];
console.log('Grupos existentes: ' + (lista.map(g => `${g.attributes.name}${g.attributes.isInternalGroup ? ' (interno)' : ' (externo)'}${g.attributes.publicLinkEnabled ? ' [link público]' : ''}`).join(', ') || 'nenhum'));
let grupo = lista.find(g => !g.attributes.isInternalGroup && g.attributes.publicLinkEnabled)
  || lista.find(g => !g.attributes.isInternalGroup);
if (!grupo) {
  const novo = await api('POST', '/v1/betaGroups', {
    data: { type: 'betaGroups', attributes: { name: NOME_GRUPO, isInternalGroup: false, publicLinkEnabled: true, publicLinkLimitEnabled: false, feedbackEnabled: true },
      relationships: { app: { data: { type: 'apps', id: app.id } } } },
  });
  if (novo.status >= 300) falha('não consegui criar o grupo', novo);
  grupo = novo.d.data;
  console.log(`Grupo externo criado: ${NOME_GRUPO} ✓`);
}
console.log(`Grupo usado: ${grupo.attributes.name} (${grupo.id})`);

// 3) Build mais novo já processado entra no grupo
const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=preReleaseVersion`);
const versoes = {}; for (const inc of (builds.d && builds.d.included) || []) versoes[inc.id] = inc.attributes.version;
const build = ((builds.d && builds.d.data) || []).find(b => b.attributes.processingState === 'VALID' && !b.attributes.expired);
if (build) {
  const v = versoes[build.relationships?.preReleaseVersion?.data?.id] || '?';
  const add = await api('POST', `/v1/betaGroups/${grupo.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
  console.log(`Build ${v} (${build.attributes.version}) no grupo: ${add.status < 300 ? 'ok ✓' : `aviso ${add.status} (talvez já estivesse)`}`);
  // Compliance de criptografia (destrava "Missing Compliance" no TestFlight)
  await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
} else console.log('Aviso: nenhum build válido processado ainda.');

// 4) Link público ligado
if (!grupo.attributes.publicLinkEnabled) {
  const p = await api('PATCH', `/v1/betaGroups/${grupo.id}`, { data: { type: 'betaGroups', id: grupo.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: false } } });
  if (p.status < 300) { grupo = p.d.data; console.log('Link público ligado ✓'); } else console.log('Aviso: não consegui ligar o link público', JSON.stringify(p.d || {}).slice(0, 200));
}

// 5) Convida cada e-mail (se já existir como testador, só coloca no grupo)
for (const email of EMAILS) {
  const cria = await api('POST', '/v1/betaTesters', {
    data: { type: 'betaTesters', attributes: { email }, relationships: { betaGroups: { data: [{ type: 'betaGroups', id: grupo.id }] } } },
  });
  if (cria.status < 300) { console.log(`Convite enviado para ${email} ✓`); continue; }
  const busca = await api('GET', `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}`);
  const t = ((busca.d && busca.d.data) || [])[0];
  if (!t) { console.log(`Aviso: não consegui convidar ${email}:`, JSON.stringify(cria.d || {}).slice(0, 200)); continue; }
  const liga = await api('POST', `/v1/betaGroups/${grupo.id}/relationships/betaTesters`, { data: [{ type: 'betaTesters', id: t.id }] });
  console.log(`${email} já era testador — colocado no grupo: ${liga.status < 300 ? 'ok ✓' : 'aviso ' + liga.status}`);
}

// 6) Estado final
const fim = await api('GET', `/v1/betaGroups/${grupo.id}`);
const g = fim.d && fim.d.data ? fim.d.data.attributes : grupo.attributes;
console.log('\n══════════════════════════════════════');
console.log(`LINK PÚBLICO DO TESTFLIGHT: ${g.publicLink || '(ainda não gerado — a Apple libera após a revisão do beta)'}`);
console.log('══════════════════════════════════════');
