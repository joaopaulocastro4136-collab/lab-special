// Diagnóstico para as notificações de chamada (push): descobre o que já
// está pronto e o que falta, sem mudar nada.
// - Google: o projeto tem cobrança (billing) ligada? A conta de serviço
//   enxerga alguma conta de cobrança? Cloud Functions/Run estão ativos?
// - Apple: os bundle IDs têm a permissão PUSH_NOTIFICATIONS? Há chaves/
//   certificados de push por lá?
// Roda pelo robô (workflow "Robô Seja Semente") com os dois segredos.
import crypto from 'crypto';

const PROJETO = 'seja-semente-app';

// ─── Lado Google (conta de serviço) ───
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
async function tokenGoogle(escopo) {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: escopo, aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}

const TKG = await tokenGoogle('https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/cloud-billing');
async function google(url) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + TKG } });
  let dados = null;
  try { dados = await r.json(); } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}

console.log('══ GOOGLE ══');
const bill = await google(`https://cloudbilling.googleapis.com/v1/projects/${PROJETO}/billingInfo`);
console.log(`billingInfo (${bill.status}): ${JSON.stringify(bill.dados).slice(0, 300)}`);
const contas = await google('https://cloudbilling.googleapis.com/v1/billingAccounts');
console.log(`billingAccounts (${contas.status}): ${JSON.stringify(contas.dados).slice(0, 400)}`);
for (const svc of ['cloudfunctions.googleapis.com', 'run.googleapis.com', 'cloudbuild.googleapis.com', 'fcm.googleapis.com']) {
  const s = await google(`https://serviceusage.googleapis.com/v1/projects/${PROJETO}/services/${svc}`);
  console.log(`${svc}: ${s.dados?.state || s.status}`);
}
const iosApps = await google(`https://firebase.googleapis.com/v1beta1/projects/${PROJETO}/iosApps`);
console.log(`iosApps no Firebase (${iosApps.status}): ${JSON.stringify(iosApps.dados).slice(0, 400)}`);

// ─── Lado Apple (App Store Connect) ───
console.log('\n══ APPLE ══');
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const assinA = crypto.sign('sha256', Buffer.from(semAssin), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assinA;
async function apple(caminho) {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  let json = {};
  try { json = await r.json(); } catch (e) { /* vazio */ }
  return { status: r.status, json };
}

for (const bundle of ['com.sejasemente.central', 'com.sejasemente.semeador']) {
  const busca = await apple(`/bundleIds?filter[identifier]=${bundle}`);
  const reg = (busca.json.data || []).find(d => d.attributes.identifier === bundle);
  if (!reg) { console.log(`${bundle}: NÃO registrado`); continue; }
  const caps = await apple(`/bundleIds/${reg.id}/bundleIdCapabilities`);
  const tipos = (caps.json.data || []).map(c => c.attributes?.capabilityType);
  console.log(`${bundle} (${reg.id}) capacidades: ${tipos.join(', ') || '(nenhuma listada)'} [${caps.status}]`);
}
const certs = await apple('/certificates?limit=20&fields[certificates]=certificateType,displayName,expirationDate');
console.log(`certificados (${certs.status}): ${(certs.json.data || []).map(c => `${c.attributes.certificateType}:${c.attributes.displayName}`).join(' | ')}`);

console.log('\n✓ Fim do diagnóstico');
