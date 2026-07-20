// Libera UM dentista no Special Clinic pelo e-mail (ex.: o e-mail do ID Apple).
// Entra na configuração oficial do laboratório (senão a sincronização do Lab
// apagaria o acesso avulso) e cria os documentos de acesso na hora.
//   DENTISTA_EMAIL  e-mail a liberar (obrigatório)
//   DENTISTA_NOME   nome do dentista (opcional): se já existir um dentista com
//                   esse nome, o e-mail é ligado a ele (mesmos trabalhos);
//                   sem nome, usa o primeiro dentista que ainda não tem e-mail
//   LAB_ID          laboratório (padrão: principal)
import crypto from 'crypto';
import { readFileSync } from 'fs';

const EMAIL = String(process.env.DENTISTA_EMAIL || '').trim().toLowerCase();
const NOME = String(process.env.DENTISTA_NOME || '').trim();
const LAB = String(process.env.LAB_ID || 'principal').trim();
if (!EMAIL || !EMAIL.includes('@')) { console.error('ERRO: informe DENTISTA_EMAIL válido'); process.exit(1); }

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

const BASE = 'https://firestore.googleapis.com/v1/projects/laboratorio-special/databases/(default)/documents';

// 1. Configuração oficial do laboratório
const docCfg = await (await fetch(`${BASE}/labs/${LAB}/kv/config-laboratorio`, { headers: H })).json();
if (!docCfg.fields) { console.error('ERRO: config-laboratorio não encontrada no lab ' + LAB); process.exit(1); }
const config = JSON.parse(docCfg.fields.v.stringValue);
config.dentistas = config.dentistas || [];

let dentista = config.dentistas.find(d => (d.email || '').toLowerCase() === EMAIL);
if (dentista) {
  console.log(`E-mail já cadastrado no dentista "${dentista.nome}" ✓`);
} else {
  // Liga ao dentista de mesmo nome (ou ao primeiro sem e-mail), senão cria um novo
  dentista = (NOME && config.dentistas.find(d => d.nome === NOME && !d.email))
    || (!NOME && config.dentistas.find(d => !d.email))
    || null;
  if (dentista) {
    dentista.email = EMAIL;
    console.log(`E-mail ligado ao dentista existente "${dentista.nome}" ✓`);
  } else {
    dentista = { nome: NOME || 'Dentista ' + EMAIL.split('@')[0], endereco: '', telefone: '', email: EMAIL };
    config.dentistas.push(dentista);
    console.log(`Dentista novo criado: "${dentista.nome}" ✓`);
  }
  const up = await fetch(`${BASE}/labs/${LAB}/kv/config-laboratorio?updateMask.fieldPaths=v`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { v: { stringValue: JSON.stringify(config) } } }),
  });
  if (up.status !== 200) { console.error('ERRO ao gravar a config (' + up.status + ')'); process.exit(1); }
  console.log('Configuração do laboratório atualizada ✓');
}

// 2. Documento de acesso (vale na hora, sem esperar a sincronização do app)
const s = (v) => ({ stringValue: v });
const acesso = await fetch(`${BASE}/labs/${LAB}/dentistasAcesso/${encodeURIComponent(EMAIL)}?updateMask.fieldPaths=nome`, {
  method: 'PATCH', headers: H, body: JSON.stringify({ fields: { nome: s(dentista.nome) } }),
});
console.log(`dentistasAcesso/${EMAIL}: ${acesso.status === 200 ? 'ok ✓' : 'falha (' + acesso.status + ')'}`);
if (acesso.status !== 200) process.exit(1);

// 3. Índice global dentista → laboratório (o Clinic usa p/ achar o lab certo)
const idx = await fetch(`${BASE}/dentistasIndex/${encodeURIComponent(EMAIL)}?updateMask.fieldPaths=lab&updateMask.fieldPaths=nome`, {
  method: 'PATCH', headers: H, body: JSON.stringify({ fields: { lab: s(LAB), nome: s(dentista.nome) } }),
});
console.log(`dentistasIndex/${EMAIL}: ${idx.status === 200 ? 'ok ✓' : 'falha (' + idx.status + ')'}`);

console.log(`\nPRONTO: ${EMAIL} liberado como "${dentista.nome}" no laboratório ${LAB} ✓`);
