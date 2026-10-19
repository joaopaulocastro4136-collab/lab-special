// Relatório em PDF dos trabalhos de UM cliente (dentista/clínica), montado FORA do app
// a partir do JSON exportado pelo robô "exportar-dados" (artefato privado).
//   node relatorio-cliente.mjs --dados caminho/dados.json --cliente "Singular" --saida relatorio.pdf [--png previa.png]
// Mesmas regras do app: finalizado = Pronto/Entregue com todas as etapas resolvidas;
// valor pago marcado no trabalho vira coluna "Pago"/"Resta". Nada é inventado: trabalho
// sem valor lançado aparece como "sem valor" e é contado à parte.
import { readFileSync, writeFileSync } from 'fs';
import { chromium } from 'playwright-core';

const arg = (n, padrao) => { const i = process.argv.indexOf('--' + n); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao; };
const DADOS = arg('dados'); const CLIENTE = arg('cliente'); const SAIDA = arg('saida', 'relatorio.pdf'); const PNG = arg('png'); const HTML_OUT = arg('html');
if (!DADOS || !CLIENTE) { console.error('uso: --dados dados.json --cliente "Nome" --saida arquivo.pdf'); process.exit(1); }

const INK = '#1C1B19', GOLD = '#B8935A', GOLD_SOFT = '#F3EBDA';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const formatReais = (v) => { const [i, c] = Math.abs(Number(v) || 0).toFixed(2).split('.'); return `${(Number(v) || 0) < 0 ? '-' : ''}R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${c}`; };
const formatDateBR = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const dados = JSON.parse(readFileSync(DADOS, 'utf8'));
const alvo = norm(CLIENTE);
const casos = (dados.casos || []).filter(c => norm(c.dentista).includes(alvo));
const cadastro = (dados.dentistas || []).filter(d => norm(d.nome).includes(alvo));
const dentista = cadastro.find(d => d.endereco) || cadastro[0] || { nome: casos[0]?.dentista || CLIENTE };
const nomeCliente = dentista.nome || casos[0]?.dentista || CLIENTE;

// ── Mesmas regras do app ──
const etapasCompletas = (c) => !(c.etapas || []).length || (c.etapas || []).every(e => e.concluida || e.pulada);
const finalizadoCompleto = (c) => (c.status === 'Pronto' || c.status === 'Entregue') && etapasCompletas(c);
const valorDe = (c) => Number(c.valor) || 0;
const temValor = (c) => valorDe(c) > 0;
const pagoDe = (c) => Math.min(Math.max(Number(c.valorPago) || 0, 0), valorDe(c));
const unidades = (c) => (c.itens && c.itens.length) ? c.itens.reduce((s, i) => s + (Number(i.quantidade) || 1), 0) : (Number(c.quantidade) || 1);
const nomeTrab = (c) => (c.itens && c.itens.length)
  ? c.itens.map(it => `${(Number(it.quantidade) || 1) > 1 ? it.quantidade + '× ' : ''}${it.nome}`).join(', ')
  : c.tipoTrabalho;
const situacao = (c) => {
  if (c.status === 'Entregue') return 'Entregue';
  if (c.status === 'Pronto') return 'Finalizado';
  if (c.naClinica) return 'Na clínica';
  if (c.provaPendente) return 'Para entrega';
  return c.status || 'Em produção';
};
const dataFim = (c) => c.dataSaida || c.dataFinalizado || '';
const etapasTxt = (c) => { const et = c.etapas || []; if (!et.length) return '—'; const f = et.filter(e => e.concluida || e.pulada).length; return `${f}/${et.length}`; };

