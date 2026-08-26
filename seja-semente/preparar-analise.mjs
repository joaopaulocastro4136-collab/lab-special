// ═══════════════════════════════════════════════════════════════════════════
//  A CONTA DE DEMONSTRAÇÃO PARA A ANÁLISE DA APPLE
//
//  A Apple exige (diretriz 2.1) uma conta que funcione durante toda a
//  análise. Nossos aplicativos são fechados por convite — se o analista
//  entrar e não conseguir passar da porta, ele reprova sem nem olhar.
//
//  Este robô cria, DEPOIS do banco zerado:
//   - uma conta de e-mail e senha para o analista, em cada aplicativo
//   - o papel dela já liberado (coordenação, voluntário aprovado, gestor,
//     apoiador), para ele entrar direto
//   - dois pacientes de mentira com fotos, para as telas não estarem vazias
//     (aplicativo vazio parece incompleto e também reprova)
//
//  Rodar pelo robô: robo-semente.yml com seja-semente/preparar-analise.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const PROJETO = 'seja-semente-app';
const SENHA = 'AnaliseApple2026!';
const CONTAS = [
  { email: 'analise.central@sejasemente.org',  nome: 'Análise — Coordenação', papel: 'central' },
  { email: 'analise.semeador@sejasemente.org', nome: 'Análise — Dentista',    papel: 'voluntario' },
  { email: 'analise.palmar@sejasemente.org',   nome: 'Análise — Gestão',      papel: 'gestor' },
  { email: 'analise.colheita@sejasemente.org', nome: 'Análise — Apoiador',    papel: 'apoiador' },
];

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
async function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TK = await token();
const pedir = async (metodo, url, corpo) => {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const texto = (v) => ({ stringValue: String(v) });
const sim = (v) => ({ booleanValue: !!v });
const agora = () => ({ timestampValue: new Date().toISOString() });

console.log('══ Contas para a análise ══');
for (const c of CONTAS) {
  // 1. A conta de entrada
  let uid = '';
  const cria = await pedir('POST',
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts`,
    { email: c.email, password: SENHA, displayName: c.nome, emailVerified: true });
  if (cria.status === 200) { uid = cria.json.localId; console.log(`\n${c.email}: conta criada`); }
  else {
    // Já existia: acha o uid e refaz a senha
    const busca = await pedir('POST',
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:lookup`, { email: [c.email] });
    uid = busca.json.users?.[0]?.localId || '';
    if (!uid) { console.log(`\n${c.email}: ✗ ${cria.status} ${JSON.stringify(cria.json.error?.message || '').slice(0, 120)}`); continue; }
    await pedir('POST', `https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:update`,
      { localId: uid, password: SENHA, displayName: c.nome, emailVerified: true });
    console.log(`\n${c.email}: conta já existia — senha refeita`);
  }

  // 2. O papel, já liberado
  const grava = async (colecao, id, campos) => {
    const r = await pedir('PATCH', `${BASE}/${colecao}/${encodeURIComponent(id)}`, { fields: campos });
    console.log(`  ${colecao}/${String(id).slice(0, 28)}: ${r.status === 200 ? '✓' : '✗ ' + r.status}`);
  };
  const base = { nome: texto(c.nome), email: texto(c.email), criadoEm: agora(), analiseApple: sim(true) };
  if (c.papel === 'central') await grava('central-usuarios', uid, { ...base, papel: texto('equipe') });
  if (c.papel === 'gestor') await grava('palmar-usuarios', uid, { ...base, papel: texto('gestor') });
  if (c.papel === 'apoiador') await grava('apoiadores', c.email, { nome: texto(c.nome), desde: agora() });
  if (c.papel === 'voluntario') {
    await grava('voluntarios', uid, {
      ...base, ministerio: texto('Dentista'), status: texto('ativo'), ativo: sim(true),
      procedimentos: { arrayValue: { values: [texto('Dentística'), texto('Cirurgia'), texto('Profilaxia')] } },
    });
  }
  // Todos entram na Colheita também, para o analista ver a prestação de contas
  if (c.papel !== 'apoiador') await grava('apoiadores', c.email, { nome: texto(c.nome), desde: agora() });
}

// ─── Pacientes de mentira, para as telas não estarem vazias ───
console.log('\n══ Dados de exemplo (fictícios) ══');
const hoje = new Date().toISOString().slice(0, 10);
const EXEMPLOS = [
  { id: 'exemplo-1', nome: 'Paciente Exemplo Um', idade: '34', telefone: '(11) 90000-0001' },
  { id: 'exemplo-2', nome: 'Paciente Exemplo Dois', idade: '52', telefone: '(11) 90000-0002' },
];
for (const p of EXEMPLOS) {
  const r = await pedir('PATCH', `${BASE}/pacientes/${p.id}`, {
    fields: {
      nome: texto(p.nome), idade: texto(p.idade), telefone: texto(p.telefone),
      status: texto('triado'), criadoEm: agora(), exemploParaAnalise: sim(true),
      observacoes: texto('Cadastro fictício, criado só para a análise da App Store. Não é uma pessoa real.'),
      triagem: { mapValue: { fields: {
        areas: { arrayValue: { values: [texto('Dentística')] } },
        dentes: { arrayValue: { values: [{ integerValue: '11' }, { integerValue: '21' }] } },
        feitaPorNome: texto('Análise — Coordenação'),
      } } },
    },
  });
  console.log(`  pacientes/${p.id}: ${r.status === 200 ? '✓' : '✗ ' + r.status}`);
}

console.log(`\n══ Para colar nas notas da análise ══`);
console.log(`Senha de todas: ${SENHA}`);
for (const c of CONTAS) console.log(`  ${c.papel.padEnd(11)} ${c.email}`);
console.log('\n✓ Fim');
