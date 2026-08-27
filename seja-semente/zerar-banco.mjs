// ═══════════════════════════════════════════════════════════════════════════
//  ZERAR O BANCO — deixar tudo limpo antes de mandar para a Apple
//
//  Apaga TODO o dado de teste: pacientes e suas fichas, fotos, triagens,
//  procedimentos, atendimentos, agenda, depoimentos (com os vídeos),
//  estoque, notas, ações, chat, avisos, chamadas, denúncias E TAMBÉM as
//  contas de voluntário, gestor e investidor.
//
//  DEPOIS DE RODAR, o projeto fica zerado. Para o dono conseguir entrar de
//  novo, o robô deixa o e-mail dele PRÉ-AUTORIZADO nos quatro aplicativos —
//  é a única coisa que sobra de propósito. Sem isso, com as regras novas,
//  ninguém entraria mais (o "primeiro que chega vira dono" foi removido,
//  justamente porque era um buraco de segurança).
//
//  Rodar pelo robô: robo-semente.yml com seja-semente/zerar-banco.mjs
//  ATENÇÃO: não tem volta.
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const PROJETO = 'seja-semente-app';
const DONO = 'joaopaulocastro41@gmail.com';
const DONO2 = 'joaopaulocastro4136@gmail.com';   // a conta da Apple/TestFlight

// Tudo o que é apagado, na raiz. Subcoleções vão junto (o robô desce nelas).
const COLECOES = [
  'pacientes', 'agendamentos', 'atendimentos', 'procedimentos-feitos',
  'depoimentos', 'chat', 'avisos', 'chamadas', 'convocacoes', 'denuncias',
  'acoes', 'notas', 'estoque', 'estoque-movimentos', 'investidores',
  'apoiadores', 'voluntarios', 'central-usuarios', 'palmar-usuarios',
  'codigos-acesso', 'palmar-codigos', 'colheita-codigos',
  'central-autorizados', 'palmar-autorizados', 'aparelhos', 'jogos-ludo',
];
// Estas ficam: são a configuração do projeto, não dado de ninguém
const FICAM = ['config'];

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
async function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
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
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const pedir = async (metodo, url, corpo) => {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

let apagados = 0;

// O nome que o Firestore devolve já vem completo
// (projects/.../documents/pacientes/abc). Estas duas funções trabalham
// sempre com o endereço INTEIRO, para não montar caminho em cima de caminho.
const enderecoDe = (nome) => `https://firestore.googleapis.com/v1/${nome}`;

// Apaga um documento e tudo o que está pendurado nele
async function apagarDoc(nome) {
  const subs = await pedir('POST', `${enderecoDe(nome)}:listCollectionIds`, {});
  for (const sub of (subs.json.collectionIds || [])) await apagarColecao(`${nome}/${sub}`);
  await pedir('DELETE', enderecoDe(nome));
  apagados++;
}

// `caminho` é sempre relativo ao banco: 'pacientes' ou
// 'projects/.../documents/pacientes/abc/arquivos'
async function apagarColecao(caminho) {
  const url = caminho.startsWith('projects/')
    ? enderecoDe(caminho)
    : `${BASE}/${caminho}`;
  let pagina = '';
  for (;;) {
    const r = await pedir('GET', `${url}?pageSize=300${pagina ? '&pageToken=' + pagina : ''}`);
    const docs = r.json.documents || [];
    for (const d of docs) await apagarDoc(d.name);
    pagina = r.json.nextPageToken || '';
    if (!pagina) break;
  }
}

console.log('══ Zerando o banco ══');
for (const c of COLECOES) {
  const antes = apagados;
  await apagarColecao(c);
  console.log(`  ${c}: ${apagados - antes} apagado(s)`);
}
console.log(`\n  Mantidas de propósito: ${FICAM.join(', ')} (a configuração do projeto)`);
console.log(`  Total apagado: ${apagados} documento(s)`);

// ─── A porta de volta ───
console.log('\n══ Deixando a porta aberta para o dono ══');
const campo = (v) => ({ stringValue: v });
for (const email of [DONO, DONO2]) {
  for (const colecao of ['central-autorizados', 'palmar-autorizados']) {
    const r = await pedir('PATCH', `${BASE}/${colecao}/${encodeURIComponent(email)}`, {
      fields: { convidadoEm: { timestampValue: new Date().toISOString() }, motivo: campo('dono do projeto') },
    });
    console.log(`  ${colecao}/${email}: ${r.status === 200 ? '✓' : '✗ ' + r.status}`);
  }
  // Na Colheita a chave é o próprio e-mail
  const r2 = await pedir('PATCH', `${BASE}/apoiadores/${encodeURIComponent(email)}`, {
    fields: { nome: campo('Coordenação'), desde: { timestampValue: new Date().toISOString() } },
  });
  console.log(`  apoiadores/${email}: ${r2.status === 200 ? '✓' : '✗ ' + r2.status}`);
}

console.log('\n✓ Fim — o banco está limpo e os e-mails do dono entram direto nos quatro.');
