// Prepara o banco para o modo multi-laboratório SEM mexer em nada existente:
//   • labsIndex/principal (lista de laboratórios)
//   • usuarios/<e-mail> → principal (para cada membro da equipe atual)
//   • dentistasIndex/<e-mail> → principal (para cada dentista já cadastrado)
// Tudo com "só cria se não existe" — rodar de novo não estraga nada.
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
if (!tok.access_token) { console.error('ERRO: sem token', JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const valor = (v) => v?.stringValue ?? v?.integerValue ?? v?.arrayValue ?? v;

// Cria um doc só se ele ainda não existir (currentDocument.exists=false)
async function criarSeNaoExiste(caminho, fields) {
  const r = await fetch(`${BASE}/${caminho}?currentDocument.exists=false`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ fields }),
  });
  if (r.status === 200) { console.log(`  ✓ criado ${caminho}`); return; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 409 || (j.error && String(j.error.status) === 'FAILED_PRECONDITION')) {
    console.log(`  · já existia ${caminho}`);
  } else {
    console.log(`  ✗ falha em ${caminho} (${r.status}): ${JSON.stringify(j).slice(0, 160)}`);
    process.exitCode = 1;
  }
}
const s = (v) => ({ stringValue: v });

console.log('══ labsIndex ══');
await criarSeNaoExiste('labsIndex/principal', { dono: s('joaopaulocastro41@gmail.com'), criadoEm: s(new Date().toISOString()) });

console.log('\n══ usuarios (equipe do principal) ══');
const acesso = await (await fetch(`${BASE}/labs/principal/kv/acesso`, { headers: H })).json();
const emails = ((acesso.fields?.emails?.arrayValue?.values) || []).map(v => v.stringValue).filter(Boolean);
console.log(`  equipe atual: ${emails.join(', ') || '(vazia)'}`);
for (const email of emails) {
  await criarSeNaoExiste(`usuarios/${encodeURIComponent(email.toLowerCase())}`, { lab: s('principal'), em: s(new Date().toISOString()) });
}

console.log('\n══ dentistasIndex (dentistas do principal) ══');
const dents = await (await fetch(`${BASE}/labs/principal/dentistasAcesso?pageSize=300`, { headers: H })).json();
for (const d of dents.documents || []) {
  const email = decodeURIComponent(d.name.split('/').pop());
  const nome = valor(d.fields?.nome) || '';
  await criarSeNaoExiste(`dentistasIndex/${encodeURIComponent(email)}`, { lab: s('principal'), nome: s(String(nome)) });
}
if (!(dents.documents || []).length) console.log('  (nenhum dentista cadastrado)');

console.log('\nBackfill concluído ✓');
