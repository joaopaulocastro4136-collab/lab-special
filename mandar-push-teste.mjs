// Rajada de notificações de TESTE numeradas para o Special Clinic (e um controle
// para o Lab). Cada uma vai num formato diferente — o número que aparecer no
// iPhone diz exatamente qual formato o aparelho aceita mostrar.
// O envio em si é feito pelo carteiro da nuvem (função aoTestarPush), que tem a
// chave da Apple: aqui só gravamos os pedidos de teste em testesPush.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }),
})).json();
if (!tok.access_token) { console.error('ERRO: sem token Google'); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Converte um objeto JS simples para o formato de campos do Firestore REST
function campos(o) {
  const f = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'boolean') f[k] = { booleanValue: v };
    else if (typeof v === 'number') f[k] = { integerValue: String(v) };
    else if (v && typeof v === 'object') f[k] = { mapValue: { fields: campos(v) } };
    else f[k] = { stringValue: String(v) };
  }
  return f;
}

async function gravarTeste(dados) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const r = await fetch(`${BASE}/labs/principal/testesPush?documentId=${id}`, {
    method: 'POST', headers: H, body: JSON.stringify({ fields: campos(dados) }),
  });
  return r.status;
}

const testes = [
  { titulo: 'TESTE 1 · Special Clinic', corpo: 'O mais simples possível. Se apareceu, me diga: teste 1.', dentista: 'Dra Gabriela' },
  { titulo: 'TESTE 2 · Special Clinic', corpo: 'Formato igual ao aviso de aprovação (com número no ícone). Me diga: teste 2.', dentista: 'Dra Gabriela', badge: true, dados: { casoId: 'teste' } },
  { titulo: 'TESTE 3 · Special Clinic', corpo: 'Urgente: tenta furar o modo Foco/Não Perturbe. Me diga: teste 3.', dentista: 'Dra Gabriela', urgente: true },
  { titulo: 'TESTE 4 · Special Clinic', corpo: 'Sem som, só a faixa. Me diga: teste 4.', dentista: 'Dra Gabriela', som: false },
  { titulo: 'CONTROLE · Lab Special', corpo: 'Se esta apareceu e as do Clinic não, me diga: controle.', destino: 'lab' },
];

for (const t of testes) {
  const st = await gravarTeste(t);
  console.log(`${t.titulo}: ${st === 200 ? 'pedido gravado ✓ — o carteiro envia agora' : 'ERRO ' + st}`);
  await espera(20000);
}

// TESTE 5 — o canal padrão de verdade (avisosAprovacao → aoPedirAprovacao)
const avisoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rAviso = await fetch(`${BASE}/labs/principal/avisosAprovacao?documentId=${avisoId}`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ fields: campos({
    casoId: '', dentista: 'Dra Gabriela', paciente: 'TESTE 5 (canal padrão)',
    anexoNome: 'TESTE 5 — me diga: teste 5', em: new Date().toISOString(),
  }) }),
});
console.log('TESTE 5 (canal padrão):', rAviso.status, rAviso.ok ? 'gravado ✓' : (await rAviso.text()).slice(0, 200));

console.log('\nRajada enviada. O número que aparecer no iPhone conta a história toda.');
