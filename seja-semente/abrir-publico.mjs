// Garante o LINK PÚBLICO do TestFlight ligado nos dois apps (qualquer pessoa
// clica e instala, sem convite um a um) e mostra o estado da análise beta —
// o link só passa a instalar depois que a Apple aprova essa análise.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null; try { dados = texto ? JSON.parse(texto) : null; } catch (e) {}
  return { status: r.status, dados };
}

for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  console.log(`\n══ ${nome} ══`);
  const grupos = await api('GET', `/v1/betaGroups?filter[app]=${appId}&filter[isInternalGroup]=false`);
  const grupo = (grupos.dados?.data || [])[0];
  if (!grupo) { console.log('  ✗ nenhum grupo externo'); continue; }
  const a = grupo.attributes;
  console.log(`  Grupo: "${a.name}" · linkPúblico=${a.publicLinkEnabled} · link=${a.publicLink || '—'}`);

  if (!a.publicLinkEnabled) {
    const liga = await api('PATCH', `/v1/betaGroups/${grupo.id}`, {
      data: { type: 'betaGroups', id: grupo.id, attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: false } },
    });
    if (liga.status >= 200 && liga.status < 300) {
      console.log(`  ✓ LINK PÚBLICO LIGADO → ${liga.dados?.data?.attributes?.publicLink || '(gerando…)'}`);
    } else {
      console.log(`  ✗ ligar link: ${JSON.stringify(liga.dados?.errors?.[0]?.detail || liga.dados || {}).slice(0, 220)}`);
    }
  } else {
    console.log('  ✓ Link público já estava ligado');
  }

  // Estado da análise beta do build mais novo (o link só instala se aprovado)
  const builds = await api('GET', `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=1`);
  const build = builds.dados?.data?.[0];
  if (build) {
    const sub = await api('GET', `/v1/betaAppReviewSubmissions?filter[build]=${build.id}&fields[betaAppReviewSubmissions]=betaReviewState`);
    const estado = sub.dados?.data?.[0]?.attributes?.betaReviewState;
    console.log(`  Build nº ${build.attributes.version} · análise beta: ${estado || 'NÃO ENVIADO'}`);
    if (!estado || estado === 'REJECTED') {
      const env = await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } } });
      console.log(env.status >= 200 && env.status < 300 ? '  ✓ Build enviado para a análise beta agora' : `  Envio: ${JSON.stringify(env.dados?.errors?.[0]?.detail || env.dados || {}).slice(0, 200)}`);
    }
  }
}
console.log('\nFim.');
