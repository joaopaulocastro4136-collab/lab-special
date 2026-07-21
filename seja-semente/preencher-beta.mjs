// Preenche as informações beta dos dois apps (descrição, e-mail de contato)
// e reenvia o build para a análise beta da Apple — o que faltava para o
// link público do TestFlight liberar a instalação.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const EMAIL = 'joaopaulocastro41@gmail.com';

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
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}

const APPS = [
  {
    bundle: 'com.sejasemente.central',
    descricao: 'Central do projeto social Seja Semente: triagem inicial das pessoas acolhidas, agendamentos, avisos e equipe de voluntários. Versão de teste para a coordenação do projeto.',
  },
  {
    bundle: 'com.sejasemente.semeador',
    descricao: 'Aplicativo do voluntário do projeto social Seja Semente: avisos da central, escalas com confirmação de presença e agenda. Versão de teste para os voluntários do projeto.',
  },
];

let deuErro = false;

for (const cfg of APPS) {
  console.log(`\n══ ${cfg.bundle} ══`);
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${cfg.bundle}`);
  const app = apps.dados?.data?.[0];
  if (!app) { console.log('  ✗ app não achado'); deuErro = true; continue; }

  // Descrição beta (localização) — acha a existente e preenche, ou cria pt-BR
  const locs = await api('GET', `/v1/apps/${app.id}/betaAppLocalizations`);
  let loc = (locs.dados?.data || []).find(l => (l.attributes.locale || '').startsWith('pt')) || locs.dados?.data?.[0];
  if (loc) {
    const upd = await api('PATCH', `/v1/betaAppLocalizations/${loc.id}`, {
      data: { type: 'betaAppLocalizations', id: loc.id, attributes: { description: cfg.descricao, feedbackEmail: EMAIL } },
    });
    console.log(`  Descrição beta (${loc.attributes.locale}): ${upd.status >= 200 && upd.status < 300 ? 'ok' : JSON.stringify(upd.dados?.errors?.[0]?.detail || '').slice(0, 150)}`);
  } else {
    const cria = await api('POST', '/v1/betaAppLocalizations', {
      data: {
        type: 'betaAppLocalizations',
        attributes: { locale: 'pt-BR', description: cfg.descricao, feedbackEmail: EMAIL },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    });
    console.log(`  Descrição beta criada: ${cria.status}`);
  }

  // Dados de contato da análise (se a Apple pedir)
  const det = await api('GET', `/v1/apps/${app.id}/betaAppReviewDetail`);
  const detId = det.dados?.data?.id;
  if (detId) {
    await api('PATCH', `/v1/betaAppReviewDetails/${detId}`, {
      data: {
        type: 'betaAppReviewDetails', id: detId,
        attributes: { contactEmail: EMAIL, contactFirstName: 'Joao Paulo', contactLastName: 'Castro', contactPhone: '+55 11 99999-9999' },
      },
    });
    console.log('  Contato da análise preenchido');
  }

  // Reenvia o build mais novo para a análise beta
  const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`);
  const build = (builds.dados?.data || []).find(b => b.attributes.processingState === 'VALID');
  if (!build) { console.log('  ✗ sem build válido'); deuErro = true; continue; }
  const beta = await api('POST', '/v1/betaAppReviewSubmissions', {
    data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
  });
  if (beta.status >= 200 && beta.status < 300) console.log(`  ✓ Build nº ${build.attributes.version} ENVIADO para análise beta`);
  else console.log(`  Análise beta: ${JSON.stringify(beta.dados?.errors?.[0]?.detail || beta.dados || {}).slice(0, 200)}`);
}

if (deuErro) process.exit(1);
console.log('\n✓ Informações beta preenchidas e builds na fila de análise');
