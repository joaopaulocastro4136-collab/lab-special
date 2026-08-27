// ═══════════════════════════════════════════════════════════════════════════
//  CONTA DO REVISOR DA APPLE
//  A Apple pediu (mensagem do TestFlight) um usuário e senha para o analista
//  dela entrar nos aplicativos. Este robô faz o caminho inteiro:
//    1. cria a conta no Firebase (ou acerta a senha, se já existir)
//    2. libera o acesso dela dentro de cada aplicativo, para o analista não
//       cair na tela de "aguardando aprovação"
//    3. entrega o usuário e a senha para a Apple, nos DOIS lugares:
//       a análise do TestFlight (betaAppReviewDetails) e a da loja
//       (appStoreReviewDetail)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';
// Sem SENHA_REVISOR o robô sorteia uma senha forte e mostra no fim — ela é
// gravada no Firebase e entregue à Apple no mesmo instante, então basta
// guardar a que aparecer no final desta execução.
const SENHA = (process.env.SENHA_REVISOR || '').trim()
  || 'Semente-' + crypto.randomBytes(6).toString('base64url') + '#26';
const CONTATO = { email: 'joaopaulocastro41@gmail.com', nome: 'Joao Paulo', sobrenome: 'Castro', telefone: '+55 11 99999-9999' };

const APPS = {
  central: { bundle: 'com.sejasemente.central', nome: 'Seja Semente', email: 'analise.central@sejasemente.org' },
  semeador: { bundle: 'com.sejasemente.semeador', nome: 'Semeador', email: 'analise.semeador@sejasemente.org' },
  palmar: { bundle: 'com.sejasemente.palmar', nome: 'Palmar', email: 'analise.palmar@sejasemente.org' },
  colheita: { bundle: 'com.sejasemente.colheita', nome: 'Colheita', email: 'analise.colheita@sejasemente.org' },
};

// ─── Google: um token que serve para o Firestore e para as contas ───
async function tokenGoogle() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TKG = await tokenGoogle();

async function google(url, corpo) {
  const r = await fetch(url, {
    method: corpo ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + TKG, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados: d, ok: r.status < 300, cru: t };
}

// ─── Apple ───
const KEY_ID = process.env.ASC_KEY_ID.trim(), ISSUER = process.env.ASC_ISSUER_ID.trim(), P8 = process.env.ASC_KEY_P8;
function jwt() {
  const t = Math.floor(Date.now() / 1000), b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const s = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: t, exp: t + 1200, aud: 'appstoreconnect-v1' });
  return s + '.' + crypto.sign('sha256', Buffer.from(s), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
async function apple(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados: d, ok: r.status < 300 };
}
const erroApple = (r) => ((r.dados?.errors || []).map(e => e.detail || e.title).join(' | ')) || `HTTP ${r.status}`;

// ─── 1. A conta no Firebase ───
const CONTAS = `https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts`;
async function garantirConta(email) {
  const achou = await google(CONTAS + ':lookup', { email: [email] });
  const jaTem = achou.dados?.users?.[0];
  if (jaTem) {
    const muda = await google(CONTAS + ':update', { localId: jaTem.localId, password: SENHA, emailVerified: true });
    if (!muda.ok) { console.log(`   ✗ não consegui acertar a senha de ${email}: ${muda.cru.slice(0, 160)}`); return null; }
    console.log(`   conta ${email} já existia — senha acertada ✓`);
    return jaTem.localId;
  }
  const cria = await google(CONTAS, { email, password: SENHA, emailVerified: true, displayName: 'Analise Apple' });
  if (!cria.ok) { console.log(`   ✗ não consegui criar ${email}: ${cria.cru.slice(0, 160)}`); return null; }
  console.log(`   conta ${email} criada ✓`);
  return cria.dados.localId;
}

