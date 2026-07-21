// Registra a impressão digital (SHA-1 e SHA-256) da chave de assinatura do APK
// no app Android do Firebase. Sem isso, o "Entrar com Google" no Android falha
// com erro "developer error" (código 10) e o app mostra "verifique a internet".
// Usa a mesma autenticação por conta de serviço dos outros scripts.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
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

const PROJ = process.env.FB_PROJECT || 'laboratorio-special';
const APP = process.env.ANDROID_APP_ID || '1:138572658603:android:2e67e96ddd574704a804ee';
const limpa = (s) => String(s || '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
const SHA1 = limpa(process.env.SHA1_APP);
const SHA256 = limpa(process.env.SHA256_APP);

const alvos = [];
if (SHA1.length === 40) alvos.push({ shaHash: SHA1, certType: 'SHA_1' });
else console.warn('SHA-1 ausente ou inválida:', process.env.SHA1_APP);
if (SHA256.length === 64) alvos.push({ shaHash: SHA256, certType: 'SHA_256' });
else console.warn('SHA-256 ausente ou inválida:', process.env.SHA256_APP);
if (alvos.length === 0) { console.error('Nenhuma SHA válida pra registrar.'); process.exit(1); }

const BASE = `https://firebase.googleapis.com/v1beta1/projects/${PROJ}/androidApps/${APP}/sha`;

// 1. O que já está registrado
const lista = await (await fetch(BASE, { headers: H })).json().catch(() => ({}));
const jaTem = new Set((lista.certificates || []).map(c => limpa(c.shaHash)));
console.log('Já registradas:', [...jaTem].join(', ') || '(nenhuma)');

// 2. Registra as que faltam
let novas = 0;
for (const alvo of alvos) {
  if (jaTem.has(alvo.shaHash)) { console.log(`✓ ${alvo.certType} já estava registrada.`); continue; }
  const r = await fetch(BASE, { method: 'POST', headers: H, body: JSON.stringify(alvo) });
  const rj = await r.json().catch(() => ({}));
  if (r.status >= 300) { console.error(`ERRO ao registrar ${alvo.certType} (${r.status}):`, JSON.stringify(rj).slice(0, 400)); process.exit(1); }
  console.log(`✓ ${alvo.certType} registrada: ${alvo.shaHash}`);
  novas++;
}
console.log(novas > 0
  ? `\n✓ ${novas} impressão(ões) digital(is) registrada(s). O "Entrar com Google" no Android já volta a funcionar (inclusive no app já instalado).`
  : '\n✓ Tudo já estava registrado — nada a fazer.');
