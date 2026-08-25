// Mostra, das versões do Palmar e da Colheita, o número que aparece no
// TestFlight e a hora em que a Apple recebeu
import crypto from 'crypto';
const KEY_ID = process.env.ASC_KEY_ID.trim(), ISSUER = process.env.ASC_ISSUER_ID.trim(), P8 = process.env.ASC_KEY_P8;
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (c) => (await fetch('https://api.appstoreconnect.apple.com' + c, { headers: { Authorization: 'Bearer ' + JWT } })).json();
for (const [nome, id] of [['Palmar', '6805159974'], ['Colheita', '6805244353']]) {
  console.log(`\n══ ${nome} ══`);
  const r = await api(`/v1/builds?filter[app]=${id}&sort=-uploadedDate&limit=3&include=preReleaseVersion`);
  const versoes = Object.fromEntries((r.included || []).map(i => [i.id, i.attributes.version]));
  for (const b of r.data || []) {
    const pv = versoes[b.relationships?.preReleaseVersion?.data?.id] || '?';
    console.log(`  No TestFlight aparece como: ${pv} (${b.attributes.version})`);
    console.log(`    recebido pela Apple: ${b.attributes.uploadedDate} · processamento: ${b.attributes.processingState} · liberado p/ interno: ${b.attributes.buildAudienceType || '—'}`);
  }
}
