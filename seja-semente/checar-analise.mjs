// Confere o estado da análise beta dos builds dos dois apps do Seja Semente.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assin;

const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  return { status: r.status, json: await r.json() };
};

for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  const builds = await api(`/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=3&fields[builds]=version,processingState,uploadedDate`);
  const build = builds.json.data?.[0];
  if (!build) { console.log(`${nome}: sem builds`); continue; }
  const sub = await api(`/v1/betaAppReviewSubmissions?filter[build]=${build.id}&fields[betaAppReviewSubmissions]=betaReviewState,submittedDate`);
  const estado = sub.json.data?.[0]?.attributes;
  console.log(`${nome}: build nº ${build.attributes.version} → análise beta: ${estado?.betaReviewState || 'NÃO ENVIADO'} (enviado em ${estado?.submittedDate || '—'})`);
}
