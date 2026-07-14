import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;
const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const resp = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: cfg.tokens.refresh_token,
    grant_type: 'refresh_token',
  }),
});
const tok = await resp.json();
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

const acesso = await (await fetch(`${BASE}/labs/principal/kv/acesso`, { headers: H })).json();
console.log('LIBERADOS AGORA: ' + (acesso.fields.emails.arrayValue.values || []).map(v => v.stringValue).join(', '));

const q = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:query`, {
  method: 'POST', headers: H, body: JSON.stringify({ returnUserInfo: true }),
});
const qj = await q.json();
for (const u of qj.userInfo || []) {
  console.log('CONTA: ' + u.email + ' | ultimo login: ' + new Date(parseInt(u.lastLoginAt)).toLocaleString('pt-BR'));
}
