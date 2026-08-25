import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as M from './palmar/__t.jsx';
const erros = [];
const origErr = console.error;
let cliques = 0;
async function main() {
  window.addEventListener('error', e => erros.push('window.error: ' + (e.error?.message || e.message)));
  console.error = (...a) => { const s = a.map(x => (x && x.message) || String(x)).join(' '); if (!/not wrapped in act/.test(s)) erros.push('console.error: ' + s.slice(0, 260)); };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.getElementById('root');
  const root = createRoot(host);
  class Limite extends React.Component {
    constructor(p) { super(p); this.state = {}; }
    static getDerivedStateFromError(e) { return { e }; }
    componentDidCatch(e) { erros.push('CRASH: ' + e.message + ' | ' + (e.stack||'').split('\n')[1]); }
    render() { return this.state.e ? React.createElement('div', null, 'quebrou') : this.props.children; }
  }
  const clique = async (el) => { cliques++; await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
  const rot = (el) => (el.textContent || '').trim().slice(0, 38).replace(/\s+/g, ' ');
  const alvos = (sel) => [...host.querySelectorAll(sel)];
  await act(async () => { root.render(React.createElement(Limite, null, React.createElement(M.App))); });
  const g = alvos('button.btn-google')[0];
  if (g) await clique(g); else erros.push('SEM botao Google');
  console.log('nav=' + alvos('nav button').length + ' main=' + alvos('main button').length);
  const SEL_MAIN = 'main button, main div.cartao, main input[type=checkbox], main label';
  const SEL_SUB = '.folha button, .folha input[type=checkbox], .folha label';
  const abas = ['Painel', 'Ações', 'Equipe', 'Estoque', 'Valores', 'Perfil'];
  const irAba = async (nome) => {
    for (let k = 0; k < 3; k++) { const v = alvos('button').find(x => /^(Voltar|Cancelar)/.test(x.textContent.trim())); if (!v) break; await clique(v); }
    const b = alvos('nav button').find(x => x.textContent.includes(nome));
    if (b) await clique(b);
  };
  for (const nome of abas) {
    await irAba(nome);
    const n = alvos(SEL_MAIN).length;
    console.log(`[${nome}] ${n} alvos`);
    for (let i = 0; i < n; i++) {
      await irAba(nome);
      const el = alvos(SEL_MAIN)[i];
      if (!el) continue;
      const via = nome + ' > ' + rot(el);
      const a1 = erros.length;
      try { await clique(el); } catch (e) { erros.push('THROW: ' + e.message); }
      for (let k = a1; k < erros.length; k++) erros[k] += '   <<< ' + via;
      const m = Math.min(alvos(SEL_SUB).length, 14);
      for (let j = 0; j < m; j++) {
        const e2 = alvos(SEL_SUB)[j];
        if (!e2) continue;
        const via2 = via + ' >> ' + rot(e2);
        const a2 = erros.length;
        try { await clique(e2); } catch (e) { erros.push('THROW: ' + e.message); }
        for (let k = a2; k < erros.length; k++) erros[k] += '   <<< ' + via2;
        await irAba(nome);
        const el2 = alvos(SEL_MAIN)[i];
        if (el2) { try { await clique(el2); } catch (e) {} }
      }
    }
  }
  console.error = origErr;
  console.log('cliques=' + cliques + ' ERROS=' + erros.length);
  console.log([...new Set(erros)].join('\n'));
}
main().catch(e => { console.error = origErr; console.log('FALHA HARNESS ' + e.stack); });
