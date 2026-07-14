import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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
const H = { Authorization: 'Bearer ' + tok.access_token };

const rel = await (await fetch('https://firebaserules.googleapis.com/v1/projects/laboratorio-special/releases', { headers: H })).json();
for (const r of rel.releases || []) {
  console.log('RELEASE: ' + r.name + ' | ruleset: ' + r.rulesetName + ' | atualizado: ' + r.updateTime);
}
const fsRelease = (rel.releases || []).find(r => r.name.includes('cloud.firestore'));
if (fsRelease) {
  const rs = await (await fetch('https://firebaserules.googleapis.com/v1/' + fsRelease.rulesetName, { headers: H })).json();
  console.log('=== REGRAS ATIVAS ===');
  console.log(rs.source.files.map(f => f.content).join('\n'));
}
