// Exporta os dados do laboratório (trabalhos, configuração, pagamentos e comissões)
// num arquivo JSON pra montar relatórios FORA do app (ex.: PDF de um cliente).
// O repositório é público: o log mostra SÓ contagens — nomes e valores vão apenas
// pro arquivo de saída, que o robô guarda como artefato privado por 1 dia.
import crypto from 'crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';

const PROJETO = 'laboratorio-special';
const LAB = process.env.LAB || 'principal';
const SAIDA = process.env.SAIDA || 'saida-dados';

const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const semAssin = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
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
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents`;

function deValor(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
  return null;
}
function deCampos(fields) {
  const o = {};
  for (const k in fields) o[k] = deValor(fields[k]);
  return o;
}
async function lerDoc(caminho) {
  const r = await fetch(`${BASE}/${caminho}`, { headers: H });
  if (r.status === 404) return null;
  const j = await r.json();
  if (j.error) { console.error('ERRO ao ler', caminho, JSON.stringify(j.error).slice(0, 200)); return null; }
  return deCampos(j.fields || {});
}
async function lerKV(chave) {
  const d = await lerDoc(`labs/${LAB}/kv/${chave}`);
  if (!d) return null;
  if (d.chunks) {
    const partes = [];
    for (let i = 0; i < Number(d.chunks); i++) {
      const p = await lerDoc(`labs/${LAB}/kv/${chave}__c${i}`);
      partes.push((p && p.v) || '');
    }
    return partes.join('');
  }
  return d.v ?? null;
}
async function lerColecao(caminho) {
  const itens = [];
  let token = '';
  do {
    const url = `${BASE}/${caminho}?pageSize=300${token ? `&pageToken=${token}` : ''}`;
    const r = await fetch(url, { headers: H });
    const j = await r.json();
    if (j.error) { console.error('ERRO ao listar', caminho, JSON.stringify(j.error).slice(0, 200)); break; }
    (j.documents || []).forEach(d => itens.push({ __id: d.name.split('/').pop(), ...deCampos(d.fields || {}) }));
    token = j.nextPageToken || '';
  } while (token);
  return itens;
}
const json = (s, padrao) => { try { return s ? JSON.parse(s) : padrao; } catch (e) { return padrao; } };

// Trabalhos: um documento por caso. Documento repetido do mesmo caso (migração
// antiga) → vale o canônico (nome do documento == id), igual ao app.
const brutos = await lerColecao(`labs/${LAB}/casos`);
const porId = new Map();
for (const d of brutos) {
  const { __id, ...resto } = d;
  const c = resto.id ? resto : { ...resto, id: __id };
  if (!porId.has(c.id) || __id === c.id) porId.set(c.id, c);
}
const casos = [...porId.values()];
const config = json(await lerKV('config-laboratorio'), {});
const pagamentos = json(await lerKV('pagamentos-registro'), []);
const comissoes = await lerColecao(`labs/${LAB}/comissoes`);

const etapasCompletas = (c) => !(c.etapas || []).length || (c.etapas || []).every(e => e.concluida || e.pulada);
const finalizados = casos.filter(c => (c.status === 'Pronto' || c.status === 'Entregue') && etapasCompletas(c)).length;
console.log(`Trabalhos: ${casos.length} (finalizados: ${finalizados}) | clientes no cadastro: ${(config.dentistas || []).length} | baixas: ${pagamentos.length} | comissões: ${comissoes.length}`);

mkdirSync(SAIDA, { recursive: true });
writeFileSync(`${SAIDA}/dados.json`, JSON.stringify({
  geradoEm: new Date().toISOString(), lab: LAB, nomeLab: config.nomeLab || '',
  dentistas: config.dentistas || [], tiposTrabalho: config.tiposTrabalho || [],
  casos, pagamentos, comissoes,
}));
console.log(`Arquivo gravado em ${SAIDA}/dados.json ✓`);
