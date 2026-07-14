import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const EMAIL_TESTE = 'joaopaulocastro41@gmail.com';
const PROJETO = 'laboratorio-special';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;

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

// Lê a configuração atual
const docCfg = await (await fetch(`${BASE}/labs/principal/kv/config-laboratorio`, { headers: H })).json();
const config = JSON.parse(docCfg.fields.v.stringValue);
config.dentistas = config.dentistas || [];
console.log('DENTISTAS NO BANCO: ' + JSON.stringify(config.dentistas.map(d => ({ nome: d.nome, email: d.email || null }))));

// Garante um dentista de teste com o e-mail do João, se nenhum dentista tiver esse e-mail
let mudouConfig = false;
if (!config.dentistas.some(d => (d.email || '').toLowerCase() === EMAIL_TESTE)) {
  const existente = config.dentistas.find(d => !d.email);
  if (existente) {
    existente.email = EMAIL_TESTE;
    console.log('e-mail de teste adicionado ao dentista existente: ' + existente.nome);
  } else {
    config.dentistas.push({ nome: 'Dr. João Paulo (teste)', endereco: 'Petrolina-PE', telefone: '', email: EMAIL_TESTE });
    console.log('dentista de teste criado: Dr. João Paulo (teste)');
  }
  mudouConfig = true;
}
if (mudouConfig) {
  const up = await fetch(`${BASE}/labs/principal/kv/config-laboratorio?updateMask.fieldPaths=v`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { v: { stringValue: JSON.stringify(config) } } }),
  });
  console.log('config atualizada: ' + up.status);
}

// Cria os documentos de liberação (dentistasAcesso/{email}) para TODOS os dentistas com e-mail
for (const d of config.dentistas) {
  if (!d.email) continue;
  const email = d.email.toLowerCase();
  const up = await fetch(`${BASE}/labs/principal/dentistasAcesso/${encodeURIComponent(email)}?updateMask.fieldPaths=nome`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { nome: { stringValue: d.nome } } }),
  });
  console.log(`liberado: ${d.nome} <${email}> (${up.status})`);
}

// Publica os tipos de trabalho para o formulário de pedido da clínica
const tipos = (config.tiposTrabalho || []).map(t => t.nome);
const upInfo = await fetch(`${BASE}/labs/principal/publicoClinica/info?updateMask.fieldPaths=tipos`, {
  method: 'PATCH', headers: H,
  body: JSON.stringify({ fields: { tipos: { arrayValue: { values: tipos.map(t => ({ stringValue: t })) } } } }),
});
console.log('tipos publicados p/ clinica (' + upInfo.status + '): ' + tipos.join(', '));
