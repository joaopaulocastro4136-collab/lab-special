// ═══════════════════════════════════════════════════════════════════════════
//  SEJA SEMENTE — aplicativo central do projeto (versão mobile)
//
//  É a mesma central do programa Windows, no celular: triagem inicial das
//  pessoas acolhidas, agendamentos, avisos e equipe de voluntários.
//  Windows, este aplicativo e o Semeador (app do voluntário) conversam
//  através do mesmo Firebase — o contrato de dados está em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { ArvoreLogo } from '../logo.jsx';

const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null;

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } = await import('firebase/auth');
  const { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, query, orderBy, serverTimestamp } = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  fb = {
    auth: getAuth(app),
    db: getFirestore(app),
    fns: { onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, query, orderBy, serverTimestamp },
  };
}

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'central-demo', nome: 'Coordenação (teste)' },
  triagens: [
    { id: 't1', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', necessidade: 'Alimentação', observacoes: 'Mora perto da praça, tem dois filhos pequenos.', status: 'aguardando', criadoEm: new Date() },
    { id: 't2', nome: 'Ana Paula', idade: '34', telefone: '', necessidade: 'Documentos', observacoes: 'Precisa tirar segunda via do RG.', status: 'em atendimento', criadoEm: new Date(Date.now() - 864e5) },
    { id: 't3', nome: 'Carlos Mendes', idade: '41', telefone: '(11) 97777-2222', necessidade: 'Saúde', observacoes: 'Encaminhado ao posto, acompanhar retorno.', status: 'concluída', criadoEm: new Date(Date.now() - 3 * 864e5) },
  ],
  agendamentos: [
    { id: 'g1', titulo: 'Entrega de cestas', data: proximoDia(6), hora: '09:00', local: 'Sede Seja Semente', responsavel: 'Coordenação', origem: 'central', criadoEm: new Date() },
    { id: 'g2', titulo: 'Atendimento José da Silva', data: proximoDia(3), hora: '14:00', local: 'Sede', responsavel: 'Maria (voluntária)', origem: 'semeador', criadoEm: new Date() },
  ],
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo à central Seja Semente!', texto: 'Este é o aplicativo central: triagem, agendamentos, avisos e equipe — a mesma central do programa Windows, no celular.', autor: 'Sistema', criadoEm: new Date() },
  ],
  voluntarios: [
    { id: 'v1', nome: 'Maria Souza', ministerio: 'Acolhimento', telefone: '(11) 91234-5678', status: 'ativo', ativo: true },
    { id: 'v2', nome: 'Pedro Lima', ministerio: 'Distribuição', telefone: '(11) 99876-5432', status: 'ativo', ativo: true },
    { id: 'v3', nome: 'Lucas Andrade', email: 'lucas.andrade@gmail.com', telefone: '(11) 95555-4444', cpf: '123.456.789-00', nascimento: '1995-03-14', status: 'pendente', ativo: false },
  ],
};

