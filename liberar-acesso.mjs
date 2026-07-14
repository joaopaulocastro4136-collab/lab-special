import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const NOVOS = [
  { email: 'empiredigital912@gmail.com' },
  { email: 'motogmoto22mg@gmail.com' },
];
const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;

// Token da CLI do Firebase (já autorizada pelo João)
const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const refresh = cfg.tokens && cfg.tokens.refresh_token;
if (!refresh) { console.log('ERRO: sem refresh token'); process.exit(1); }

const resp = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refresh,
    grant_type: 'refresh_token',
  }),
});
const tok = await resp.json();
if (!tok.access_token) { console.log('ERRO token: ' + JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

// Nomes reais das contas (registro de login do Google)
let nomes = {};
try {
  const lk = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:lookup`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ email: NOVOS.map(n => n.email) }),
  });
  const lkj = await lk.json();
  for (const u of lkj.users || []) if (u.email && u.displayName) nomes[u.email] = u.displayName;
} catch (e) { /* usa apelido do e-mail */ }

// 1) Atualiza a equipe no config-laboratorio
const doc = await (await fetch(`${BASE}/labs/principal/kv/config-laboratorio`, { headers: H })).json();
const config = JSON.parse(doc.fields.v.stringValue);
config.funcionarios = config.funcionarios || [];
let mudou = false;
for (const n of NOVOS) {
  if (!config.funcionarios.some(f => f.email === n.email)) {
    const nome = nomes[n.email] || n.email.split('@')[0];
    config.funcionarios.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4), nome, email: n.email, pin: null, gestor: false });
    mudou = true;
    console.log('adicionado à equipe: ' + nome + ' <' + n.email + '>');
  }
}
if (mudou) {
  const up = await fetch(`${BASE}/labs/principal/kv/config-laboratorio?updateMask.fieldPaths=v`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { v: { stringValue: JSON.stringify(config) } } }),
  });
  console.log('config atualizada: ' + up.status);
}

// 2) Atualiza a lista de liberados (acesso imediato)
const emails = [ 'joaopaulocastro41@gmail.com', ...config.funcionarios.filter(f => f.email).map(f => f.email) ];
const unicos = [...new Set(emails)];
const up2 = await fetch(`${BASE}/labs/principal/kv/acesso?updateMask.fieldPaths=emails`, {
  method: 'PATCH', headers: H,
  body: JSON.stringify({ fields: { emails: { arrayValue: { values: unicos.map(e => ({ stringValue: e })) } } } }),
});
console.log('acesso atualizado (' + up2.status + '): ' + unicos.join(', '));
