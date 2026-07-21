// Liga o provedor de login por E-MAIL/SENHA no Firebase Authentication.
// (O app mostrava "auth/operation-not-allowed" porque esse método estava desligado.)
// Usa a mesma autenticação por conta de serviço do diagnóstico do Apple.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit',
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

const PROJ = 'laboratorio-special';
const CFG = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJ}/config`;

// 1. Estado atual
const atual = await (await fetch(CFG, { headers: H })).json().catch(() => ({}));
const emailAntes = atual && atual.signIn && atual.signIn.email;
console.log('Antes:', JSON.stringify(emailAntes || {}));

// 2. Liga e-mail/senha (enabled=true, passwordRequired=true = senha, não só link)
const r = await fetch(`${CFG}?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, {
  method: 'PATCH', headers: H,
  body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
});
const rj = await r.json().catch(() => ({}));
if (r.status >= 300) { console.error(`ERRO ao ligar (${r.status}):`, JSON.stringify(rj).slice(0, 400)); process.exit(1); }
console.log('Depois:', JSON.stringify(rj.signIn && rj.signIn.email || {}));
console.log('\n✓ LOGIN POR E-MAIL/SENHA LIGADO no Firebase Authentication.');
