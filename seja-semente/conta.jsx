// ═══════════════════════════════════════════════════════════════════════════
//  APAGAR A CONTA — o direito de ir embora
//
//  A Apple exige (diretriz 5.1.1(v)) que todo aplicativo onde dá para criar
//  conta tenha, DENTRO dele, um jeito de apagar essa conta. Não basta um
//  e-mail de pedido: tem que ser um botão, e tem que funcionar até para
//  quem criou a conta e nunca conseguiu entrar.
//
//  A ORDEM IMPORTA. O Google exige que a pessoa tenha entrado há pouco para
//  deixar apagar a conta. Se a gente apagasse os cadastros primeiro e só
//  depois descobrisse isso, a pessoa ficaria pelo meio: sem cadastro e com
//  a conta viva. Por isso: primeiro a pessoa entra de novo, depois some tudo.
//
//  O que apagamos: a conta de entrada, o cadastro neste aplicativo e o
//  registro deste aparelho (para ele parar de tocar). O que NÃO apagamos: as
//  fichas dos pacientes e o histórico do projeto — são registros do trabalho
//  social, não dados pessoais de quem usa o aplicativo, e a lei de saúde
//  manda guardar. A tela explica isso com todas as letras antes de apagar.
//
//  Compartilhado pelos quatro aplicativos.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';

// Erro que a tela entende como "preciso da senha desta pessoa"
function PedeSenha() {
  const e = new Error('Digite a sua senha para confirmar.');
  e.precisaSenha = true;
  return e;
}

// A pessoa entra de novo, agorinha. Sem isso o Google recusa apagar.
async function entrarDeNovo(fb, senha) {
  const eu = fb.auth?.currentUser;
  if (!eu) throw new Error('Você não está conectado. Entre e tente outra vez.');
  const porGoogle = (eu.providerData || []).some(p => p.providerId === 'google.com');
  if (porGoogle) {
    // No aplicativo instalado é a tela de contas do próprio aparelho
    if (window.__loginGoogleNativo) {
      const c = await window.__loginGoogleNativo();
      const cred = fb.fns.GoogleAuthProvider.credential(c.idToken, c.accessToken || undefined);
      await fb.fns.reauthenticateWithCredential(eu, cred);
      return;
    }
    const p = new fb.fns.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    await fb.fns.reauthenticateWithPopup(eu, p);
    return;
  }
  if (!senha) throw PedeSenha();
  const cred = fb.fns.EmailAuthProvider.credential(eu.email, senha);
  await fb.fns.reauthenticateWithCredential(eu, cred);
}

// Espera no máximo esse tempo — o Firestore não avisa quando está sem rede,
// ele simplesmente nunca responde, e a tela não pode ficar presa nisso
function comPrazo(promessa, segundos, recado) {
  return Promise.race([
    promessa,
    new Promise((_, deuRuim) => setTimeout(() => deuRuim(new Error(recado)), segundos * 1000)),
  ]);
}

// Apaga o cadastro nas coleções deste aplicativo e depois a conta de entrada.
// `lugares` é uma lista de { colecao, id } — por exemplo { colecao:
// 'voluntarios', id: uid }. Use { colecao: 'investidores', porEmail: true }
// quando a pessoa é achada pelo e-mail.
export async function apagarConta(fb, usuario, lugares = [], chavesLocais = [], senha = '') {
  try {
    if (fb) {
      // 1. Entrar de novo (pode abrir a tela de contas do Google)
      await entrarDeNovo(fb, senha);

      // 2. Apagar a conta de entrada ANTES dos cadastros: se algo der errado
      //    aqui, nada foi perdido e a pessoa tenta de novo
      await comPrazo(fb.fns.deleteUser(fb.auth.currentUser), 25,
        'Não consegui falar com o servidor. Confira a internet e tente outra vez.');

      // 3. Agora os cadastros. Não esperamos o servidor: as remoções entram
      //    na fila do Firestore e saem sozinhas — a tela não trava por isso
      const { doc, deleteDoc, collection, query, where, getDocs } = fb.fns;
      for (const l of lugares) {
        if (!l || !l.colecao) continue;
        try {
          if (l.id) {
            deleteDoc(doc(fb.db, l.colecao, l.id)).catch(() => {});
          } else if (l.porEmail && usuario?.email) {
            const email = String(usuario.email).trim().toLowerCase();
            deleteDoc(doc(fb.db, l.colecao, email)).catch(() => {});
            comPrazo(getDocs(query(collection(fb.db, l.colecao), where('email', '==', email))), 8, 'demorou')
              .then(achados => { for (const d of achados.docs) deleteDoc(d.ref).catch(() => {}); })
              .catch(() => {});
          }
        } catch (e) { /* já não existia: segue */ }
      }
    }
  } finally {
    // 4. O aparelho fica limpo aconteça o que acontecer — inclusive a cópia
    //    dos dados que o banco guarda aqui dentro (num celular emprestado
    //    isso é o que impede a próxima pessoa de ver ficha de paciente)
    for (const c of chavesLocais) { try { localStorage.removeItem(c); } catch (e) { /* nada */ } }
    if (fb) {
      try { await fb.fns.terminate(fb.db); await fb.fns.clearIndexedDbPersistence(fb.db); } catch (e) { /* segue */ }
    }
  }
}

// A tela: explica, pede a palavra APAGAR e só então libera o botão
export function TelaApagarConta({ usuario, oQueFica, aoApagar, aoVoltar }) {
  const [palavra, setPalavra] = useState('');
  const [senha, setSenha] = useState('');
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState('');
  const pronto = palavra.trim().toUpperCase() === 'APAGAR' && (!pedindoSenha || senha);

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
          Seu cadastro neste aplicativo — nome, e-mail, telefone, foto e o seu acesso —, a sua conta
          de entrada, o registro deste aparelho (ele para de tocar) e a cópia dos dados guardada aqui
          dentro do celular.
        </p>
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>O que continua</strong>
        <p className="obs" style={{ margin: 0 }}>
          {oQueFica || 'As fichas dos pacientes e o histórico do projeto continuam, porque são registros do trabalho social e a lei de saúde manda guardar. Eles não são dados seus.'}
        </p>
      </div>

      <p className="dica" style={{ margin: '0 0 6px' }}>
        Por segurança, o aplicativo vai pedir que você entre de novo antes de apagar.
      </p>

      <label className="campo">
        <span>Para confirmar, escreva APAGAR</span>
        <input value={palavra} onChange={e => setPalavra(e.target.value)} placeholder="APAGAR" autoCapitalize="characters" />
      </label>

      {pedindoSenha && (
        <label className="campo">
          <span>A sua senha</span>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="senha" />
        </label>
      )}

      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" disabled={apagando} onClick={aoVoltar}>Cancelar</button>
        <button className="btn-principal" style={{ background: '#B3402A', boxShadow: 'none' }}
          disabled={!pronto || apagando}
          onClick={async () => {
            setApagando(true); setErro('');
            try {
              await aoApagar(senha);
            } catch (e) {
              if (e?.precisaSenha) { setPedindoSenha(true); setErro('Digite a sua senha para confirmar.'); }
              else setErro(e?.message || String(e));
              setApagando(false);
            }
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
