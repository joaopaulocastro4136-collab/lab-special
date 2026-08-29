// Repõe no banco os lançamentos de comissão que se perderam — direto no Firestore,
// para valer em QUALQUER aparelho na hora, inclusive em quem ainda tem o app antigo.
//
// Como decide o que faltou: varre os trabalhos e monta a comissão que DEVERIA existir,
// com a MESMA regra do app —
//   • modo por etapa: o valor configurado em tipo.etapas[].comissao vai para quem
//     concluiu a etapa (etapa pulada ou sem executor não paga);
//   • modo automático: a comissão do tipo é dividida entre quem executou, proporcional
//     às horas, e só quando o trabalho está finalizado DE VERDADE (todas as etapas).
// Nunca duplica (confere a trava por casoId + etapa + item) e respeita os lançamentos
// riscados de propósito pelo gestor (kv/comissoes-removidas).
//
// Rodar: por padrão só RELATA (não grava). Com APLICAR=1 grava — e antes disso guarda
// uma cópia de segurança do livro em kv/comissoes-backup-<data>.
import crypto from 'crypto';
import { readFileSync } from 'fs';

const PROJETO = 'laboratorio-special';
const LAB = process.env.LAB || 'principal';
const APLICAR = process.env.APLICAR === '1';
const TAM_CHUNK = 900000;

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

// ─── Conversão do formato do Firestore para objeto comum ───
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
function paraValor(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(paraValor) } };
  const fields = {};
  for (const k in x) fields[k] = paraValor(x[k]);
  return { mapValue: { fields } };
}