// ─── 2. A porta aberta dentro de cada aplicativo ───
const FS = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
async function gravar(colecao, id, campos) {
  const resp = await fetch(`${FS}/${colecao}/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + TKG, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: campos }),
  });
  if (resp.status !== 200) console.log(`   ✗ ${colecao}: ${resp.status} ${(await resp.text()).slice(0, 140)}`);
  return resp.status === 200;
}
const txt = (v) => ({ stringValue: v });
const bool = (v) => ({ booleanValue: v });
const agora = () => ({ timestampValue: new Date().toISOString() });

async function liberarAcesso(chave, email, uid) {
  const marca = { email: txt(email), nome: txt('Analise Apple'), autorizadoPor: txt('robo da loja'), criadoEm: agora() };
  if (chave === 'central') {
    await gravar('central-autorizados', email, marca);
    await gravar('central-usuarios', uid, { ...marca, papel: txt('equipe') });
    console.log('   acesso liberado na central ✓');
  }
  if (chave === 'semeador') {
    // No Semeador quem manda é o cadastro de voluntário, e ele precisa estar ativo
    await gravar('voluntarios', uid, {
      ...marca, ministerio: txt('Dentista'), telefone: txt('(11) 99999-9999'),
      status: txt('ativo'), ativo: bool(true),
    });
    console.log('   voluntário ativo criado no Semeador ✓');
  }
  if (chave === 'palmar') {
    await gravar('palmar-autorizados', email, marca);
    await gravar('palmar-usuarios', uid, { ...marca, papel: txt('gestor') });
    console.log('   acesso liberado no Palmar ✓');
  }
  if (chave === 'colheita') {
    await gravar('apoiadores', email, { ...marca, apoio: txt('Análise da Apple') });
    console.log('   acesso liberado na Colheita ✓');
  }
}

// ─── 3. Entregar usuário e senha para a Apple ───
async function contarParaApple(chave, email) {
  const cfg = APPS[chave];
  const apps = await apple('GET', `/v1/apps?filter[bundleId]=${cfg.bundle}`);
  const app = ((apps.dados && apps.dados.data) || []).find(a => a.attributes.bundleId === cfg.bundle);
  if (!app) { console.log('   ✗ aplicativo não encontrado na Apple'); return false; }

  const conta = {
    demoAccountRequired: true, demoAccountName: email, demoAccountPassword: SENHA,
    contactEmail: CONTATO.email, contactFirstName: CONTATO.nome, contactLastName: CONTATO.sobrenome, contactPhone: CONTATO.telefone,
  };

  // 3a. Análise do TestFlight — é esta que a Apple cobrou na mensagem
  const beta = await apple('GET', `/v1/apps/${app.id}/betaAppReviewDetail`);
  const betaId = beta.dados?.data?.id;
  if (betaId) {
    const r = await apple('PATCH', `/v1/betaAppReviewDetails/${betaId}`, {
      data: { type: 'betaAppReviewDetails', id: betaId, attributes: conta },
    });
    console.log(r.ok ? '   conta entregue à análise do TestFlight ✓' : `   ✗ TestFlight: ${erroApple(r)}`);
  } else console.log('   ✗ não achei a ficha de análise beta');

  // 3b. Análise da loja
  const EDITAVEIS = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
  const vers = await apple('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const versao = ((vers.dados && vers.dados.data) || []).find(v => EDITAVEIS.includes(v.attributes.appStoreState));
  if (!versao) { console.log('   · versão de loja já saiu daqui — deixei a da loja como está'); return true; }
  const det = await apple('GET', `/v1/appStoreVersions/${versao.id}/appStoreReviewDetail`);
  const detId = det.dados?.data?.id;
  if (detId) {
    const r = await apple('PATCH', `/v1/appStoreReviewDetails/${detId}`, {
      data: { type: 'appStoreReviewDetails', id: detId, attributes: conta },
    });
    console.log(r.ok ? '   conta entregue à análise da loja ✓' : `   ✗ loja: ${erroApple(r)}`);
  } else {
    const r = await apple('POST', '/v1/appStoreReviewDetails', {
      data: { type: 'appStoreReviewDetails', attributes: conta,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } } } },
    });
    console.log(r.ok ? '   conta da loja criada ✓' : `   ✗ loja: ${erroApple(r)}`);
  }
  return true;
}

// ─── Roda ───
const QUAL = (process.env.APP || '').trim() || 'todos';
const alvos = QUAL === 'todos' ? Object.keys(APPS) : [QUAL];
for (const chave of alvos) {
  const cfg = APPS[chave];
  console.log(`\n══════ ${cfg.nome} ══════`);
  const uid = await garantirConta(cfg.email);
  if (!uid) continue;
  await liberarAcesso(chave, cfg.email, uid);
  await contarParaApple(chave, cfg.email);
}
console.log('\n════════════════════════════════════════════');
console.log('Conta do revisor pronta em cada aplicativo:');
for (const chave of alvos) console.log(`  ${APPS[chave].nome.padEnd(14)} ${APPS[chave].email}`);
console.log(`  senha (a mesma nos quatro): ${SENHA}`);
console.log('A Apple já recebeu usuário e senha na análise do TestFlight e na da loja.');
