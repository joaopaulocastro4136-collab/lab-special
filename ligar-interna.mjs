// Confere se o e-mail já aceitou o convite da equipe e o coloca no grupo INTERNO do TestFlight.
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
async function api(m, c, b) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + c, { method: m, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { }
  return { status: r.status, d };
}
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = ((apps.d && apps.d.data) || []).find(a => a.attributes.bundleId === BUNDLE);
const grupos = await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=50`);
const internos = ((grupos.d && grupos.d.data) || []).filter(g => g.attributes.isInternalGroup);
console.log('Grupos internos: ' + internos.map(g => g.attributes.name).join(', '));

for (const email of EMAILS) {
  // 1) aceitou o convite? (vira usuário da equipe)
  const us = await api('GET', `/v1/users?filter[username]=${encodeURIComponent(email)}`);
  const user = ((us.d && us.d.data) || [])[0];
  const pend = await api('GET', `/v1/userInvitations?filter[email]=${encodeURIComponent(email)}`);
  const convitePendente = ((pend.d && pend.d.data) || []).length > 0;
  console.log(`\n${email}: usuário da equipe = ${user ? 'SIM ✓ (' + (user.attributes.roles || []).join(',') + ')' : 'ainda não'} | convite pendente = ${convitePendente ? 'sim (não aceitou ainda)' : 'não'}`);

  // 2) registro de testador
  const bt = await api('GET', `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&include=betaGroups`);
  const tester = ((bt.d && bt.d.data) || [])[0];
  const gruposDela = tester ? ((tester.relationships?.betaGroups?.data) || []).map(x => x.id) : [];
  console.log(`   testador no TestFlight: ${tester ? 'sim (' + tester.attributes.inviteType + ')' : 'não'} | grupos: ${gruposDela.length ? gruposDela.map(id => (((grupos.d && grupos.d.data) || []).find(g => g.id === id) || {}).attributes?.name || id).join(', ') : 'nenhum'}`);

  // 3) coloca em TODOS os grupos internos (quem está num grupo interno vê o build na hora)
  for (const g of internos) {
    if (gruposDela.includes(g.id)) { console.log(`   já está no grupo interno "${g.attributes.name}" ✓`); continue; }
    let r;
    if (tester) r = await api('POST', `/v1/betaGroups/${g.id}/relationships/betaTesters`, { data: [{ type: 'betaTesters', id: tester.id }] });
    else r = await api('POST', '/v1/betaTesters', { data: { type: 'betaTesters', attributes: { email }, relationships: { betaGroups: { data: [{ type: 'betaGroups', id: g.id }] } } } });
    console.log(`   grupo interno "${g.attributes.name}": ${r.status < 300 ? 'adicionada ✓' : 'não deu (' + r.status + ') ' + JSON.stringify(r.d || {}).slice(0, 220)}`);
  }
}