async function lerDoc(caminho) {
  const r = await fetch(`${BASE}/${caminho}`, { headers: H });
  if (r.status === 404) return null;
  const j = await r.json();
  if (j.error) { console.error('ERRO ao ler', caminho, JSON.stringify(j.error).slice(0, 200)); return null; }
  return deCampos(j.fields || {});
}
async function gravarDoc(caminho, obj) {
  const fields = {};
  for (const k in obj) fields[k] = paraValor(obj[k]);
  const r = await fetch(`${BASE}/${caminho}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
  if (r.status !== 200) { console.error('ERRO ao gravar', caminho, (await r.text()).slice(0, 300)); return false; }
  return true;
}
// KV do app: valor grande é quebrado em pedaços (chunks)
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
async function gravarKV(chave, valor) {
  const s = String(valor);
  if (s.length <= TAM_CHUNK) return gravarDoc(`labs/${LAB}/kv/${chave}`, { v: s });
  const n = Math.ceil(s.length / TAM_CHUNK);
  for (let i = 0; i < n; i++) {
    const ok = await gravarDoc(`labs/${LAB}/kv/${chave}__c${i}`, { v: s.slice(i * TAM_CHUNK, (i + 1) * TAM_CHUNK) });
    if (!ok) return false;
  }
  return gravarDoc(`labs/${LAB}/kv/${chave}`, { chunks: n });
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

// ─── As MESMAS regras do app ───
const etapasCompletas = (c) => !(c.etapas || []).length || (c.etapas || []).every(e => e.concluida || e.pulada);
const finalizadoCompleto = (c) => (c.status === 'Pronto' || c.status === 'Entregue') && etapasCompletas(c);
const comissaoConfigDaEtapa = (caso, etapa, tipos) => {
  const tipo = (tipos || []).find(t => t.nome === (etapa.item || caso.tipoTrabalho));
  const cfg = (tipo?.etapas || []).find(x => x.nome === etapa.nome);
  const v = Number(cfg?.comissao);
  return v > 0 ? v : null;
};
const temComissaoPorEtapa = (caso, tipos) => {
  const nomes = (caso.itens && caso.itens.length) ? caso.itens.map(i => i.nome) : [caso.tipoTrabalho];
  return nomes.some(n => ((tipos || []).find(t => t.nome === n)?.etapas || []).some(e => Number(e.comissao) > 0));
};
const hoje = new Date().toISOString().slice(0, 10);

// ─── Leitura ───
console.log(`Laboratório: ${LAB} | modo: ${APLICAR ? 'APLICAR (grava)' : 'só relatório'}\n`);
const cfgTexto = await lerKV('config-laboratorio');
const cfg = cfgTexto ? JSON.parse(cfgTexto) : {};
const tipos = cfg.tiposTrabalho || [];
const funcionarios = cfg.funcionarios || [];
const ledgerTexto = await lerKV('comissoes-registro');
const ledger = ledgerTexto ? JSON.parse(ledgerTexto) : [];
const riscadasTexto = await lerKV('comissoes-removidas');
const riscadas = new Set(riscadasTexto ? JSON.parse(riscadasTexto) : []);
const casos = await lerColecao(`labs/${LAB}/casos`);
console.log(`Trabalhos no banco: ${casos.length}`);
console.log(`Lançamentos no livro: ${ledger.length} (total ${ledger.reduce((s, c) => s + (Number(c.valor) || 0), 0).toFixed(2)})`);
console.log(`Riscados pelo gestor: ${riscadas.size}\n`);

// ─── O que deveria existir e não existe ───
const faltando = [];
for (const caso of casos) {
  if (temComissaoPorEtapa(caso, tipos)) {
    for (const e of (caso.etapas || [])) {
      if (!e.concluida || e.pulada || !e.funcionarioId) continue;
      const valor = comissaoConfigDaEtapa(caso, e, tipos);
      if (!(valor > 0)) continue;
      if (ledger.some(c => c.casoId === caso.id && c.etapa === e.nome && (c.item || null) === (e.item || null))) continue;
      const chave = `${caso.id}|${e.nome}|${e.item || ''}`;
      if (riscadas.has(chave)) continue;
      faltando.push({
        chave, casoId: caso.id, paciente: caso.paciente, tipoTrabalho: caso.tipoTrabalho,
        etapa: e.nome, item: e.item || null, valor, participacao: null,
        funcionarioId: e.funcionarioId, funcionario: e.funcionario || null,
        data: e.dataConclusao || caso.dataFinalizado || caso.dataSaida || hoje,
      });
    }
    continue;
  }
  if (!finalizadoCompleto(caso)) continue;
  if (ledger.some(c => c.casoId === caso.id)) continue;
  const nomes = (caso.itens && caso.itens.length) ? caso.itens.map(i => i.nome) : [caso.tipoTrabalho];
  const valorComissao = nomes.reduce((s, n) => s + (Number((tipos.find(t => t.nome === n) || {}).comissao) || 0), 0);
  if (!(valorComissao > 0)) continue;
  const participantes = {};
  let totalHoras = 0;
  for (const e of (caso.etapas || [])) {
    if (e.concluida && e.funcionarioId) {
      const peso = Number(e.horas) || 1;
      totalHoras += peso;
      if (!participantes[e.funcionarioId]) participantes[e.funcionarioId] = { nome: e.funcionario, horas: 0 };
      participantes[e.funcionarioId].horas += peso;
    }
  }
  const ids = Object.keys(participantes);
  const dataRef = caso.dataFinalizado || caso.dataSaida || hoje;
  if (!ids.length) {
    if (!caso.responsavelId || !funcionarios.some(f => f.id === caso.responsavelId)) continue;
    const chave = `${caso.id}|`;
    if (riscadas.has(chave)) continue;
    faltando.push({
      chave, casoId: caso.id, paciente: caso.paciente, tipoTrabalho: caso.tipoTrabalho,
      etapa: null, item: null, valor: valorComissao, participacao: 100,
      funcionarioId: caso.responsavelId,
      funcionario: caso.responsavel || (funcionarios.find(f => f.id === caso.responsavelId) || {}).nome || null,
      data: dataRef,
    });
    continue;
  }
  let acumulado = 0;
  ids.forEach((fid, idx) => {
    const fracao = participantes[fid].horas / totalHoras;
    const pct = Math.round(fracao * 100);
    const v = idx === ids.length - 1
      ? Math.round((valorComissao - acumulado) * 100) / 100
      : Math.round(valorComissao * fracao * 100) / 100;
    acumulado += v;
    const chave = `${caso.id}|${fid}`;
    if (riscadas.has(chave)) return;
    faltando.push({
      chave, casoId: caso.id, paciente: caso.paciente, tipoTrabalho: caso.tipoTrabalho,
      etapa: null, item: null, valor: v, participacao: pct,
      funcionarioId: fid, funcionario: participantes[fid].nome, data: dataRef,
    });
  });
}

// ─── Relatório ───
console.log('══════════════════════════════════════');
console.log(`COMISSÕES FALTANDO: ${faltando.length}`);
console.log('══════════════════════════════════════');
if (!faltando.length) { console.log('Nada a recuperar — o livro está batendo com os trabalhos ✓'); process.exit(0); }
const porPessoa = {};
const porMes = {};
for (const f of faltando) {
  const n = f.funcionario || 'sem nome';
  porPessoa[n] = (porPessoa[n] || 0) + f.valor;
  const m = String(f.data).slice(0, 7);
  porMes[m] = (porMes[m] || 0) + f.valor;
}
console.log('\nPor pessoa:');
for (const [n, v] of Object.entries(porPessoa).sort((a, b) => b[1] - a[1])) console.log(`  ${n}: R$ ${v.toFixed(2)}`);
console.log('\nPor mês:');
for (const [m, v] of Object.entries(porMes).sort()) console.log(`  ${m}: R$ ${v.toFixed(2)}`);
console.log(`\nTOTAL a recuperar: R$ ${faltando.reduce((s, f) => s + f.valor, 0).toFixed(2)}`);
console.log('\nDetalhe (até 60):');
faltando.slice(0, 60).forEach(f => {
  console.log(`  ${f.data} | ${(f.funcionario || '?').padEnd(16)} | R$ ${String(f.valor.toFixed(2)).padStart(8)} | ${f.paciente || '?'}${f.etapa ? ' • ' + f.etapa : ''}`);
});

if (!APLICAR) {
  console.log('\n(Modo relatório: NADA foi gravado. Para aplicar, rode com APLICAR=1.)');
  process.exit(0);
}

// ─── Aplicar: cópia de segurança e gravação ───
console.log('\nGuardando cópia de segurança do livro atual...');
const okBackup = await gravarKV(`comissoes-backup-${hoje.replace(/-/g, '')}`, JSON.stringify(ledger));
if (!okBackup) { console.error('ERRO: não consegui guardar a cópia — nada foi alterado.'); process.exit(1); }
console.log(`Cópia guardada em kv/comissoes-backup-${hoje.replace(/-/g, '')} ✓`);

const novos = faltando.map((f, i) => ({
  id: 'rec' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i,
  casoId: f.casoId, paciente: f.paciente, tipoTrabalho: f.tipoTrabalho,
  etapa: f.etapa, item: f.item, valor: f.valor, participacao: f.participacao,
  funcionarioId: f.funcionarioId, funcionario: f.funcionario, data: f.data, recuperado: hoje,
}));
const final = [...novos, ...ledger].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
const okGravar = await gravarKV('comissoes-registro', JSON.stringify(final));
if (!okGravar) { console.error('ERRO ao gravar o livro — a cópia de segurança está guardada.'); process.exit(1); }
console.log(`\n✓ LIVRO ATUALIZADO: ${ledger.length} → ${final.length} lançamentos`);
console.log(`✓ Total do livro agora: R$ ${final.reduce((s, c) => s + (Number(c.valor) || 0), 0).toFixed(2)}`);
console.log('\nJá vale em qualquer aparelho, inclusive nos que estão com o app antigo.');