const fin = casos.filter(finalizadoCompleto).sort((a, b) => (dataFim(a) || '').localeCompare(dataFim(b) || '') || (a.dataEntrada || '').localeCompare(b.dataEntrada || ''));
const prod = casos.filter(c => !finalizadoCompleto(c)).sort((a, b) => (a.prazo || '').localeCompare(b.prazo || '') || (a.dataEntrada || '').localeCompare(b.dataEntrada || ''));
const soma = (l, f) => Math.round(l.reduce((s, c) => s + f(c), 0) * 100) / 100;
const R = {
  cliente: nomeCliente, total: casos.length,
  fin: { n: fin.length, unidades: fin.reduce((s, c) => s + unidades(c), 0), valor: soma(fin, valorDe), pago: soma(fin, pagoDe), semValor: fin.filter(c => !temValor(c)).length },
  prod: { n: prod.length, unidades: prod.reduce((s, c) => s + unidades(c), 0), valor: soma(prod, valorDe), pago: soma(prod, pagoDe), semValor: prod.filter(c => !temValor(c)).length },
};
R.geral = { valor: Math.round((R.fin.valor + R.prod.valor) * 100) / 100, pago: Math.round((R.fin.pago + R.prod.pago) * 100) / 100, semValor: R.fin.semValor + R.prod.semValor };
R.geral.resta = Math.round((R.geral.valor - R.geral.pago) * 100) / 100;
const temPago = R.geral.pago > 0;
const porTipo = {};
casos.forEach(c => { const chave = nomeTrab(c).replace(/^\d+× /, ''); const k = (c.itens && c.itens.length) ? c.itens.map(i => i.nome).join(' + ') : c.tipoTrabalho; porTipo[k] = porTipo[k] || { n: 0, unidades: 0, fin: 0 }; porTipo[k].n++; porTipo[k].unidades += unidades(c); if (finalizadoCompleto(c)) porTipo[k].fin++; void chave; });
const porMaterial = {};
casos.forEach(c => { const m = c.material || 'não informado'; porMaterial[m] = (porMaterial[m] || 0) + 1; });

const linhaFin = (c, i) => `<tr>
  <td class="n">${i + 1}</td>
  <td class="pac">${esc(c.paciente)}</td>
  <td class="trab">${esc(nomeTrab(c))}${c.material ? `<span class="mat">${esc(c.material)}</span>` : ''}</td>
  <td class="c">${formatDateBR(c.dataEntrada) || '—'}</td>
  <td class="c">${formatDateBR(dataFim(c)) || '—'}</td>
  <td class="c sit ${c.status === 'Entregue' ? 'ok' : ''}">${esc(situacao(c))}</td>
  <td class="r val ${temValor(c) ? '' : 'sem'}">${temValor(c) ? formatReais(valorDe(c)) : 'sem valor'}</td>
  ${temPago ? `<td class="r pago">${pagoDe(c) > 0 ? formatReais(pagoDe(c)) : '—'}</td><td class="r val">${temValor(c) ? (valorDe(c) - pagoDe(c) > 0 ? formatReais(valorDe(c) - pagoDe(c)) : 'pago ✓') : '—'}</td>` : ''}
</tr>`;
const linhaProd = (c, i) => `<tr>
  <td class="n">${i + 1}</td>
  <td class="pac">${esc(c.paciente)}</td>
  <td class="trab">${esc(nomeTrab(c))}${c.material ? `<span class="mat">${esc(c.material)}</span>` : ''}</td>
  <td class="c">${formatDateBR(c.dataEntrada) || '—'}</td>
  <td class="c">${formatDateBR(c.prazo) || '—'}</td>
  <td class="c sit">${esc(situacao(c))}</td>
  <td class="c">${etapasTxt(c)}</td>
  <td class="r val ${temValor(c) ? '' : 'sem'}">${temValor(c) ? formatReais(valorDe(c)) : 'sem valor'}</td>
</tr>`;

