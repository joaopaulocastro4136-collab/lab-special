import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const cfgStore = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const resp = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: cfgStore.tokens.refresh_token,
    grant_type: 'refresh_token',
  }),
});
const tok = await resp.json();
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

const url = 'https://identitytoolkit.googleapis.com/admin/v2/projects/laboratorio-special/config';
const atual = await (await fetch(url, { headers: H })).json();
const dominios = new Set(atual.authorizedDomains || []);
dominios.add('special-clinic.web.app');
dominios.add('special-clinic.firebaseapp.com');
const up = await fetch(url + '?updateMask=authorizedDomains', {
  method: 'PATCH', headers: H,
  body: JSON.stringify({ authorizedDomains: [...dominios] }),
});
const r = await up.json();
console.log('dominios autorizados: ' + (r.authorizedDomains || []).join(', '));
