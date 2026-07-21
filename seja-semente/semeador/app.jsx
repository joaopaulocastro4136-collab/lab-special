// ═══════════════════════════════════════════════════════════════════════════
//  SEMEADOR — aplicativo do voluntário do projeto Seja Semente
//
//  O aplicativo conversa com a central (o programa Windows instalado na
//  máquina do projeto) através do Firebase: os dois leem e escrevem no
//  mesmo banco (Firestore), em tempo real. O contrato de dados que os dois
//  lados seguem está descrito em PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal } from '../logo.jsx';
import { Home, ClipboardList, CalendarDays, ListChecks, User, Megaphone, MapPin, TriangleAlert } from 'lucide-react';
import icone from '../icones/icone-semeador-1024.png';

// A logo do aplicativo (a mesma do ícone), em tamanho de tela
function LogoApp({ tamanho = 120 }) {
  return <img src={icone} width={tamanho} height={tamanho} alt="Semeador"
    style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }} />;
}

// ─── Modo demonstração: enquanto o Firebase não estiver configurado, o app
//     roda sozinho com dados de exemplo para dar pra ver e testar tudo ───
const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null; // { auth, db, fns } — só existe quando o Firebase está ligado

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } = await import('firebase/auth');
  const { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, query, orderBy, serverTimestamp } = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  fb = {
    auth: getAuth(app),
    db: getFirestore(app),
    fns: { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, query, orderBy, serverTimestamp },
  };
}

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'demo-1', nome: 'Voluntário de Teste', ministerio: 'Acolhimento' },
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo ao Semeador!', texto: 'Este é o aplicativo do voluntário do Seja Semente. Aqui você recebe avisos da central, vê suas escalas e confirma presença.', criadoEm: new Date(), autor: 'Central' },
    { id: 'a2', titulo: 'Mutirão de sábado', texto: 'Neste sábado teremos mutirão de arrecadação de alimentos. Quem puder chegar às 8h, a van sai do ponto de encontro às 8h30.', criadoEm: new Date(Date.now() - 864e5), autor: 'Coordenação' },
  ],
  escalas: [
    { id: 'e1', data: proximoDia(6), hora: '08:00', ministerio: 'Acolhimento', local: 'Sede Seja Semente', voluntarios: [{ uid: 'demo-1', nome: 'Voluntário de Teste' }], confirmados: {} },
    { id: 'e2', data: proximoDia(0), hora: '17:30', ministerio: 'Distribuição', local: 'Praça Central', voluntarios: [{ uid: 'demo-1', nome: 'Voluntário de Teste' }], confirmados: { 'demo-1': true } },
  ],
  agendamentos: [
    { id: 'g1', titulo: 'Entrega de cestas', data: proximoDia(6), hora: '09:00', local: 'Sede Seja Semente', responsavel: 'Coordenação', origem: 'central' },
    { id: 'g2', titulo: 'Visita à família do José', data: proximoDia(3), hora: '15:00', local: 'Praça Central', responsavel: 'Maria', origem: 'semeador' },
  ],
  pacientes: [
    { id: 'p1', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', status: 'triado', observacoes: 'Sente dor no dente há duas semanas.', triagem: { especialidade: 'Odontologia', procedimento: 'Extração', saude: ['Hipertensão / pressão alta'], outrasCondicoes: '', profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade' } },
    { id: 'p4', nome: 'Rita Nascimento', idade: '60', telefone: '(11) 93333-8888', status: 'em atendimento', observacoes: '', triagem: { especialidade: 'Odontologia', procedimento: 'Prótese', saude: ['Diabetes'], outrasCondicoes: '', profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade' } },
  ],
  centralOnline: false,
};

