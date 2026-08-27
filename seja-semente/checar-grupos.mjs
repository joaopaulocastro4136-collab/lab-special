// Confere, app por app, se o build mais recente está DENTRO do grupo de teste
// (é o que faz ele aparecer no TestFlight de quem já é testador) e em que pé
// está a análise beta da Apple (que libera o link público).
import crypto from 'crypto';

const APPS = [
  ['com.sejasemente.central', 'Seja Semente'],
  ['com.sejasemente.semeador', 'Semeador'],
  ['com.sejasemente.palmar', 'Palmar'],
  ['com.sejasemente.colheita', 'Colheita'],
];

const KEY = process.env.ASC_KEY_P8.replace(/\\n/g, '\n');
function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cab = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' });
  const corpo = b64({ iss: process.env.ASC_ISSUER_ID, iat: agora, exp: agora + 900, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('SHA256', Buffer.from(`${cab}.${corpo}`), { key: KEY, dsaEncoding: 'ieee-p1363' });
  return `${cab}.${corpo}.${assin.toString('base64url')}`;
}
const TK = token();
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + TK } });
  return r.ok ? r.json() : { erro: r.status, corpo: await r.text() };
};

for (const [bundle, nome] of APPS) {
  const apps = await api(`/apps?filter[bundleId]=${bundle}`);
  const app = apps.data?.[0];
  if (!app) { console.log(`✗ ${nome}: aplicativo não encontrado`); continue; }
  const builds = await api(`/builds?filter[app]=${app.id}&sort=-version&limit=1`);
  const b = builds.data?.[0];
  if (!b) { console.log(`✗ ${nome}: nenhum build`); continue; }
  const num = b.attributes.version;
  const estado = b.attributes.processingState;
  // Em quais grupos este build está?
  const grupos = await api(`/betaGroups?filter[builds]=${b.id}`);
  if (grupos.erro) console.log(`   (aviso ao consultar grupos: ${grupos.erro})`);
  const nomes = (grupos.data || []).map(g => g.attributes.name);
  // Estado da análise beta (link público)
  const rev = await api(`/builds/${b.id}/betaAppReviewSubmission`);
  const analise = rev.data?.attributes?.betaReviewState || (rev.erro ? '—' : 'não enviado');
  const noGrupo = nomes.length ? `✓ no grupo: ${nomes.join(', ')}` : '✗ FORA de qualquer grupo';
  console.log(`${nomes.length ? '✓' : '✗'} ${nome}: build nº ${num} (${estado}) · ${noGrupo} · análise beta: ${analise}`);
}
