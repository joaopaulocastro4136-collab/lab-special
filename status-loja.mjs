// Diagnóstico READ-ONLY do status na App Store: mostra o estado da versão de
// cada app (Lab e Clinic), o estado da submissão de análise e — quando a Apple
// devolve — as mensagens do Resolution Center (motivo da reprovação).
// Não altera nada. Rodar: aba Actions → "Status da loja".
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const BUNDLES = (process.env.BUNDLES || 'com.laboratorio.special,com.laboratorio.specialclinic').split(',').map(s => s.trim());

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(caminho) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    headers: { Authorization: 'Bearer ' + jwt() },
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}

for (const BUNDLE of BUNDLES) {
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`APP: ${BUNDLE}`);
  console.log(`══════════════════════════════════════════════`);
  const apps = await api(`/v1/apps?filter[bundleId]=${BUNDLE}`);
  const app = ((apps.dados && apps.dados.data) || []).find(a => a.attributes.bundleId === BUNDLE);
  if (!app) { console.log('  (app não encontrado)'); continue; }
  console.log(`Nome: ${app.attributes.name}`);

  // Versões (as 5 mais recentes) com o estado atual
  const vers = await api(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`);
  const versoes = (vers.dados && vers.dados.data) || [];
  console.log(`\nVersões:`);
  for (const v of versoes) {
    console.log(`  • ${v.attributes.versionString}  →  ${v.attributes.appStoreState}  (criada ${String(v.attributes.createdDate || '').slice(0, 10)})`);
  }

  // Submissões de análise (a mais recente carrega o resultado da Apple)
  const subs = await api(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=IOS&limit=3&sort=-submittedDate`);
  const submissoes = (subs.dados && subs.dados.data) || [];
  console.log(`\nSubmissões de análise:`);
  if (submissoes.length === 0) console.log('  (nenhuma)');
  for (const s of submissoes) {
    console.log(`  • estado: ${s.attributes.state}  submetida ${String(s.attributes.submittedDate || '').slice(0, 16).replace('T', ' ')}`);
  }

  // Motivo da devolução (Resolution Center): tenta pelo appStoreVersion editável
  const ESTADOS_DEVOLVIDO = ['REJECTED', 'METADATA_REJECTED', 'DEVELOPER_REJECTED', 'INVALID_BINARY'];
  const devolvida = versoes.find(v => ESTADOS_DEVOLVIDO.includes(v.attributes.appStoreState));
  if (devolvida) {
    console.log(`\n⚠️  Versão ${devolvida.attributes.versionString} está em ${devolvida.attributes.appStoreState}.`);
    // Mensagens do Resolution Center
    const rej = await api(`/v1/appStoreVersions/${devolvida.id}/resolutionCenterThreads`);
    const threads = (rej.dados && rej.dados.data) || [];
    if (threads.length) {
      for (const th of threads) {
        const msgs = await api(`/v1/resolutionCenterThreads/${th.id}/messages?limit=10`);
        for (const m of ((msgs.dados && msgs.dados.data) || [])) {
          const a = m.attributes || {};
          console.log(`\n  ── ${a.fromActor || '?'} (${String(a.createdDate || '').slice(0, 16).replace('T', ' ')}) ──`);
          console.log('  ' + String(a.messageBody || '').replace(/\n/g, '\n  '));
        }
      }
    } else if (rej.status >= 400) {
      console.log(`  (não consegui ler o Resolution Center por API — status ${rej.status}. O texto do motivo costuma estar visível no App Store Connect → Resolution Center.)`);
    } else {
      console.log('  (nenhuma mensagem no Resolution Center por API)');
    }
  } else {
    console.log(`\n✓ Nenhuma versão em estado de reprovação agora.`);
  }
}
console.log('\n══════════════════════════════════════════════\nFim do diagnóstico.');
