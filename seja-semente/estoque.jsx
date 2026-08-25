// ═══════════════════════════════════════════════════════════════════════════
//  ESTOQUE — os materiais da clínica, com retirada automática e relatório
//
//  A central alimenta o estoque (itens, quantidades e o mínimo de alerta).
//  Qualquer voluntário que precisar de material RETIRA por aqui: escolhe o
//  item e a quantidade — o sistema desconta na hora e registra quem retirou.
//  Tudo fica no histórico de movimentações, e a lista "Precisa repor" mostra
//  o que está no fim para a compra.
//  Coleções: estoque/{item} e estoque-movimentos (o extrato).
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';

function quando(v) {
  const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
  if (!d || isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Formulário de item novo (só a central alimenta o estoque)
function NovoItem({ aoAdicionar }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [qtd, setQtd] = useState('');
  const [minimo, setMinimo] = useState('');
  const [unidade, setUnidade] = useState('');
  if (!aberto) return <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 10 }} onClick={() => setAberto(true)}>+ Adicionar item ao estoque</button>;
  return (
    <div className="cartao" style={{ marginBottom: 10 }}>
      <strong style={{ display: 'block', marginBottom: 8 }}>Novo item</strong>
      <label className="campo"><span>Nome do material</span><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Luva de procedimento M" /></label>
      <div className="linha-botoes">
        <label className="campo" style={{ flex: 1 }}><span>Quantidade</span><input value={qtd} onChange={e => setQtd(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" /></label>
        <label className="campo" style={{ flex: 1 }}><span>Unidade</span><input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="caixa, un, pacote…" /></label>
      </div>
      <label className="campo"><span>Avisar para repor quando restar</span><input value={minimo} onChange={e => setMinimo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Ex.: 5" /></label>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={() => setAberto(false)}>Cancelar</button>
        <button className="btn-principal" disabled={!nome.trim()} onClick={() => {
          aoAdicionar({ nome: nome.trim(), qtd: Number(qtd || 0), minimo: Number(minimo || 0), unidade: unidade.trim() });
          setNome(''); setQtd(''); setMinimo(''); setUnidade(''); setAberto(false);
        }}>Adicionar</button>
      </div>
    </div>
  );
}

// central=true libera alimentar/editar/apagar; todo mundo pode RETIRAR
export function Estoque({ usuario, fb, central }) {
  const [itens, setItens] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [mexendo, setMexendo] = useState(null); // { id, tipo: 'saida'|'entrada' }
  const [qtdMexe, setQtdMexe] = useState('1');
  const online = !!fb;

  useEffect(() => {
    if (!online) return;
    const { collection, query, orderBy, limit, onSnapshot } = fb.fns;
    const s1 = onSnapshot(query(collection(fb.db, 'estoque'), orderBy('nome')),
      snap => setItens(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const s2 = onSnapshot(query(collection(fb.db, 'estoque-movimentos'), orderBy('criadoEm', 'desc'), limit(40)),
      snap => setMovimentos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { s1(); s2(); };
  }, [online]);

  function adicionarItem(f) {
    if (!online) { setItens(is => [...is, { id: 'e' + Math.floor(Math.random() * 1e9), ...f }].sort((a, b) => a.nome.localeCompare(b.nome))); return; }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'estoque'), { ...f, criadoEm: serverTimestamp(), criadoPorNome: usuario.nome || '' }).catch(() => {});
  }

  // O coração do estoque: desconta (ou repõe) e deixa registrado quem foi
  function movimentar(item, tipo, qtd) {
    qtd = Math.max(1, Number(qtd || 1));
    if (tipo === 'saida' && qtd > (item.qtd || 0)) qtd = item.qtd || 0;
    if (!qtd) return;
    const mov = { itemId: item.id, itemNome: item.nome, unidade: item.unidade || '', tipo, qtd, autorUid: usuario.uid, autorNome: usuario.nome || '' };
    if (!online) {
      setItens(is => is.map(i => i.id === item.id ? { ...i, qtd: (i.qtd || 0) + (tipo === 'entrada' ? qtd : -qtd) } : i));
      setMovimentos(ms => [{ id: 'm' + Math.floor(Math.random() * 1e9), ...mov, criadoEm: new Date() }, ...ms]);
      return;
    }
    const { doc, updateDoc, increment, collection, addDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'estoque', item.id), { qtd: increment(tipo === 'entrada' ? qtd : -qtd) }).catch(() => {});
    addDoc(collection(fb.db, 'estoque-movimentos'), { ...mov, criadoEm: serverTimestamp() }).catch(() => {});
  }

  function apagarItem(item) {
    if (!window.confirm(`Apagar "${item.nome}" do estoque?`)) return;
    if (!online) { setItens(is => is.filter(i => i.id !== item.id)); return; }
    const { doc, deleteDoc } = fb.fns;
    deleteDoc(doc(fb.db, 'estoque', item.id)).catch(() => {});
  }

  const repor = itens.filter(i => (i.qtd || 0) <= (i.minimo || 0));

  return (
    <>
      <h2>Estoque</h2>
      <p className="dica" style={{ marginTop: 0 }}>
        {central
          ? 'Alimente o estoque aqui. Cada retirada dos voluntários desconta sozinha e fica registrada embaixo.'
          : 'Precisou de material? Retire por aqui — o sistema desconta sozinho e avisa a central.'}
      </p>

      {repor.length > 0 && (
        <div className="cartao estoque-repor">
          <strong>🛒 Precisa repor ({repor.length})</strong>
          {repor.map(i => (
            <div key={i.id} className="estoque-repor-linha">
              <span>{i.nome}</span>
              <b>{i.qtd || 0} {i.unidade || 'un'} restando{(i.minimo || 0) > 0 ? ` · mínimo ${i.minimo}` : ''}</b>
            </div>
          ))}
        </div>
      )}

      {central && <NovoItem aoAdicionar={adicionarItem} />}

      {itens.length ? itens.map(i => {
        const baixo = (i.qtd || 0) <= (i.minimo || 0);
        return (
          <div className="cartao estoque-item" key={i.id}>
            <div className="estoque-topo">
              <div>
                <strong>{i.nome}</strong>
                <p className="obs" style={{ margin: 0 }}>
                  <b className={baixo ? 'estoque-qtd baixo' : 'estoque-qtd'}>{i.qtd || 0}</b> {i.unidade || 'un'} em estoque
                  {baixo && <span className="chip prioridade" style={{ marginLeft: 6 }}>repor</span>}
                </p>
              </div>
              <div className="estoque-botoes">
                <button className="btn-secundario" onClick={() => { setMexendo({ id: i.id, tipo: 'saida' }); setQtdMexe('1'); }} disabled={!(i.qtd > 0)}>− Retirar</button>
                {central && <button className="btn-secundario" onClick={() => { setMexendo({ id: i.id, tipo: 'entrada' }); setQtdMexe('1'); }}>+ Entrada</button>}
                {central && <button className="btn-remover" onClick={() => apagarItem(i)}>✕</button>}
              </div>
            </div>
            {mexendo?.id === i.id && (
              <div className="estoque-mexe">
                <span>{mexendo.tipo === 'saida' ? 'Retirar quantos?' : 'Entraram quantos?'}</span>
                <button className="estoque-passo" onClick={() => setQtdMexe(q => String(Math.max(1, Number(q) - 1)))}>−</button>
                <input value={qtdMexe} onChange={e => setQtdMexe(e.target.value.replace(/\D/g, '') || '1')} inputMode="numeric" />
                <button className="estoque-passo" onClick={() => setQtdMexe(q => String(Number(q) + 1))}>+</button>
                <button className="btn-principal" style={{ maxWidth: 'none', flex: 1, padding: '10px 8px' }} onClick={() => { movimentar(i, mexendo.tipo, qtdMexe); setMexendo(null); }}>
                  {mexendo.tipo === 'saida' ? 'Confirmar retirada' : 'Confirmar entrada'}
                </button>
                <button className="btn-remover" onClick={() => setMexendo(null)}>✕</button>
              </div>
            )}
          </div>
        );
      }) : <div className="vazio">{central ? 'Estoque vazio — adicione o primeiro item. 📦' : 'A central ainda não cadastrou os materiais do estoque.'}</div>}

      {movimentos.length > 0 && (
        <div className="cartao" style={{ marginTop: 6 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>📜 Últimas movimentações</strong>
          {movimentos.map(m => (
            <div key={m.id} className="estoque-mov">
              <span className={m.tipo === 'saida' ? 'mov-sinal saida' : 'mov-sinal entrada'}>{m.tipo === 'saida' ? '−' : '+'}{m.qtd}</span>
              <span className="mov-texto"><b>{m.itemNome}</b> · {(m.autorNome || '').split(' ')[0]}</span>
              <span className="mov-quando">{quando(m.criadoEm)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
