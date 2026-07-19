// Consulta a App Store Connect: quais builds subiram e em que estado estão
// (processando / válido / inválido) — pros dois apps (Lab e Clinic).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 900, aud: 'appstoreconnect-v1' });
const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = semAssin + '.' + assin;
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + JWT } });
  return r.json();
};

const apps = await api('/apps?filter[bundleId]=com.laboratorio.special,com.laboratorio.specialclinic');
for (const app of apps.data || []) {
  console.log(`\n══ ${app.attributes.name} (${app.attributes.bundleId}) ══`);
  const builds = await api(`/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=6&include=preReleaseVersion&fields[builds]=version,processingState,uploadedDate,expired&fields[preReleaseVersions]=version`);
  const versoes = {};
  for (const inc of builds.included || []) versoes[inc.id] = inc.attributes.version;
  for (const b of builds.data || []) {
    const vr = versoes[b.relationships?.preReleaseVersion?.data?.id] || '?';
    console.log(`  versão ${vr} (build ${b.attributes.version}) | ${b.attributes.processingState}${b.attributes.expired ? ' | EXPIRADO' : ''} | subiu ${b.attributes.uploadedDate}`);
  }
}
console.log('\nChecagem concluída ✓');
