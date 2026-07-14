import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

const enc = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const fields = {}; for (const k in v) fields[k] = enc(v[k]);
  return { mapValue: { fields } };
};

// Config atual
const docCfg = await (await fetch(`${BASE}/labs/principal/kv/config-laboratorio`, { headers: H })).json();
const config = JSON.parse(docCfg.fields.v.stringValue);

// 1) publicoClinica/info completo (tipos com etapas/prazos/valores + dias de trabalho)
const info = {
  tipos: (config.tiposTrabalho || []).map(t => ({
    nome: t.nome, prazoDias: t.prazoDias ?? 5, valor: t.valor ?? 0,
    etapas: (t.etapas || []).map(e => ({ nome: e.nome, horas: e.horas || 1, prova: !!e.prova })),
  })),
  diasTrabalho: config.diasTrabalho || [1, 2, 3, 4, 5, 6],
};
const up1 = await fetch(`${BASE}/labs/principal/publicoClinica/info`, {
  method: 'PATCH', headers: H, body: JSON.stringify({ fields: { tipos: enc(info.tipos), diasTrabalho: enc(info.diasTrabalho) } }),
});
console.log('publicoClinica/info completo: ' + up1.status);

// 2) dentistasAcesso com prazoPagamento
for (const d of config.dentistas || []) {
  if (!d.email) continue;
  const email = d.email.toLowerCase();
  const up = await fetch(`${BASE}/labs/principal/dentistasAcesso/${encodeURIComponent(email)}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { nome: enc(d.nome), prazoPagamento: enc(d.prazoPagamento || null) } }),
  });
  console.log(`dentistasAcesso ${email}: ${up.status}`);
}

// 3) financeiroClinica a partir dos pagamentos existentes
let pagamentos = [];
try {
  const docPg = await (await fetch(`${BASE}/labs/principal/kv/pagamentos-registro`, { headers: H })).json();
  if (docPg.fields && docPg.fields.v) pagamentos = JSON.parse(docPg.fields.v.stringValue);
} catch (e) { /* sem pagamentos */ }
const totais = {};
for (const p of pagamentos) totais[p.dentista] = (totais[p.dentista] || 0) + (p.valor || 0);
for (const d of config.dentistas || []) if (!(d.nome in totais)) totais[d.nome] = 0;
for (const nome in totais) {
  const idSeguro = nome.replace(/\//g, '-');
  const up = await fetch(`${BASE}/labs/principal/financeiroClinica/${encodeURIComponent(idSeguro)}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ fields: { nome: enc(nome), totalPago: enc(Math.round(totais[nome] * 100) / 100) } }),
  });
  console.log(`financeiroClinica ${nome}: R$ ${totais[nome].toFixed(2)} (${up.status})`);
}
console.log('backfill concluido');