function proximoDia(diaSemana) {
  const d = new Date();
  d.setDate(d.getDate() + ((diaSemana - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
function hojeISO() { return new Date().toISOString().slice(0, 10); }
function dataNascimentoBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const NECESSIDADES = ['Alimentação', 'Roupas', 'Documentos', 'Saúde', 'Moradia', 'Apoio / conversa', 'Outro'];
const PROXIMO_STATUS = { 'aguardando': 'em atendimento', 'em atendimento': 'concluída', 'concluída': 'aguardando' };

// ═══════════════════════════════════════════════════════════════════════════
//  Telas
// ═══════════════════════════════════════════════════════════════════════════

function TelaLogin({ aoEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro('');
    if (!CONFIGURADO) {
      aoEntrar({ ...DEMO.usuario, nome: nome.trim() || DEMO.usuario.nome });
      return;
    }
    setCarregando(true);
    try {
      await fb.fns.signInWithEmailAndPassword(fb.auth, email.trim(), senha);
    } catch (e) {
      setErro('Não consegui entrar. Confira o e-mail e a senha.');
    }
    setCarregando(false);
  }

  return (
    <div className="tela-login">
      <ArvoreLogo tamanho={130} />
      <h1>Seja Semente</h1>
      <p className="login-sub">Central do projeto · triagem e agendamentos</p>
      {CONFIGURADO ? (
        <>
          <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} />
        </>
      ) : (
        <>
          <div className="faixa-demo">Modo demonstração — o Firebase ainda não foi configurado (veja o README.md)</div>
          <input placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} />
        </>
      )}
      {erro && <div className="erro">{erro}</div>}
      <button className="btn-principal" onClick={entrar} disabled={carregando}>
        {carregando ? 'Entrando…' : 'Entrar'}
      </button>
    </div>
  );
}

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

function FormTriagem({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ nome: '', idade: '', telefone: '', necessidade: NECESSIDADES[0], observacoes: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Nova triagem</h2>
      <Campo rotulo="Nome"><input value={f.nome} onChange={muda('nome')} placeholder="Nome da pessoa acolhida" /></Campo>
      <Campo rotulo="Idade"><input value={f.idade} onChange={muda('idade')} inputMode="numeric" /></Campo>
      <Campo rotulo="Telefone"><input value={f.telefone} onChange={muda('telefone')} inputMode="tel" /></Campo>
      <Campo rotulo="Principal necessidade">
        <select value={f.necessidade} onChange={muda('necessidade')}>{NECESSIDADES.map(n => <option key={n}>{n}</option>)}</select>
      </Campo>
      <Campo rotulo="Observações"><textarea rows={3} value={f.observacoes} onChange={muda('observacoes')} /></Campo>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Salvar triagem</button>
      </div>
    </div>
  );
}

function FormAgendamento({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ titulo: '', data: hojeISO(), hora: '09:00', local: '', responsavel: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Novo agendamento</h2>
      <Campo rotulo="O quê"><input value={f.titulo} onChange={muda('titulo')} placeholder="Ex.: Entrega de cestas" /></Campo>
      <Campo rotulo="Data"><input type="date" value={f.data} onChange={muda('data')} /></Campo>
      <Campo rotulo="Hora"><input type="time" value={f.hora} onChange={muda('hora')} /></Campo>
      <Campo rotulo="Local"><input value={f.local} onChange={muda('local')} /></Campo>
      <Campo rotulo="Responsável"><input value={f.responsavel} onChange={muda('responsavel')} /></Campo>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.titulo.trim()} onClick={() => aoSalvar(f)}>Agendar</button>
      </div>
    </div>
  );
}

function FormAviso({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ titulo: '', texto: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Novo aviso</h2>
      <Campo rotulo="Título"><input value={f.titulo} onChange={muda('titulo')} /></Campo>
      <Campo rotulo="Texto"><textarea rows={4} value={f.texto} onChange={muda('texto')} /></Campo>
      <p className="dica">O aviso aparece na hora no aplicativo Semeador de todos os voluntários.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.titulo.trim() || !f.texto.trim()} onClick={() => aoSalvar(f)}>Publicar</button>
      </div>
    </div>
  );
}

