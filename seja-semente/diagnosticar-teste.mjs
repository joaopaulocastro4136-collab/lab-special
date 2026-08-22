// Diagnóstico do TestFlight dos dois apps do Seja Semente: mostra os últimos
// builds (estado de processamento e de teste interno/externo), os grupos de
// teste e cada testador com seu estado — para descobrir por que uma
// atualização não chegou no aparelho de alguém.
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

const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, { headers: { Authorization: 'Bearer ' + jwt() } });
  return { status: r.status, json: await r.json() };
};

for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  console.log(`\n══ ${nome} ══`);

  const builds = await api(`/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=3&fields[builds]=version,processingState,expired,uploadedDate`);
  for (const b of builds.json.data || []) {
    const a = b.attributes;
    const detalhe = await api(`/v1/builds/${b.id}/buildBetaDetail?fields[buildBetaDetails]=internalBuildState,externalBuildState`);
    const d = detalhe.json.data?.attributes || {};
    console.log(`  Build nº ${a.version} · processamento=${a.processingState} · vencido=${a.expired} · interno=${d.internalBuildState || '?'} · externo=${d.externalBuildState || '?'}`);
  }

  const grupos = await api(`/v1/betaGroups?filter[app]=${appId}&fields[betaGroups]=name,isInternalGroup,publicLinkEnabled,hasAccessToAllBuilds&limit=20`);
  for (const g of grupos.json.data || []) {
    const ga = g.attributes;
    console.log(`  Grupo "${ga.name}" · interno=${ga.isInternalGroup} · linkPublico=${ga.publicLinkEnabled} · todosOsBuilds=${ga.hasAccessToAllBuilds}`);
    const testers = await api(`/v1/betaGroups/${g.id}/betaTesters?fields[betaTesters]=email,state&limit=50`);
    for (const t of testers.json.data || []) {
      console.log(`    Testador: ${t.attributes.email || '(sem e-mail — entrou pelo link)'} · estado=${t.attributes.state}`);
    }
  }
}
console.log('\nFim.');
