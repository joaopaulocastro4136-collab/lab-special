// ═══════════════════════════════════════════════════════════════════════════
//  APAGAR A CONTA — o direito de ir embora
//
//  A Apple exige (diretriz 5.1.1(v)) que todo aplicativo onde dá para criar
//  conta tenha, DENTRO dele, um jeito de apagar essa conta. Não basta um
//  e-mail de pedido: tem que ser um botão.
//
//  O que apagamos: a conta de entrada da pessoa e o cadastro dela neste
//  aplicativo (nome, e-mail, telefone, foto, papel). O que NÃO apagamos: as
//  fichas dos pacientes e o histórico do projeto — são registros do trabalho
//  social, não dados pessoais de quem usa o aplicativo, e a lei de saúde
//  manda guardar. A tela explica isso com todas as letras antes de apagar.
//
//  Compartilhado pelos quatro aplicativos.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';

// Apaga o cadastro nas coleções deste aplicativo e depois a conta de entrada.
// `lugares` é uma lista de { colecao, id } — por exemplo { colecao:
// 'voluntarios', id: uid }. Fora do Firebase (modo demonstração) só limpa o
// que está guardado no aparelho.
export async function apagarConta(fb, usuario, lugares = [], chavesLocais = []) {
  if (fb) {
    const { doc, deleteDoc, collection, query, where, getDocs } = fb.fns;
    for (const l of lugares) {
      if (!l || !l.colecao) continue;
      try {
        if (l.id) {
          await deleteDoc(doc(fb.db, l.colecao, l.id));
        } else if (l.porEmail && usuario.email) {
          // Coleções onde a pessoa é achada pelo e-mail (investidores)
          const achados = await getDocs(query(collection(fb.db, l.colecao), where('email', '==', String(usuario.email).toLowerCase())));
          for (const d of achados.docs) await deleteDoc(d.ref);
        }
      } catch (e) { /* já não existia, ou sem permissão: segue */ }
    }
    // A conta de entrada por último — depois dela não há mais permissão
    try {
      const quem = fb.auth?.currentUser;
      if (quem) await fb.fns.deleteUser(quem);
    } catch (e) {
      const codigo = String(e?.code || '');
      if (codigo.includes('requires-recent-login')) {
        throw new Error('Por segurança, o Google pede que você entre de novo antes de apagar a conta. Saia, entre outra vez e repita.');
      }
      throw e;
    }
  }
  for (const c of chavesLocais) { try { localStorage.removeItem(c); } catch (e) { /* nada */ } }
}

// A tela: explica, pede a palavra APAGAR e só então libera o botão
export function TelaApagarConta({ usuario, oQueFica, aoApagar, aoVoltar }) {
  const [palavra, setPalavra] = useState('');
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState('');
  const pronto = palavra.trim().toUpperCase() === 'APAGAR';

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>Apagar minha conta</h2>

      <div className="cartao" style={{ border: '1.5px solid #E8A08C' }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>Isto não tem volta</strong>
        <p style={{ margin: 0 }}>
          A conta <b>{usuario?.email || usuario?.nome}</b> deixa de existir. Você sai do aplicativo na
          hora e não consegue mais entrar com ela.
        </p>
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>O que é apagado</strong>
        <p className="obs" style={{ margin: 0 }}>
          Seu cadastro neste aplicativo — nome, e-mail, telefone, foto e o seu acesso — e a sua
          conta de entrada.
        </p>
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>O que continua</strong>
        <p className="obs" style={{ margin: 0 }}>
          {oQueFica || 'As fichas dos pacientes e o histórico do projeto continuam, porque são registros do trabalho social e não dados seus. O seu nome sai deles.'}
        </p>
      </div>

      <label className="campo">
        <span>Para confirmar, escreva APAGAR</span>
        <input value={palavra} onChange={e => setPalavra(e.target.value)} placeholder="APAGAR" autoCapitalize="characters" />
      </label>

      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoVoltar}>Cancelar</button>
        <button className="btn-principal" style={{ background: '#B3402A', boxShadow: 'none' }}
          disabled={!pronto || apagando}
          onClick={async () => {
            setApagando(true); setErro('');
            try { await aoApagar(); } catch (e) { setErro(e?.message || String(e)); setApagando(false); }
          }}>
          <Trash2 size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          {apagando ? 'Apagando…' : 'Apagar minha conta'}
        </button>
      </div>
    </div>
  );
}

// O botão que leva até lá — entra no fim do Perfil de cada aplicativo
export function BotaoApagarConta({ aoAbrir }) {
  return (
    <>
      <button className="btn-apagar-conta" onClick={aoAbrir}>Apagar minha conta</button>
      <p className="dica" style={{ margin: '4px 0 0', textAlign: 'center' }}>
        Apaga a sua conta e o seu cadastro deste aplicativo, para sempre.
      </p>
    </>
  );
}
