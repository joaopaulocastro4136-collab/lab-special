// Rajada de notificações de TESTE numeradas para o Special Clinic (e um controle
// para o Lab). Cada uma vai num formato diferente — o número que aparecer no
// iPhone diz exatamente qual formato o aparelho aceita mostrar.
import crypto from 'crypto';
import http2 from 'http2';
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
const valor = (v) => v?.stringValue ?? v;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Tokens dos aparelhos (clinica e lab)
const toks = await (await fetch(`${BASE}/labs/principal/pushTokens?pageSize=100`, { headers: H })).json();
let tokenClinica = null, tokenLab = null;
for (const d of toks.documents || []) {
  const f = d.fields || {};
  if (valor(f.tipo) === 'clinica' && valor(f.plataforma) === 'ios') tokenClinica = valor(f.token);
  if (valor(f.tipo) === 'lab' && valor(f.plataforma) === 'ios') tokenLab = valor(f.token);
}
console.log('Aparelho Clinic:', tokenClinica ? tokenClinica.slice(0, 12) + '…' : 'NÃO ACHADO');
console.log('Aparelho Lab:   ', tokenLab ? tokenLab.slice(0, 12) + '…' : 'NÃO ACHADO');
if (!tokenClinica) process.exit(1);

// 2. Chave da Apple (guardada no cofre do projeto — Secret Manager)
async function segredo(nome) {
  const r = await fetch(`https://secretmanager.googleapis.com/v1/projects/${PROJETO}/secrets/${nome}/versions/latest:access`, { headers: H });
  if (!r.ok) { console.log(`  (sem acesso ao segredo ${nome}: ${r.status})`); return null; }
  const j = await r.json();
  return Buffer.from(j.payload.data, 'base64').toString('utf8');
}
const APNS_P8 = await segredo('APNS_P8');
const APNS_KEY_ID = await segredo('APNS_KEY_ID');
const TEAM_ID = 'L5NKZSS3J2';

function apnsJWT() {
  const s = b64({ alg: 'ES256', kid: APNS_KEY_ID.trim() }) + '.' + b64({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const a = crypto.sign('sha256', Buffer.from(s), { key: APNS_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return s + '.' + a;
}

function enviar(token, bundle, payload, cabecalhosExtras) {
  return new Promise((resolve) => {
    const c = http2.connect('https://api.push.apple.com');
    let status = 0, resposta = '', apnsId = '';
    const req = c.request({
      ':method': 'POST',
      ':path': '/3/device/' + token,
      authorization: 'bearer ' + apnsJWT(),
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-topic': bundle,
      ...(cabecalhosExtras || {}),
    });
    req.setEncoding('utf8');
    req.on('response', (h) => { status = h[':status']; apnsId = h['apns-id'] || ''; });
    req.on('data', (x) => { resposta += x; });
    req.on('end', () => { c.close(); resolve({ status, resposta, apnsId }); });
    req.on('error', (e) => { c.close(); resolve({ status: 0, resposta: String(e) }); });
    req.end(JSON.stringify(payload));
    setTimeout(() => { try { c.close(); } catch (e) { } resolve({ status: 0, resposta: 'timeout' }); }, 10000);
  });
}

const CLINICA = 'com.laboratorio.specialclinic';
const LAB = 'com.laboratorio.special';

if (APNS_P8 && APNS_KEY_ID) {
  // Bateria direta: formatos diferentes, 20 s entre cada um
  const testes = [
    ['TESTE 1', 'O mais simples possível. Se apareceu, me diga: teste 1.',
      (t, c) => ({ aps: { alert: { title: t, body: c }, sound: 'default' } }), null],
    ['TESTE 2', 'Formato igual ao do aviso de aprovação (com número no ícone). Me diga: teste 2.',
      (t, c) => ({ aps: { alert: { title: t, body: c }, sound: 'default', badge: 1 }, casoId: 'teste' }), null],
    ['TESTE 3', 'Aviso urgente, fura o modo Foco/Não Perturbe. Me diga: teste 3.',
      (t, c) => ({ aps: { alert: { title: t, body: c }, sound: 'default', 'interruption-level': 'time-sensitive' } }), null],
    ['TESTE 4', 'Sem som, guardado por 1 hora se o celular estiver fora do ar. Me diga: teste 4.',
      (t, c) => ({ aps: { alert: { title: t, body: c } } }), { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600) }],
  ];
  for (const [titulo, corpo, montar, extras] of testes) {
    const r = await enviar(tokenClinica, CLINICA, montar(titulo + ' · Special Clinic', corpo), extras);
    console.log(`${titulo} → Clinic: ${r.status} ${r.resposta || ''} (id ${r.apnsId})`);
    await espera(20000);
  }
  if (tokenLab) {
    const r = await enviar(tokenLab, LAB, { aps: { alert: { title: 'CONTROLE · Lab Special', body: 'Se esta apareceu e as do Clinic não, me diga: controle.' }, sound: 'default' } });
    console.log(`CONTROLE → Lab: ${r.status} ${r.resposta || ''} (id ${r.apnsId})`);
  }
} else {
  console.log('Sem a chave da Apple — usando o canal padrão (avisosAprovacao).');
}

// 3. TESTE 5 — canal padrão de verdade: grava o aviso e a função da nuvem envia
await espera(20000);
const avisoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rAviso = await fetch(`${BASE}/labs/principal/avisosAprovacao?documentId=${avisoId}`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ fields: {
    casoId: { stringValue: '' },
    dentista: { stringValue: 'Dra Gabriela' },
    paciente: { stringValue: 'TESTE 5 (canal padrão)' },
    anexoNome: { stringValue: 'TESTE 5 — me diga: teste 5' },
    em: { stringValue: new Date().toISOString() },
  } }),
});
console.log('TESTE 5 (canal padrão):', rAviso.status, rAviso.ok ? 'gravado ✓ — a função da nuvem envia agora' : (await rAviso.text()).slice(0, 200));

console.log('\nRajada enviada. O número que aparecer no iPhone conta a história toda.');
