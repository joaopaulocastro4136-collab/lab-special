// TESTE REAL do pedido de aprovação, feito direto na nuvem (sem depender do app):
// marca o anexo mais novo da Dra Gabriela como "aprovação pendente" e grava o
// aviso no canal reserva — a notificação deve chegar no Special Clinic em segundos.
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
if (!tok.access_token) { console.error('ERRO: sem token'); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const valor = (v) => v?.stringValue ?? v;

// 1. Acha o caso mais novo da Dra Gabriela que tenha anexo
const todos = [];
let pg = null;
do {
  const cs = await (await fetch(`${BASE}/labs/principal/casos?pageSize=300${pg ? `&pageToken=${pg}` : ''}`, { headers: H })).json();
  for (const d of cs.documents || []) todos.push({ nomeDoc: d.name, f: d.fields || {} });
  pg = cs.nextPageToken || null;
} while (pg);
todos.sort((a, b) => String(valor(b.f.id)).localeCompare(String(valor(a.f.id))));
const alvo = todos.find(c => valor(c.f.dentista) === 'Dra Gabriela' && (c.f.anexos?.arrayValue?.values || []).length > 0);
if (!alvo) { console.error('Nenhum caso com anexo encontrado'); process.exit(1); }

const casoId = valor(alvo.f.id);
const paciente = valor(alvo.f.paciente);
const anexos = alvo.f.anexos.arrayValue.values;
const hoje = new Date().toISOString().slice(0, 10);
// marca o PRIMEIRO anexo como aprovação pendente
const af = anexos[0].mapValue.fields;
const anexoNome = valor(af.nome);
af.aprovacao = { mapValue: { fields: { status: { stringValue: 'pendente' }, pedidaEm: { stringValue: hoje } } } };

console.log(`Caso escolhido: ${casoId} | paciente=${paciente} | anexo=${anexoNome}`);

// 2. Grava o aviso no canal reserva PRIMEIRO (dispara aoPedirAprovacao → push)
const avisoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rAviso = await fetch(`${BASE}/labs/principal/avisosAprovacao?documentId=${avisoId}`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ fields: {
    casoId: { stringValue: casoId },
    dentista: { stringValue: 'Dra Gabriela' },
    paciente: { stringValue: paciente },
    anexoNome: { stringValue: anexoNome },
    em: { stringValue: new Date().toISOString() },
  } }),
});
console.log('Aviso (canal reserva):', rAviso.status, rAviso.ok ? 'gravado ✓ → a notificação dispara agora' : (await rAviso.text()).slice(0, 200));

// 3. Marca a aprovação pendente no caso (faz o cartão aparecer DENTRO da Clinic)
const rCaso = await fetch(`https://firestore.googleapis.com/v1/${alvo.nomeDoc}?updateMask.fieldPaths=anexos`, {
  method: 'PATCH', headers: H,
  body: JSON.stringify({ fields: { anexos: { arrayValue: { values: anexos } } } }),
});
console.log('Caso atualizado:', rCaso.status, rCaso.ok ? 'aprovação pendente gravada ✓ → cartão aparece na Clinic' : (await rCaso.text()).slice(0, 200));

console.log('\nPRONTO: a notificação "Aprovação solicitada 👍" deve chegar no Special Clinic AGORA.');