const contato = [dentista.endereco, dentista.telefone, dentista.email].filter(Boolean).map(esc).join(' &nbsp;•&nbsp; ');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${esc(nomeCliente)}</title>
<style>
  @page { size: A4; margin: 14mm 13mm 18mm 13mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif; color: ${INK}; margin: 0; font-size: 10.5pt; }
  .marca { color: ${GOLD}; font-weight: 700; letter-spacing: .35em; font-size: 9pt; text-transform: uppercase; }
  h1 { margin: 2px 0 0; font-size: 26pt; letter-spacing: .02em; font-weight: 800; }
  .titulo { color: #78716C; font-size: 13pt; font-weight: 600; margin-top: 4px; }
  .regua { height: 3px; background: ${INK}; margin: 10px 0 12px; }
  .cliente { background: #F8F6F1; border: 1px solid #E7E5E4; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; }
  .cliente .nome { font-size: 16pt; font-weight: 800; }
  .cliente .contato { color: #57534E; font-size: 9.5pt; margin-top: 3px; }
  .cliente .meta { color: #A8A29E; font-size: 9pt; margin-top: 4px; }
  .cards { display: flex; gap: 8px; margin-bottom: 12px; }
  .card { flex: 1; border: 1px solid #E7E5E4; border-radius: 8px; padding: 8px 10px; }
  .card .rot { font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: #7A6234; font-weight: 700; }
  .card .num { font-size: 15pt; font-weight: 800; margin-top: 2px; }
  .card .sub { font-size: 8.5pt; color: #78716C; margin-top: 1px; }
  .card.destaque { background: ${GOLD_SOFT}; border-color: #E8D9B8; }
  h2 { font-size: 11pt; letter-spacing: .14em; text-transform: uppercase; color: #7A6234; margin: 14px 0 6px; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: ${GOLD_SOFT}; color: #7A6234; font-size: 7.5pt; letter-spacing: .08em; text-transform: uppercase; text-align: left; padding: 6px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #EEECE7; vertical-align: top; font-size: 9.5pt; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #FCFBF8; }
  td.n, th.n { color: #A8A29E; width: 22px; text-align: center; }
  td.pac { font-weight: 700; }
  td.trab { color: #57534E; }
  .mat { display: block; color: #A8A29E; font-size: 8pt; }
  td.c, th.c { text-align: center; white-space: nowrap; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  td.sit { color: #78716C; font-weight: 600; font-size: 8.5pt; }
  td.sit.ok { color: #166B3A; }
  td.val { font-weight: 700; }
  td.val.sem { color: #B45309; font-weight: 600; font-size: 8.5pt; }
  td.pago { color: #166B3A; font-weight: 600; }
  .subtotal td { background: #F8F6F1 !important; font-weight: 800; border-top: 2px solid ${INK}; }
  .totais { margin-top: 16px; border-top: 3px solid ${INK}; padding-top: 8px; page-break-inside: avoid; }
  .totais .linha { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; }
  .totais .rot { color: #78716C; font-weight: 700; letter-spacing: .12em; font-size: 9pt; text-transform: uppercase; }
  .totais .num { font-weight: 800; font-size: 14pt; }
  .totais .final { background: ${GOLD_SOFT}; border-radius: 8px; padding: 8px 12px; margin-top: 6px; }
  .totais .final .rot { color: #7A6234; }
  .totais .final .num { font-size: 19pt; }
  .aviso { color: #B45309; font-size: 9pt; margin-top: 8px; }
  .resumo { display: flex; gap: 14px; margin-top: 8px; font-size: 9pt; color: #57534E; }
  .resumo b { color: ${INK}; }
  .assin { display: flex; gap: 40px; margin-top: 36px; page-break-inside: avoid; }
  .assin div { flex: 1; border-top: 1px solid #A8A29E; padding-top: 5px; color: #78716C; font-size: 8.5pt; text-align: center; }
</style></head><body>
<div class="marca">${esc(dados.nomeLab || 'Laboratório')}</div>
<h1>SPECIAL</h1>
<div class="titulo">Relatório de Trabalhos — ${esc(nomeCliente)}</div>
<div class="regua"></div>
<div class="cliente">
  <div class="nome">${esc(nomeCliente)}</div>
  ${contato ? `<div class="contato">${contato}</div>` : ''}
  <div class="meta">${casos.length} ${casos.length === 1 ? 'trabalho' : 'trabalhos'} no total • ${R.fin.n} finalizados • ${R.prod.n} em produção • emitido em ${formatDateBR(hojeISO())}</div>
</div>
<div class="cards">
  <div class="card"><div class="rot">Finalizados</div><div class="num">${R.fin.n} ${R.fin.n === 1 ? 'trabalho' : 'trabalhos'}</div><div class="sub">${R.fin.unidades} ${R.fin.unidades === 1 ? 'unidade' : 'unidades'} • ${formatReais(R.fin.valor)}</div></div>
  <div class="card"><div class="rot">Em produção</div><div class="num">${R.prod.n} ${R.prod.n === 1 ? 'trabalho' : 'trabalhos'}</div><div class="sub">${R.prod.unidades} ${R.prod.unidades === 1 ? 'unidade' : 'unidades'} • ${formatReais(R.prod.valor)}</div></div>
  <div class="card destaque"><div class="rot">Valor lançado (todos)</div><div class="num">${formatReais(R.geral.valor)}</div><div class="sub">${R.geral.semValor ? `${R.geral.semValor} ${R.geral.semValor === 1 ? 'trabalho sem valor lançado' : 'trabalhos sem valor lançado'}` : 'todos os trabalhos com valor'}</div></div>
</div>
<div class="resumo">
  <span>Por tipo: ${Object.entries(porTipo).map(([k, v]) => `<b>${esc(k)}</b> ${v.n} (${v.unidades} un.)`).join(' • ')}</span>
  <span>Material: ${Object.entries(porMaterial).map(([k, v]) => `<b>${esc(k)}</b> ${v}`).join(' • ')}</span>
</div>

<h2>Trabalhos finalizados (${R.fin.n})</h2>
${R.fin.n ? `<table><thead><tr><th class="n">#</th><th>Paciente</th><th>Trabalho</th><th class="c">Entrada</th><th class="c">Entrega</th><th class="c">Situação</th><th class="r">Valor</th>${temPago ? '<th class="r">Pago</th><th class="r">Resta</th>' : ''}</tr></thead>
<tbody>${fin.map(linhaFin).join('')}
<tr class="subtotal"><td></td><td colspan="5">Subtotal finalizados${R.fin.semValor ? ` (${R.fin.semValor} sem valor)` : ''}</td><td class="r">${formatReais(R.fin.valor)}</td>${temPago ? `<td class="r">${formatReais(R.fin.pago)}</td><td class="r">${formatReais(R.fin.valor - R.fin.pago)}</td>` : ''}</tr></tbody></table>` : '<div class="aviso">Nenhum trabalho finalizado.</div>'}

<h2>Trabalhos em produção (${R.prod.n})</h2>
${R.prod.n ? `<table><thead><tr><th class="n">#</th><th>Paciente</th><th>Trabalho</th><th class="c">Entrada</th><th class="c">Prazo</th><th class="c">Situação</th><th class="c">Etapas</th><th class="r">Valor</th></tr></thead>
<tbody>${prod.map(linhaProd).join('')}
<tr class="subtotal"><td></td><td colspan="6">Subtotal em produção${R.prod.semValor ? ` (${R.prod.semValor} sem valor)` : ''}</td><td class="r">${formatReais(R.prod.valor)}</td></tr></tbody></table>` : '<div class="aviso">Nenhum trabalho em produção.</div>'}

<div class="totais">
  <div class="linha"><span class="rot">Total finalizado</span><span class="num">${formatReais(R.fin.valor)}</span></div>
  <div class="linha"><span class="rot">Total em produção</span><span class="num">${formatReais(R.prod.valor)}</span></div>
  ${temPago ? `<div class="linha"><span class="rot">Já pago</span><span class="num" style="color:#166B3A">− ${formatReais(R.geral.pago)}</span></div>` : ''}
  <div class="linha final"><span class="rot">${temPago ? 'Resta a pagar' : 'Total dos trabalhos'}</span><span class="num">${formatReais(temPago ? R.geral.resta : R.geral.valor)}</span></div>
  ${R.geral.semValor ? `<div class="aviso">⚠ ${R.geral.semValor} ${R.geral.semValor === 1 ? 'trabalho está' : 'trabalhos estão'} sem valor lançado no aplicativo e não ${R.geral.semValor === 1 ? 'entra' : 'entram'} nas somas acima.</div>` : ''}
</div>
<div class="assin"><div>${esc(dados.nomeLab || 'Laboratório')}</div><div>${esc(nomeCliente)}</div></div>
</body></html>`;

if (HTML_OUT) writeFileSync(HTML_OUT, html);
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
const pagina = await navegador.newPage();
await pagina.setContent(html, { waitUntil: 'load' });
await pagina.emulateMedia({ media: 'print' });
const rodape = `<div style="width:100%;font-family:'Liberation Sans',Arial,sans-serif;font-size:7.5pt;color:#A8A29E;padding:0 13mm;display:flex;justify-content:space-between;"><span>${esc(dados.nomeLab || 'Laboratório')} • ${esc(nomeCliente)} • emitido em ${formatDateBR(hojeISO())}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`;
await pagina.pdf({ path: SAIDA, format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: rodape, margin: { top: '14mm', right: '13mm', bottom: '18mm', left: '13mm' } });
if (PNG) { await pagina.setViewportSize({ width: 1000, height: 1200 }); await pagina.emulateMedia({ media: 'screen' }); await pagina.screenshot({ path: PNG, fullPage: true }); }
await navegador.close();
console.log(JSON.stringify(R));
console.log(`PDF gravado em ${SAIDA} ✓`);
