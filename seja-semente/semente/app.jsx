// ═══════════════════════════════════════════════════════════════════════════
//  SEJA SEMENTE — aplicativo central do projeto (versão mobile)
//
//  É a mesma central do programa Windows, no celular: cadastro dos pacientes
//  acolhidos (especialidade, procedimento e ficha de saúde), agendamentos,
//  avisos e equipe de voluntários.
//  Windows, este aplicativo e o Semeador (app do voluntário) conversam
//  através do mesmo Firebase — o contrato de dados está em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { ArvoreLogo, Bolha } from '../logo.jsx';

const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null;

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } = await import('firebase/auth');
  const { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, query, orderBy, serverTimestamp } = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  fb = {
    auth: getAuth(app),
    db: getFirestore(app),
    fns: { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, query, orderBy, serverTimestamp },
  };
}

// ─── Especialidades, procedimentos e ficha de saúde ───
const ESPECIALIDADES = {
  'Odontologia': ['Avaliação', 'Limpeza', 'Restauração', 'Extração', 'Canal', 'Prótese', 'Outro'],
  'Médico (clínico geral)': ['Consulta', 'Retorno', 'Encaminhamento', 'Outro'],
  'Psicologia': ['Acolhimento', 'Sessão', 'Outro'],
  'Nutrição': ['Avaliação', 'Acompanhamento', 'Outro'],
  'Assistência social': ['Orientação', 'Documentos', 'Cesta básica', 'Outro'],
  'Outra': ['Outro'],
};
const CONDICOES_SAUDE = ['Hipertensão / pressão alta', 'Diabetes', 'Problema cardíaco', 'Alergia a medicamento', 'Medicação contínua', 'Gestante'];
const PROXIMO_STATUS = { 'aguardando': 'em atendimento', 'em atendimento': 'concluído', 'concluído': 'aguardando' };

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'central-demo', nome: 'Coordenação (teste)' },
  cadastros: [
    { id: 'c1', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', especialidade: 'Odontologia', procedimento: 'Extração', saude: ['Hipertensão / pressão alta'], outrasCondicoes: '', observacoes: 'Sente dor no dente há duas semanas.', status: 'aguardando', criadoEm: new Date() },
    { id: 'c2', nome: 'Ana Paula', idade: '34', telefone: '', especialidade: 'Assistência social', procedimento: 'Documentos', saude: [], outrasCondicoes: '', observacoes: 'Precisa tirar segunda via do RG.', status: 'em atendimento', criadoEm: new Date(Date.now() - 864e5) },
    { id: 'c3', nome: 'Carlos Mendes', idade: '41', telefone: '(11) 97777-2222', especialidade: 'Médico (clínico geral)', procedimento: 'Consulta', saude: ['Diabetes', 'Medicação contínua'], outrasCondicoes: 'Insulina 2x ao dia', observacoes: '', status: 'concluído', criadoEm: new Date(Date.now() - 3 * 864e5) },
  ],
  agendamentos: [
    { id: 'g1', titulo: 'Entrega de cestas', data: proximoDia(6), hora: '09:00', local: 'Sede Seja Semente', responsavel: 'Coordenação', origem: 'central', criadoEm: new Date() },
    { id: 'g2', titulo: 'Atendimento José da Silva', data: proximoDia(3), hora: '14:00', local: 'Sede', responsavel: 'Maria (voluntária)', origem: 'semeador', criadoEm: new Date() },
  ],
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo à central Seja Semente!', texto: 'Este é o aplicativo central: cadastros, agendamentos, avisos e equipe — a mesma central do programa Windows, no celular.', autor: 'Sistema', criadoEm: new Date() },
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

// ═══════════════════════════════════════════════════════════════════════════
//  Telas
// ═══════════════════════════════════════════════════════════════════════════

function TelaLogin({ aoEntrarDemo }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrarGoogle() {
    setErro('');
    if (!CONFIGURADO) {
      aoEntrarDemo({ ...DEMO.usuario });
      return;
    }
    setCarregando(true);
    try {
      await fb.fns.signInWithPopup(fb.auth, new fb.fns.GoogleAuthProvider());
    } catch (e) {
      setErro('Não consegui entrar com o Google. Tente de novo.');
    }
    setCarregando(false);
  }

  async function entrarEmail() {
    setErro('');
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
      <p className="login-sub">Central do projeto · cadastros e agendamentos</p>
      {!CONFIGURADO && <div className="faixa-demo">Modo demonstração — o Firebase ainda não foi configurado (veja o README.md)</div>}
      <button className="btn-google" onClick={entrarGoogle} disabled={carregando}>
        <span className="g">G</span> Entrar com Google
      </button>
      {CONFIGURADO && (
        <>
          <div className="separador">ou com e-mail</div>
          <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrarEmail()} />
          <button className="btn-principal" onClick={entrarEmail} disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </>
      )}
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

function FormCadastro({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({
    nome: '', idade: '', telefone: '',
    especialidade: Object.keys(ESPECIALIDADES)[0],
    procedimento: ESPECIALIDADES[Object.keys(ESPECIALIDADES)[0]][0],
    saude: [], outrasCondicoes: '', observacoes: '',
  });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const mudaEspecialidade = e => setF({ ...f, especialidade: e.target.value, procedimento: ESPECIALIDADES[e.target.value][0] });
  const alternaSaude = c => setF({ ...f, saude: f.saude.includes(c) ? f.saude.filter(x => x !== c) : [...f.saude, c] });
  return (
    <div className="folha">
      <h2>Novo cadastro</h2>
      <Campo rotulo="Nome do paciente"><input value={f.nome} onChange={muda('nome')} /></Campo>
      <Campo rotulo="Idade"><input value={f.idade} onChange={muda('idade')} inputMode="numeric" /></Campo>
      <Campo rotulo="Telefone"><input value={f.telefone} onChange={muda('telefone')} inputMode="tel" /></Campo>
      <Campo rotulo="Especialidade">
        <select value={f.especialidade} onChange={mudaEspecialidade}>{Object.keys(ESPECIALIDADES).map(e => <option key={e}>{e}</option>)}</select>
      </Campo>
      <Campo rotulo="Tipo de procedimento">
        <select value={f.procedimento} onChange={muda('procedimento')}>{ESPECIALIDADES[f.especialidade].map(p => <option key={p}>{p}</option>)}</select>
      </Campo>
      <div className="campo"><span>Saúde do paciente (marque o que tiver)</span>
        <div className="caixas">
          {CONDICOES_SAUDE.map(c => (
            <label key={c} className={f.saude.includes(c) ? 'caixa marcada' : 'caixa'}>
              <input type="checkbox" checked={f.saude.includes(c)} onChange={() => alternaSaude(c)} />
              {c}
            </label>
          ))}
        </div>
      </div>
      <Campo rotulo="Outras condições de saúde"><input value={f.outrasCondicoes} onChange={muda('outrasCondicoes')} placeholder="Ex.: cirurgia recente, asma…" /></Campo>
      <Campo rotulo="Observações"><textarea rows={3} value={f.observacoes} onChange={muda('observacoes')} /></Campo>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Salvar cadastro</button>
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
  const [aba, setAba] = useState('cadastro');
  const [form, setForm] = useState(null); // 'cadastro' | 'agendamento' | 'aviso'
  const [cadastros, setCadastros] = useState(CONFIGURADO ? [] : DEMO.cadastros);
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : DEMO.agendamentos);
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : DEMO.avisos);
  const [voluntarios, setVoluntarios] = useState(CONFIGURADO ? [] : DEMO.voluntarios);

  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, onSnapshot, query, orderBy } = fb.fns;
    const escuta = (col, ord, poe) => onSnapshot(query(collection(fb.db, col), orderBy(...ord)), s => poe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const soltar = [
      escuta('cadastros', ['criadoEm', 'desc'], setCadastros),
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

  async function mudarStatus(c) {
    const status = PROXIMO_STATUS[c.status] || 'aguardando';
    if (!CONFIGURADO) {
      setCadastros(cs => cs.map(x => x.id === c.id ? { ...x, status } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'cadastros', c.id), { status });
  }

  if (form === 'cadastro') return <FormCadastro aoCancelar={() => setForm(null)} aoSalvar={f => salvar('cadastros', f, { status: 'aguardando', criadoEm: new Date() }, setCadastros)} />;
  if (form === 'agendamento') return <FormAgendamento aoCancelar={() => setForm(null)} aoSalvar={f => salvar('agendamentos', f, { origem: 'central', criadoEm: new Date() }, setAgendamentos)} />;
  if (form === 'aviso') return <FormAviso aoCancelar={() => setForm(null)} aoSalvar={f => salvar('avisos', f, { autor: usuario.nome, criadoEm: new Date() }, setAvisos)} />;

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <div className="logo-bolha"><ArvoreLogo tamanho={38} /></div>
          <div>
            <strong>Seja Semente</strong>
            <div className="status">Central · {usuario.nome}</div>
          </div>
        </div>
      </header>

      <main>
        {aba === 'cadastro' && (
          <>
            <div className="titulo-com-botao"><h2>Cadastros</h2><button className="btn-mais" onClick={() => setForm('cadastro')}>+ Novo</button></div>
            {cadastros.length ? cadastros.map(c => (
              <div className="cartao" key={c.id}>
                <div className="cartao-linha">
                  <Bolha nome={c.nome} />
                  <div>
                    <div className="cartao-topo">
                      <strong>{c.nome}</strong>
                      <button className={'chip ' + c.status.replace(' ', '-')} onClick={() => mudarStatus(c)}>{c.status}</button>
                    </div>
                    <p>{[c.especialidade, c.procedimento].filter(Boolean).join(' · ')}</p>
                    <p className="obs">{[c.idade ? `${c.idade} anos` : '', c.telefone].filter(Boolean).join(' · ')}</p>
                    {(c.saude?.length > 0 || c.outrasCondicoes) && (
                      <p className="saude">⚠️ {[...(c.saude || []), c.outrasCondicoes].filter(Boolean).join(', ')}</p>
                    )}
                    {c.observacoes && <p className="obs">{c.observacoes}</p>}
                  </div>
                </div>
              </div>
            )) : <div className="vazio">Nenhum cadastro ainda. Toque em "+ Novo".</div>}
          </>
        )}
        {aba === 'agenda' && (
          <>
            <div className="titulo-com-botao"><h2>Agenda</h2><button className="btn-mais" onClick={() => setForm('agendamento')}>+ Agendar</button></div>
            {agendamentos.length ? agendamentos.map(g => (
              <div className="cartao" key={g.id}>
                <div className="cartao-linha">
                  <Bolha nome={g.titulo} emoji="📅" />
                  <div>
                    <div className="cartao-topo">
                      <strong>{g.titulo}</strong>
                      <span className="quando">{dataBonita(g.data)} · {g.hora}</span>
                    </div>
                    {g.local && <p>📍 {g.local}</p>}
                    <p className="obs">{g.responsavel ? `Responsável: ${g.responsavel} · ` : ''}{g.origem === 'semeador' ? 'agendado por voluntário no Semeador' : 'agendado pela central'}</p>
                  </div>
                </div>
              </div>
            )) : <div className="vazio">Nada agendado ainda.</div>}
          </>
        )}
        {aba === 'avisos' && (
          <>
            <div className="titulo-com-botao"><h2>Avisos</h2><button className="btn-mais" onClick={() => setForm('aviso')}>+ Novo</button></div>
            {avisos.length ? avisos.map(a => (
              <div className="cartao" key={a.id}>
                <div className="cartao-linha">
                  <Bolha nome={a.titulo} emoji="📢" />
                  <div>
                    <strong>{a.titulo}</strong>
                    <p>{a.texto}</p>
                    {a.autor && <div className="obs">— {a.autor}</div>}
                  </div>
                </div>
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
                  <div className="cartao-linha">
                    <Bolha nome={v.nome} />
                    <div>
                      <div className="cartao-topo"><strong>{v.nome}</strong>{v.ativo === false && <span className="chip aguardando">inativo</span>}</div>
                      <p>{[v.ministerio, v.telefone].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                </div>
              )) : <div className="vazio">Nenhum voluntário cadastrado.</div>}
              <button className="btn-sair" onClick={aoSair}>Sair</button>
            </>
          );
        })()}
      </main>

      <nav>
        <button className={aba === 'cadastro' ? 'ativo' : ''} onClick={() => setAba('cadastro')}>📋<span>Cadastro</span></button>
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
        setUsuario(u ? { uid: u.uid, email: u.email, nome: u.displayName || u.email } : null);
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
  if (!usuario) return <TelaLogin aoEntrarDemo={setUsuario} />;
  return <TelaPrincipal usuario={usuario} aoSair={sair} />;
}

createRoot(document.getElementById('root')).render(<App />);