function proximoDia(diaSemana) {
  const d = new Date();
  d.setDate(d.getDate() + ((diaSemana - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// ─── Utilidades ───
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
function horaBonita(v) {
  const d = v?.toDate ? v.toDate() : v instanceof Date ? v : null;
  if (!d) return '';
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return mesmoDia ? `hoje às ${hm}` : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hm}`;
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
      aoEntrarDemo({ uid: 'demo-google', nome: 'Lucas Andrade', email: 'lucas.andrade@gmail.com' });
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

  const [novaConta, setNovaConta] = useState(false);

  async function entrarEmail() {
    setErro('');
    setCarregando(true);
    try {
      if (novaConta) await fb.fns.createUserWithEmailAndPassword(fb.auth, email.trim(), senha);
      else await fb.fns.signInWithEmailAndPassword(fb.auth, email.trim(), senha);
    } catch (e) {
      setErro(novaConta
        ? 'Não consegui criar a conta — a senha precisa de 6 ou mais caracteres e o e-mail ser válido (ou já existe conta com ele).'
        : 'Não consegui entrar. Confira o e-mail e a senha.');
    }
    setCarregando(false);
  }

  return (
    <div className="tela-login">
      <LogoApp tamanho={132} />
      <h1>Semeador</h1>
      <p className="login-sub">Aplicativo do voluntário · Seja Semente</p>
      <p className="missao">Quem planta o bem, <em>colhe vidas</em>.</p>
      {!CONFIGURADO && <div className="faixa-demo">Modo demonstração — o Firebase ainda não foi configurado (veja o README.md)</div>}
      <button className="btn-google" onClick={entrarGoogle} disabled={carregando}>
        <span className="g">G</span> Entrar com Google
      </button>
      {CONFIGURADO && (
        <>
          <div className="separador">ou com e-mail</div>
          <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder={novaConta ? 'Crie uma senha (6+ caracteres)' : 'Senha'} type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrarEmail()} />
          <button className="btn-principal" onClick={entrarEmail} disabled={carregando}>
            {carregando ? 'Um instante…' : (novaConta ? 'Criar conta' : 'Entrar')}
          </button>
          <button className="link-troca" onClick={() => { setNovaConta(!novaConta); setErro(''); }}>
            {novaConta ? 'Já tenho conta — entrar' : 'Primeira vez? Criar conta com e-mail'}
          </button>
        </>
      )}
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}

// ─── Primeira entrada: o voluntário preenche o cadastro, que vira uma
//     solicitação para a central Seja Semente aprovar ───
function TelaCadastro({ usuario, aoEnviar }) {
  const [f, setF] = useState({ nome: usuario.nome || '', telefone: '', cpf: '', nascimento: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const cpfOk = f.cpf.replace(/\D/g, '').length === 11;
  const pronto = f.nome.trim() && f.telefone.trim() && cpfOk && f.nascimento;
  return (
    <div className="folha">
      <h2>Cadastro de voluntário</h2>
      <p className="dica">Bem-vindo! Preencha seus dados — eles vão para a central Seja Semente, que aprova a sua entrada como voluntário.</p>
      <Campo rotulo="Nome completo"><input value={f.nome} onChange={muda('nome')} /></Campo>
      <Campo rotulo="Telefone (WhatsApp)"><input value={f.telefone} onChange={muda('telefone')} inputMode="tel" placeholder="(11) 91234-5678" /></Campo>
      <Campo rotulo="CPF"><input value={f.cpf} onChange={muda('cpf')} inputMode="numeric" placeholder="000.000.000-00" /></Campo>
      <Campo rotulo="Data de nascimento"><input type="date" value={f.nascimento} onChange={muda('nascimento')} /></Campo>
      {f.cpf && !cpfOk && <div className="erro">O CPF precisa ter 11 números.</div>}
      <button className="btn-principal" disabled={!pronto} onClick={() => aoEnviar(f)}>Enviar solicitação</button>
    </div>
  );
}

function TelaAguardando({ usuario, aoSair, aoSimularAprovacao }) {
  return (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Solicitação enviada!</h1>
      <p className="login-sub">Seu cadastro foi enviado para a central Seja Semente.<br />Assim que a coordenação aprovar, você entra como voluntário — o aplicativo libera sozinho, na hora.</p>
      {!CONFIGURADO && <button className="btn-principal" onClick={aoSimularAprovacao}>(demonstração) Simular aprovação da central</button>}
      <button className="btn-sair" onClick={aoSair}>Sair</button>
    </div>
  );
}

function TelaRecusado({ aoSair }) {
  return (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Cadastro não aprovado</h1>
      <p className="login-sub">A central Seja Semente não aprovou esta solicitação.<br />Fale com a coordenação se achar que foi um engano.</p>
      <button className="btn-sair" onClick={aoSair}>Sair</button>
    </div>
  );
}

function CartaoAviso({ aviso }) {
  return (
    <div className="cartao">
      <div className="cartao-linha">
        <Bolha nome={aviso.titulo} Icone={Megaphone} />
        <div>
          <div className="cartao-topo">
            <strong>{aviso.titulo}</strong>
            <span className="quando">{horaBonita(aviso.criadoEm)}</span>
          </div>
          <p>{aviso.texto}</p>
          {aviso.autor && <div className="autor">— {aviso.autor}</div>}
        </div>
      </div>
    </div>
  );
}

function CartaoEscala({ escala, uid, aoConfirmar }) {
  const confirmado = !!escala.confirmados?.[uid];
  return (
    <div className="cartao">
      <div className="cartao-linha">
        <Bolha nome={escala.ministerio} Icone={ListChecks} />
        <div>
          <div className="cartao-topo">
            <strong>{escala.ministerio}</strong>
            <span className="quando">{dataBonita(escala.data)} · {escala.hora}</span>
          </div>
          {escala.local && <p><MapPin size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{escala.local}</p>}
          <div className="linha-confirma">
            {confirmado
              ? <span className="ok">✓ Presença confirmada</span>
              : <button className="btn-confirmar" onClick={() => aoConfirmar(escala)}>Confirmar presença</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Vazio({ texto }) {
  return <div className="vazio">{texto}</div>;
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

function FormAgendamento({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ titulo: '', data: hojeISO(), hora: '09:00', local: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Novo agendamento</h2>
      <Campo rotulo="O quê"><input value={f.titulo} onChange={muda('titulo')} placeholder="Ex.: Visita à família do José" /></Campo>
      <Campo rotulo="Data"><input type="date" value={f.data} onChange={muda('data')} /></Campo>
      <Campo rotulo="Hora"><input type="time" value={f.hora} onChange={muda('hora')} /></Campo>
      <Campo rotulo="Local"><input value={f.local} onChange={muda('local')} /></Campo>
      <p className="dica">O agendamento aparece na hora na central Seja Semente e para os outros voluntários.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.titulo.trim()} onClick={() => aoSalvar(f)}>Agendar</button>
      </div>
    </div>
  );
}

function TelaPrincipal({ usuario, aoSair }) {
  const [aba, setAba] = useState('inicio');
  const [formAgenda, setFormAgenda] = useState(false);
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : DEMO.avisos);
  const [escalas, setEscalas] = useState(CONFIGURADO ? [] : lerLocal('sd-escalas', DEMO.escalas));
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : lerLocal('sd-agendamentos', DEMO.agendamentos));
  const [pacientes, setPacientes] = useState(CONFIGURADO ? [] : DEMO.pacientes);

  // Sem Firebase, o que você faz fica salvo no aparelho
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-escalas', escalas); }, [escalas]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-agendamentos', agendamentos); }, [agendamentos]);
  const [centralOnline, setCentralOnline] = useState(DEMO.centralOnline);

  // Escuta o Firestore em tempo real: qualquer coisa que a central (programa
  // Windows) escrever aparece aqui na hora, sem precisar atualizar nada.
  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, doc, onSnapshot, query, orderBy } = fb.fns;
    const paraAvisos = onSnapshot(
      query(collection(fb.db, 'avisos'), orderBy('criadoEm', 'desc')),
      snap => setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const paraEscalas = onSnapshot(
      query(collection(fb.db, 'escalas'), orderBy('data')),
      snap => setEscalas(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.voluntarios?.some(v => v.uid === usuario.uid)))
    );
    const paraAgenda = onSnapshot(
      query(collection(fb.db, 'agendamentos'), orderBy('data')),
      snap => setAgendamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Pacientes que a triagem da central designou para ESTE voluntário
    const paraPacientes = onSnapshot(
      query(collection(fb.db, 'pacientes'), orderBy('criadoEm', 'desc')),
      snap => setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.triagem?.profissionalUid === usuario.uid))
    );
    // Batimento da central: o programa Windows atualiza central/status a cada
    // minuto; se o último batimento tem menos de 3 minutos, ela está online.
    const paraCentral = onSnapshot(doc(fb.db, 'central', 'status'), snap => {
      const s = snap.data();
      const ultimo = s?.atualizadoEm?.toDate?.();
      setCentralOnline(!!ultimo && Date.now() - ultimo.getTime() < 3 * 60 * 1000);
    });
    return () => { paraAvisos(); paraEscalas(); paraAgenda(); paraPacientes(); paraCentral(); };
  }, [usuario.uid]);

  async function confirmar(escala) {
    if (!CONFIGURADO) {
      setEscalas(es => es.map(e => e.id === escala.id ? { ...e, confirmados: { ...e.confirmados, [usuario.uid]: true } } : e));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'escalas', escala.id), { [`confirmados.${usuario.uid}`]: true });
  }

  async function agendar(f) {
    const novo = { ...f, responsavel: usuario.nome, origem: 'semeador' };
    if (!CONFIGURADO) {
      setAgendamentos(gs => [...gs, { id: 'novo-' + gs.length, ...novo }].sort((a, b) => a.data.localeCompare(b.data)));
      setFormAgenda(false);
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, 'agendamentos'), { ...novo, criadoEm: serverTimestamp() });
    setFormAgenda(false);
  }

  if (formAgenda) return <FormAgendamento aoCancelar={() => setFormAgenda(false)} aoSalvar={agendar} />;

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={40} /></div>
          <div>
            <strong>Semeador</strong>
            <div className={centralOnline ? 'status online' : 'status'}>
              {centralOnline ? '● Central conectada' : '○ Central offline'} · {usuario.nome?.split(' ')[0]}
            </div>
          </div>
        </div>
      </header>

      <main>
        {aba === 'inicio' && (
          <>
            <h2>Avisos</h2>
            {avisos.length ? avisos.map(a => <CartaoAviso key={a.id} aviso={a} />) : <Vazio texto="Nenhum aviso por enquanto." />}
          </>
        )}
        {aba === 'escalas' && (
          <>
            <h2>Minhas escalas</h2>
            {escalas.length ? escalas.map(e => <CartaoEscala key={e.id} escala={e} uid={usuario.uid} aoConfirmar={confirmar} />) : <Vazio texto="Você ainda não está em nenhuma escala." />}
          </>
        )}
        {aba === 'pacientes' && (
          <>
            <h2>Meus pacientes</h2>
            {pacientes.length ? pacientes.map(p => (
              <div className="cartao" key={p.id}>
                <div className="cartao-linha">
                  <Bolha nome={p.nome} />
                  <div>
                    <div className="cartao-topo">
                      <strong>{p.nome}</strong>
                      <span className={'chip ' + (p.status || 'triado').replace(' ', '-')}>{p.status || 'triado'}</span>
                    </div>
                    <p>{p.triagem.especialidade} · {p.triagem.procedimento}</p>
                    <p className="obs">{[p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                    {(p.triagem.saude?.length > 0 || p.triagem.outrasCondicoes) && (
                      <p className="saude"><TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{[...(p.triagem.saude || []), p.triagem.outrasCondicoes].filter(Boolean).join(', ')}</p>
                    )}
                    {p.observacoes && <p className="obs">{p.observacoes}</p>}
                  </div>
                </div>
              </div>
            )) : <Vazio texto="Nenhum paciente designado para você ainda — quando a central fizer uma triagem no seu nome, ele aparece aqui." />}
          </>
        )}
        {aba === 'agenda' && (
          <>
            <div className="titulo-com-botao"><h2>Agenda</h2><button className="btn-mais" onClick={() => setFormAgenda(true)}>+ Agendar</button></div>
            {agendamentos.length ? agendamentos.map(g => (
              <div className="cartao" key={g.id}>
                <div className="cartao-linha">
                  <Bolha nome={g.titulo} Icone={CalendarDays} />
                  <div>
                    <div className="cartao-topo">
                      <strong>{g.titulo}</strong>
                      <span className="quando">{dataBonita(g.data)} · {g.hora}</span>
                    </div>
                    {g.local && <p><MapPin size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{g.local}</p>}
                    <p className="obs">{g.responsavel ? `Responsável: ${g.responsavel} · ` : ''}{g.origem === 'semeador' ? 'agendado por voluntário' : 'agendado pela central'}</p>
                  </div>
                </div>
              </div>
            )) : <Vazio texto="Nada agendado ainda. Toque em + Agendar." />}
          </>
        )}
        {aba === 'perfil' && (
          <>
            <h2>Meu perfil</h2>
            <div className="cartao">
              <div className="cartao-linha">
                <Bolha nome={usuario.nome} />
                <div>
                  <p style={{ marginTop: 0 }}><strong>{usuario.nome}</strong></p>
                  {usuario.ministerio && <p>Ministério: {usuario.ministerio}</p>}
                  {usuario.email && <p>{usuario.email}</p>}
                  {usuario.telefone && <p>{usuario.telefone}</p>}
                </div>
              </div>
            </div>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'inicio' ? 'ativo' : ''} onClick={() => setAba('inicio')}><Home size={23} /><span>Início</span></button>
        <button className={aba === 'pacientes' ? 'ativo' : ''} onClick={() => setAba('pacientes')}><ClipboardList size={23} /><span>Pacientes</span></button>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}><CalendarDays size={23} /><span>Agenda</span></button>
        <button className={aba === 'escalas' ? 'ativo' : ''} onClick={() => setAba('escalas')}><ListChecks size={23} /><span>Escalas</span></button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}><User size={23} /><span>Perfil</span></button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [conta, setConta] = useState(CONFIGURADO ? null : lerLocal('sd-conta', null));       // quem entrou (Google ou e-mail)
  const [cadastro, setCadastro] = useState(CONFIGURADO ? null : lerLocal('sd-cadastro', null)); // documento voluntarios/{uid}

  // Sem Firebase, a conta e o cadastro ficam salvos no aparelho (não pede
  // login toda vez — comportamento de aplicativo de verdade)
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-conta', conta); }, [conta]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-cadastro', cadastro); }, [cadastro]);

  useEffect(() => {
    if (!CONFIGURADO) return;
    let soltarAuth = null, soltarDoc = null;
    ligarFirebase().then(() => {
      soltarAuth = fb.fns.onAuthStateChanged(fb.auth, u => {
        soltarDoc?.(); soltarDoc = null;
        if (!u) { setConta(null); setCadastro(null); setPronto(true); return; }
        setConta({ uid: u.uid, email: u.email, nome: u.displayName || u.email, foto: u.photoURL || '' });
        // O cadastro fica em voluntarios/{uid}: se não existe, o voluntário
        // preenche a solicitação; quando a central aprovar (status "ativo"),
        // o app libera sozinho — o snapshot chega em tempo real.
        const { doc, onSnapshot } = fb.fns;
        soltarDoc = onSnapshot(doc(fb.db, 'voluntarios', u.uid), snap => {
          setCadastro(snap.exists() ? snap.data() : null);
          setPronto(true);
        });
      });
    });
    return () => { soltarDoc?.(); soltarAuth?.(); };
  }, []);

  async function enviarCadastro(f) {
    const dados = { ...f, email: conta.email || '', foto: conta.foto || '', status: 'pendente', ativo: false };
    if (!CONFIGURADO) { setCadastro(dados); return; }
    const { doc, setDoc, serverTimestamp } = fb.fns;
    await setDoc(doc(fb.db, 'voluntarios', conta.uid), { ...dados, solicitadoEm: serverTimestamp() });
  }

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    setConta(null);
    setCadastro(null);
  }

  if (!pronto) return <div className="carregando"><LogoApp tamanho={96} /></div>;
  if (!conta) return <TelaLogin aoEntrarDemo={setConta} />;
  if (!cadastro) return <TelaCadastro usuario={conta} aoEnviar={enviarCadastro} />;
  if (cadastro.status === 'pendente') return <TelaAguardando usuario={conta} aoSair={sair} aoSimularAprovacao={() => setCadastro({ ...cadastro, status: 'ativo', ativo: true })} />;
  if (cadastro.status === 'recusado') return <TelaRecusado aoSair={sair} />;
  return <TelaPrincipal usuario={{ ...conta, ...cadastro }} aoSair={sair} />;
}

createRoot(document.getElementById('root')).render(<App />);
