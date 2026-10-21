// Diagnóstico da IA Special (transformarSorriso): lê os erros recentes da função na
// nuvem e testa a chave do Gemini direto no Google. NÃO imprime e-mails nem a chave
// (o repositório é público): e-mails viram [e-mail], a chave nunca aparece.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const PROJETO = 'laboratorio-special';
const DIAS = Number(process.env.DIAS || 7);
const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/logging.read',
  aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
});
const assin = crypto.sign('RSA-SHA256', Buffer.from(semAssin), sa.private_key).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: semAssin + '.' + assin }),
})).json();
if (!tok.access_token) { console.error('ERRO: sem token', JSON.stringify(tok).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };
const limpa = (s) => String(s || '').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]').replace(/AIza[0-9A-Za-z_-]{20,}/g, '[chave]').replace(/\s+/g, ' ').slice(0, 420);

// ── 1) Logs da função na nuvem (últimos DIAS dias) ──
const desde = new Date(Date.now() - DIAS * 86400000).toISOString();
const filtro = `(resource.labels.service_name="transformarsorriso" OR resource.labels.function_name="transformarSorriso" OR labels."goog-managed-by"="cloudfunctions") AND timestamp>="${desde}" AND (severity>=WARNING OR textPayload:"transformarSorriso" OR jsonPayload.message:"transformarSorriso")`;
console.log(`── LOGS da função transformarSorriso (desde ${desde.slice(0, 16)}Z) ──`);
let pagina = '', total = 0, porSeveridade = {};
for (let i = 0; i < 3; i++) {
  const r = await fetch('https://logging.googleapis.com/v2/entries:list', { method: 'POST', headers: H, body: JSON.stringify({ resourceNames: [`projects/${PROJETO}`], filter: filtro, orderBy: 'timestamp desc', pageSize: 80, pageToken: pagina || undefined }) });
  const j = await r.json();
  if (j.error) { console.log('ERRO ao ler logs:', limpa(JSON.stringify(j.error))); break; }
  for (const e of j.entries || []) {
    total++;
    porSeveridade[e.severity] = (porSeveridade[e.severity] || 0) + 1;
    const msg = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.protoPayload && e.protoPayload.status && e.protoPayload.status.message) || '';
    const svc = (e.resource && e.resource.labels && (e.resource.labels.service_name || e.resource.labels.function_name)) || '?';
    if (total <= 60) console.log(`${(e.timestamp || '').slice(0, 19)} ${String(e.severity || '').padEnd(8)} ${svc} | ${limpa(msg)}`);
    // Sem mensagem legível? Mostra a entrada inteira (sem dado pessoal) pra entender o que foi
    if (total <= 12 && !msg) { const { timestamp, severity, textPayload, jsonPayload, protoPayload, httpRequest, labels } = e; console.log('      detalhe: ' + limpa(JSON.stringify({ timestamp, severity, textPayload, jsonPayload, protoPayload, httpRequest, labels })).slice(0, 420)); }
  }
  pagina = j.nextPageToken || '';
  if (!pagina) break;
}
console.log(`Entradas lidas: ${total} | por severidade: ${JSON.stringify(porSeveridade)}`);

// ── 2) A chave do Gemini funciona? Quais modelos existem? ──
const chave = (process.env.GEMINI_API_KEY || '').trim();
console.log('\n── CHAVE DO GEMINI ──');
if (!chave) console.log('Sem GEMINI_API_KEY no ambiente — pulei o teste direto.');
else {
  const lm = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + chave);
  const lj = await lm.json();
  if (lj.error) console.log('Listar modelos falhou:', lm.status, limpa(JSON.stringify(lj.error)));
  else {
    const nomes = (lj.models || []).map(m => m.name.replace('models/', ''));
    console.log(`Modelos visíveis: ${nomes.length}`);
    console.log('Com "image": ' + nomes.filter(n => /image/i.test(n)).join(', '));
    for (const m of ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image', 'gemini-flash-latest', 'gemini-2.5-flash']) console.log(`  ${m}: ${nomes.includes(m) ? 'existe' : 'NÃO EXISTE'}`);
  }
  // Teste real de geração de imagem (1 pixel de entrada, pede uma imagem de volta)
  const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  for (const modelo of ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image']) {
    const t0 = Date.now();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=` + chave, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Generate a tiny plain white square image.' }, { inlineData: { mimeType: 'image/png', data: pixel } }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
    });
    const j = await r.json().catch(() => ({}));
    const partes = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const temImg = partes.some(p => p.inlineData && p.inlineData.data);
    console.log(`  ${modelo}: HTTP ${r.status} em ${Date.now() - t0}ms | imagem: ${temImg ? 'SIM' : 'não'}${j.error ? ' | erro: ' + limpa(JSON.stringify(j.error)) : ''}${!temImg && !j.error ? ' | resposta: ' + limpa(JSON.stringify(j).slice(0, 300)) : ''}`);
  }
}