function TelaPrincipal({ usuario, aoSair }) {
  const [aba, setAba] = useState('triagem');
  const [form, setForm] = useState(null); // 'triagem' | 'agendamento' | 'aviso'
  const [triagens, setTriagens] = useState(CONFIGURADO ? [] : DEMO.triagens);
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : DEMO.agendamentos);
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : DEMO.avisos);
  const [voluntarios, setVoluntarios] = useState(CONFIGURADO ? [] : DEMO.voluntarios);

  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, onSnapshot, query, orderBy } = fb.fns;
    const escuta = (col, ord, poe) => onSnapshot(query(collection(fb.db, col), orderBy(...ord)), s => poe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const soltar = [
      escuta('triagens', ['criadoEm', 'desc'], setTriagens),
      escuta('agendamentos', ['data'], setAgendamentos),
      escuta('avisos', ['criadoEm', 'desc'], setAvisos),
      escuta('voluntarios', ['nome'], setVoluntarios),
    ];
    return () => soltar.forEach(s => s());
  }, []);

  // Enquanto a central estiver aberta (aqui ou no Windows), o Semeador mostra
  // "Central conectada" — batimento a cada minuto em central/status.
  useEffect(() => {
    if (!CONFIGURADO) return;
    const { doc, setDoc, serverTimestamp } = fb.fns;
    const bater = () => setDoc(doc(fb.db, 'central', 'status'), { online: true, atualizadoEm: serverTimestamp() }).catch(() => {});
    bater();
    const timer = setInterval(bater, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  async function salvar(col, dados, local, poe) {
    if (!CONFIGURADO) {
      poe(xs => [{ id: 'novo-' + xs.length, ...local, ...dados }, ...xs]);
      setForm(null);
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, col), { ...dados, ...local, criadoEm: serverTimestamp() });
    setForm(null);
  }

  // Aprova ou recusa a solicitação de cadastro que o voluntário enviou pelo
  // Semeador — no celular dele, o aplicativo libera (ou avisa) na hora.
  async function responderSolicitacao(v, aprovar) {
    const mudanca = aprovar ? { status: 'ativo', ativo: true } : { status: 'recusado', ativo: false };
    if (!CONFIGURADO) {
      setVoluntarios(vs => vs.map(x => x.id === v.id ? { ...x, ...mudanca } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'voluntarios', v.id), mudanca);
  }

  async function mudarStatus(t) {
    const status = PROXIMO_STATUS[t.status] || 'aguardando';
    if (!CONFIGURADO) {
      setTriagens(ts => ts.map(x => x.id === t.id ? { ...x, status } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'triagens', t.id), { status });
  }

  if (form === 'triagem') return <FormTriagem aoCancelar={() => setForm(null)} aoSalvar={f => salvar('triagens', f, { status: 'aguardando', criadoEm: new Date() }, setTriagens)} />;
  if (form === 'agendamento') return <FormAgendamento aoCancelar={() => setForm(null)} aoSalvar={f => salvar('agendamentos', f, { origem: 'central', criadoEm: new Date() }, setAgendamentos)} />;
  if (form === 'aviso') return <FormAviso aoCancelar={() => setForm(null)} aoSalvar={f => salvar('avisos', f, { autor: usuario.nome, criadoEm: new Date() }, setAvisos)} />;

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <span className="logo-mini">🌱</span>
          <div>
            <strong>Seja Semente</strong>
            <div className="status">Central · {usuario.nome}</div>
          </div>
        </div>
      </header>

      <main>
        {aba === 'triagem' && (
          <>
            <div className="titulo-com-botao"><h2>Triagem</h2><button className="btn-mais" onClick={() => setForm('triagem')}>+ Nova</button></div>
            {triagens.length ? triagens.map(t => (
              <div className="cartao" key={t.id}>
                <div className="cartao-topo">
                  <strong>{t.nome}</strong>
                  <button className={'chip ' + t.status.replace(' ', '-')} onClick={() => mudarStatus(t)}>{t.status}</button>
                </div>
                <p>{t.necessidade}{t.idade ? ` · ${t.idade} anos` : ''}{t.telefone ? ` · ${t.telefone}` : ''}</p>
                {t.observacoes && <p className="obs">{t.observacoes}</p>}
              </div>
            )) : <div className="vazio">Nenhuma triagem ainda. Toque em "+ Nova".</div>}
          </>
        )}
        {aba === 'agenda' && (
          <>
            <div className="titulo-com-botao"><h2>Agenda</h2><button className="btn-mais" onClick={() => setForm('agendamento')}>+ Agendar</button></div>
            {agendamentos.length ? agendamentos.map(g => (
              <div className="cartao" key={g.id}>
                <div className="cartao-topo">
                  <strong>{g.titulo}</strong>
                  <span className="quando">{dataBonita(g.data)} · {g.hora}</span>
                </div>
                {g.local && <p>📍 {g.local}</p>}
                <p className="obs">{g.responsavel ? `Responsável: ${g.responsavel} · ` : ''}{g.origem === 'semeador' ? 'agendado por voluntário no Semeador' : 'agendado pela central'}</p>
              </div>
            )) : <div className="vazio">Nada agendado ainda.</div>}
          </>
        )}
        {aba === 'avisos' && (
          <>
            <div className="titulo-com-botao"><h2>Avisos</h2><button className="btn-mais" onClick={() => setForm('aviso')}>+ Novo</button></div>
            {avisos.length ? avisos.map(a => (
              <div className="cartao" key={a.id}>
                <strong>{a.titulo}</strong>
                <p>{a.texto}</p>
                {a.autor && <div className="obs">— {a.autor}</div>}
              </div>
            )) : <div className="vazio">Nenhum aviso publicado.</div>}
          </>
        )}
        {aba === 'equipe' && (() => {
          const pendentes = voluntarios.filter(v => v.status === 'pendente');
          const equipe = voluntarios.filter(v => v.status !== 'pendente' && v.status !== 'recusado');
          return (
            <>
              {pendentes.length > 0 && (
                <>
                  <h2>Solicitações de cadastro</h2>
                  {pendentes.map(v => (
                    <div className="cartao pendente" key={v.id}>
                      <div className="cartao-topo"><strong>{v.nome}</strong><span className="chip aguardando">pendente</span></div>
                      <p>
                        {v.email && <>{v.email}<br /></>}
                        {v.telefone && <>{v.telefone}<br /></>}
                        {v.cpf && <>CPF: {v.cpf}<br /></>}
                        {v.nascimento && <>Nascimento: {dataNascimentoBonita(v.nascimento)}</>}
                      </p>
                      <div className="linha-botoes">
                        <button className="btn-recusar" onClick={() => responderSolicitacao(v, false)}>Recusar</button>
                        <button className="btn-aprovar" onClick={() => responderSolicitacao(v, true)}>Aprovar voluntário</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <h2>Equipe de voluntários</h2>
              {equipe.length ? equipe.map(v => (
                <div className="cartao" key={v.id}>
                  <div className="cartao-topo"><strong>{v.nome}</strong>{v.ativo === false && <span className="chip aguardando">inativo</span>}</div>
                  <p>{[v.ministerio, v.telefone].filter(Boolean).join(' · ')}</p>
                </div>
              )) : <div className="vazio">Nenhum voluntário cadastrado.</div>}
              <button className="btn-sair" onClick={aoSair}>Sair</button>
            </>
          );
        })()}
      </main>

      <nav>
        <button className={aba === 'triagem' ? 'ativo' : ''} onClick={() => setAba('triagem')}>📋<span>Triagem</span></button>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}>📅<span>Agenda</span></button>
        <button className={aba === 'avisos' ? 'ativo' : ''} onClick={() => setAba('avisos')}>📢<span>Avisos</span></button>
        <button className={aba === 'equipe' ? 'ativo' : ''} onClick={() => setAba('equipe')}>
          <span className="icone-aba">👥{voluntarios.some(v => v.status === 'pendente') && <i className="bolinha" />}</span>
          <span>Equipe</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    if (!CONFIGURADO) return;
    let soltar = null;
    ligarFirebase().then(() => {
      soltar = fb.fns.onAuthStateChanged(fb.auth, u => {
        setUsuario(u ? { uid: u.uid, email: u.email, nome: u.email } : null);
        setPronto(true);
      });
    });
    return () => soltar?.();
  }, []);

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    setUsuario(null);
  }

  if (!pronto) return <div className="carregando">🌱</div>;
  if (!usuario) return <TelaLogin aoEntrar={setUsuario} />;
  return <TelaPrincipal usuario={usuario} aoSair={sair} />;
}

createRoot(document.getElementById('root')).render(<App />);
