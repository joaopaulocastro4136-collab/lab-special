// Alinha o que JÁ ESTÁ no banco: até agora o Palmar gravava a quantidade como
// `quantidade` e a central/Semeador como `qtd`; os movimentos, uns com `em` +
// `delta` e outros com `criadoEm` + `tipo`/`qtd`. Este conserto preenche os
// dois nomes em cada documento antigo, para os três aplicativos verem o mesmo
// estoque e o mesmo histórico. Roda quantas vezes quiser (não duplica nada).
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;

async function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}
const TK = await token();
const cabeca = { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' };

// Lê uma coleção inteira (paginada)
async function lerTudo(colecao) {
  const docs = [];
  let pagina = '';
  do {
    const r = await fetch(`${BASE}/${colecao}?pageSize=300${pagina ? `&pageToken=${pagina}` : ''}`, { headers: cabeca });
    const j = await r.json();
    (j.documents || []).forEach(d => docs.push(d));
    pagina = j.nextPageToken || '';
  } while (pagina);
  return docs;
}
const numero = (f) => f ? Number(f.integerValue ?? f.doubleValue ?? 0) : undefined;
const texto = (f) => f?.stringValue ?? '';

// ── Itens do estoque: qtd ⇄ quantidade ──
let itens = 0;
for (const d of await lerTudo('estoque')) {
  const f = d.fields || {};
  const qtd = numero(f.qtd), quantidade = numero(f.quantidade);
  if (qtd !== undefined && quantidade !== undefined) continue;   // já alinhado
  const n = qtd ?? quantidade ?? 0;
  const nome = d.name.split('/').pop();
  const r = await fetch(`${BASE}/estoque/${nome}?updateMask.fieldPaths=qtd&updateMask.fieldPaths=quantidade`, {
    method: 'PATCH', headers: cabeca,
    body: JSON.stringify({ fields: { qtd: { integerValue: String(n) }, quantidade: { integerValue: String(n) } } }),
  });
  if (r.status === 200) { itens++; console.log(`  ✓ ${texto(f.nome) || nome}: ${n}`); }
}

// ── Movimentos: em ⇄ criadoEm, delta ⇄ tipo/qtd ──
let movs = 0;
for (const d of await lerTudo('estoque-movimentos')) {
  const f = d.fields || {};
  const temEm = !!f.em, temDelta = f.delta !== undefined;
  if (temEm && temDelta) continue;                                // já alinhado
  const qtd = numero(f.qtd) ?? 0;
  const delta = temDelta ? numero(f.delta) : (texto(f.tipo) === 'entrada' ? qtd : -qtd);
  const quando = f.em?.timestampValue || f.criadoEm?.timestampValue || new Date().toISOString();
  const campos = {
    em: { timestampValue: quando },
    criadoEm: { timestampValue: quando },
    delta: { integerValue: String(delta) },
    qtd: { integerValue: String(Math.abs(delta)) },
    tipo: { stringValue: delta < 0 ? 'saida' : 'entrada' },
  };
  const nome = d.name.split('/').pop();
  const mascara = Object.keys(campos).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const r = await fetch(`${BASE}/estoque-movimentos/${nome}?${mascara}`, {
    method: 'PATCH', headers: cabeca, body: JSON.stringify({ fields: campos }),
  });
  if (r.status === 200) { movs++; console.log(`  ✓ movimento ${texto(f.itemNome)}: ${delta}`); }
}

console.log(`\n✓ Estoque alinhado — ${itens} item(ns) e ${movs} movimento(s) agora falam a mesma língua nos três aplicativos.`);
