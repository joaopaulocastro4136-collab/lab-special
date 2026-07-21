// ═══════════════════════════════════════════════════════════════════════════
//  SEJA SEMENTE — aplicativo central do projeto (versão mobile)
//
//  Fluxo de atendimento:
//    1. CADASTRO — o paciente entra no sistema (nome, contato)
//    2. TRIAGEM — define especialidade, procedimento, ficha de saúde e o
//       PROFISSIONAL (dentista/voluntário) que vai atender; a partir daí o
//       paciente fica visível no Semeador do profissional escolhido
//    3. AGENDA — marca o paciente num dia e horário (estilo Google Agenda)
//
//  Windows, este aplicativo e o Semeador conversam pelo mesmo Firebase —
//  o contrato de dados está em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal } from '../logo.jsx';
import { ClipboardList, CalendarDays, Megaphone, Users, MapPin, TriangleAlert } from 'lucide-react';
import icone from '../icones/icone-central-1024.png';

// A logo do aplicativo (a mesma do ícone), em tamanho de tela
function LogoApp({ tamanho = 120 }) {
  return <img src={icone} width={tamanho} height={tamanho} alt="Seja Semente"
    style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }} />;
}

const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null;

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } = await import('firebase/auth');
  const { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, query, orderBy, serverTimestamp } = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  fb = {
    auth: getAuth(app),
    db: getFirestore(app),
    fns: { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, collection, doc, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, query, orderBy, serverTimestamp },
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
const PROXIMO_STATUS = { 'triado': 'em atendimento', 'em atendimento': 'concluído', 'concluído': 'triado' };

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'central-demo', nome: 'Coordenação (teste)' },
  pacientes: [
    { id: 'p1', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', observacoes: 'Sente dor no dente há duas semanas.', status: 'triado', criadoEm: new Date(), triagem: { especialidade: 'Odontologia', procedimento: 'Extração', saude: ['Hipertensão / pressão alta'], outrasCondicoes: '', profissionalUid: 'v1', profissionalNome: 'Maria Souza' } },
    { id: 'p2', nome: 'Ana Paula', idade: '34', telefone: '(11) 94444-2222', observacoes: 'Chegou pela campanha do agasalho.', status: 'cadastrado', criadoEm: new Date(Date.now() - 864e5), triagem: null },
    { id: 'p3', nome: 'Carlos Mendes', idade: '41', telefone: '(11) 97777-2222', observacoes: '', status: 'concluído', criadoEm: new Date(Date.now() - 3 * 864e5), triagem: { especialidade: 'Médico (clínico geral)', procedimento: 'Consulta', saude: ['Diabetes', 'Medicação contínua'], outrasCondicoes: 'Insulina 2x ao dia', profissionalUid: 'v2', profissionalNome: 'Pedro Lima' } },
  ],
  agendamentos: [
    { id: 'g1', pacienteId: 'p1', pacienteNome: 'José da Silva', titulo: 'Extração · Odontologia', data: hojeISO(), hora: '14:00', profissionalNome: 'Maria Souza', origem: 'central', criadoEm: new Date() },
    { id: 'g2', pacienteId: 'p3', pacienteNome: 'Carlos Mendes', titulo: 'Consulta · Médico', data: hojeISO(), hora: '15:30', profissionalNome: 'Pedro Lima', origem: 'central', criadoEm: new Date() },
  ],
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo à central Seja Semente!', texto: 'Fluxo do atendimento: cadastre o paciente, faça a triagem (escolhendo o profissional) e marque na agenda do dia.', autor: 'Sistema', criadoEm: new Date() },
  ],
  voluntarios: [
    { id: 'v1', nome: 'Maria Souza', ministerio: 'Odontologia', telefone: '(11) 91234-5678', status: 'ativo', ativo: true },
    { id: 'v2', nome: 'Pedro Lima', ministerio: 'Médico', telefone: '(11) 99876-5432', status: 'ativo', ativo: true },
    { id: 'v3', nome: 'Lucas Andrade', email: 'lucas.andrade@gmail.com', telefone: '(11) 95555-4444', cpf: '123.456.789-00', nascimento: '1995-03-14', status: 'pendente', ativo: false },
  ],
};

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function somaDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
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
      <h1>Seja Semente</h1>
      <p className="login-sub">Central do projeto</p>
      <p className="missao">Um mundo onde cada semente pode <em>florescer</em>.</p>
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

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

// 1º passo: só coloca o paciente no sistema
function FormPaciente({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ nome: '', idade: '', telefone: '', observacoes: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Novo paciente</h2>
      <p className="dica">Primeiro o cadastro. A triagem (procedimento e profissional) vem depois, no cartão do paciente.</p>
      <Campo rotulo="Nome do paciente"><input value={f.nome} onChange={muda('nome')} /></Campo>
      <Campo rotulo="Idade"><input value={f.idade} onChange={muda('idade')} inputMode="numeric" /></Campo>
      <Campo rotulo="Telefone"><input value={f.telefone} onChange={muda('telefone')} inputMode="tel" /></Campo>
      <Campo rotulo="Observações"><textarea rows={3} value={f.observacoes} onChange={muda('observacoes')} /></Campo>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Cadastrar</button>
      </div>
    </div>
  );
}

// 2º passo: a triagem — procedimento, saúde e o profissional que vai atender
function FormTriagem({ paciente, profissionais, aoSalvar, aoCancelar }) {
  const [f, setF] = useState({
    especialidade: Object.keys(ESPECIALIDADES)[0],
    procedimento: ESPECIALIDADES[Object.keys(ESPECIALIDADES)[0]][0],
    saude: [], outrasCondicoes: '',
    profissionalUid: profissionais[0]?.id || '',
  });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const mudaEspecialidade = e => setF({ ...f, especialidade: e.target.value, procedimento: ESPECIALIDADES[e.target.value][0] });
  const alternaSaude = c => setF({ ...f, saude: f.saude.includes(c) ? f.saude.filter(x => x !== c) : [...f.saude, c] });
  const prof = profissionais.find(p => p.id === f.profissionalUid);
  return (
    <div className="folha">
      <h2>Triagem — {paciente.nome}</h2>
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
      <Campo rotulo="Profissional que vai atender">
        <select value={f.profissionalUid} onChange={muda('profissionalUid')}>
          {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ministerio ? ` — ${p.ministerio}` : ''}</option>)}
        </select>
      </Campo>
      <p className="dica">Depois da triagem, o paciente aparece no Semeador do profissional escolhido e já pode entrar na agenda.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.profissionalUid} onClick={() => aoSalvar({ ...f, profissionalNome: prof?.nome || '' })}>Concluir triagem</button>
      </div>
    </div>
  );
}

// 3º passo: marcar o paciente num dia e horário
function FormMarcar({ pacientes, dataInicial, aoSalvar, aoCancelar }) {
  const triados = pacientes.filter(p => p.triagem);
  const [f, setF] = useState({ pacienteId: triados[0]?.id || '', data: dataInicial, hora: '09:00' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const pac = triados.find(p => p.id === f.pacienteId);
  return (
    <div className="folha">
      <h2>Marcar na agenda</h2>
      {triados.length === 0 && <p className="dica">Nenhum paciente com triagem feita ainda — cadastre e faça a triagem primeiro.</p>}
      <Campo rotulo="Paciente">
        <select value={f.pacienteId} onChange={muda('pacienteId')}>
          {triados.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.triagem.procedimento}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data"><input type="date" value={f.data} onChange={muda('data')} /></Campo>
      <Campo rotulo="Hora"><input type="time" value={f.hora} onChange={muda('hora')} /></Campo>
      {pac && <p className="dica">Profissional: {pac.triagem.profissionalNome} · {pac.triagem.especialidade}</p>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!pac} onClick={() => aoSalvar({
          pacienteId: pac.id, pacienteNome: pac.nome,
          titulo: `${pac.triagem.procedimento} · ${pac.triagem.especialidade}`,
          data: f.data, hora: f.hora, profissionalNome: pac.triagem.profissionalNome, profissionalUid: pac.triagem.profissionalUid,
        })}>Marcar</button>
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
  const [aba, setAba] = useState('pacientes');
  const [form, setForm] = useState(null); // 'paciente' | 'aviso' | 'marcar' | {triagem: paciente}
  const [dia, setDia] = useState(hojeISO());
  const [pacientes, setPacientes] = useState(CONFIGURADO ? [] : lerLocal('ss-pacientes', DEMO.pacientes));
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : lerLocal('ss-agendamentos', DEMO.agendamentos));
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : lerLocal('ss-avisos', DEMO.avisos));
  const [voluntarios, setVoluntarios] = useState(CONFIGURADO ? [] : lerLocal('ss-voluntarios', DEMO.voluntarios));

  // Sem Firebase, tudo que você cadastra fica salvo no aparelho
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-pacientes', pacientes); }, [pacientes]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-agendamentos', agendamentos); }, [agendamentos]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-avisos', avisos); }, [avisos]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-voluntarios', voluntarios); }, [voluntarios]);

  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, onSnapshot, query, orderBy } = fb.fns;
    const escuta = (col, ord, poe) => onSnapshot(query(collection(fb.db, col), orderBy(...ord)), s => poe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const soltar = [
      escuta('pacientes', ['criadoEm', 'desc'], setPacientes),
      escuta('agendamentos', ['hora'], setAgendamentos),
      escuta('avisos', ['criadoEm', 'desc'], setAvisos),
      escuta('voluntarios', ['nome'], setVoluntarios),
    ];
    return () => soltar.forEach(s => s());
  }, []);

  // Batimento da central: o Semeador mostra "Central conectada"
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
      poe(xs => [{ id: 'novo-' + Math.floor(Math.random() * 1e6), ...local, ...dados }, ...xs]);
      setForm(null);
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, col), { ...dados, ...local, criadoEm: serverTimestamp() });
    setForm(null);
  }

  async function salvarTriagem(paciente, triagem) {
    if (!CONFIGURADO) {
      setPacientes(ps => ps.map(p => p.id === paciente.id ? { ...p, triagem, status: 'triado' } : p));
      setForm(null);
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'pacientes', paciente.id), { triagem, status: 'triado' });
    setForm(null);
  }

  async function removerAgendamento(g) {
    if (!CONFIGURADO) {
      setAgendamentos(gs => gs.filter(x => x.id !== g.id));
      return;
    }
    const { doc, deleteDoc } = fb.fns;
    await deleteDoc(doc(fb.db, 'agendamentos', g.id));
  }

  async function responderSolicitacao(v, aprovar) {
    const mudanca = aprovar ? { status: 'ativo', ativo: true } : { status: 'recusado', ativo: false };
    if (!CONFIGURADO) {
      setVoluntarios(vs => vs.map(x => x.id === v.id ? { ...x, ...mudanca } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'voluntarios', v.id), mudanca);
  }

  async function mudarStatus(p) {
    if (!p.triagem) return;
    const status = PROXIMO_STATUS[p.status] || 'triado';
    if (!CONFIGURADO) {
      setPacientes(ps => ps.map(x => x.id === p.id ? { ...x, status } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'pacientes', p.id), { status });
  }

  const profissionais = voluntarios.filter(v => v.status === 'ativo' || v.ativo === true);

  if (form === 'paciente') return <FormPaciente aoCancelar={() => setForm(null)} aoSalvar={f => salvar('pacientes', f, { status: 'cadastrado', triagem: null, criadoEm: new Date() }, setPacientes)} />;
  if (form === 'marcar') return <FormMarcar pacientes={pacientes} dataInicial={dia} aoCancelar={() => setForm(null)} aoSalvar={f => salvar('agendamentos', f, { origem: 'central', criadoEm: new Date() }, setAgendamentos)} />;
  if (form === 'aviso') return <FormAviso aoCancelar={() => setForm(null)} aoSalvar={f => salvar('avisos', f, { autor: usuario.nome, criadoEm: new Date() }, setAvisos)} />;
  if (form?.triagem) return <FormTriagem paciente={form.triagem} profissionais={profissionais} aoCancelar={() => setForm(null)} aoSalvar={t => salvarTriagem(form.triagem, t)} />;

  const doDia = agendamentos.filter(g => g.data === dia).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={40} /></div>
          <div>
            <strong>Seja Semente</strong>
            <div className="status">Central · {usuario.nome}</div>
          </div>
        </div>
      </header>

      <main>
        {aba === 'pacientes' && (
          <>
            <div className="titulo-com-botao"><h2>Pacientes</h2><button className="btn-mais" onClick={() => setForm('paciente')}>+ Cadastrar</button></div>
            {pacientes.length ? pacientes.map(p => (
              <div className="cartao" key={p.id}>
                <div className="cartao-linha">
                  <Bolha nome={p.nome} />
                  <div>
                    <div className="cartao-topo">
                      <strong>{p.nome}</strong>
                      {p.triagem
                        ? <button className={'chip ' + p.status.replace(' ', '-')} onClick={() => mudarStatus(p)}>{p.status}</button>
                        : <span className="chip aguardando">sem triagem</span>}
                    </div>
                    {p.triagem && <p>{p.triagem.especialidade} · {p.triagem.procedimento} · com {p.triagem.profissionalNome}</p>}
                    <p className="obs">{[p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                    {p.triagem && (p.triagem.saude?.length > 0 || p.triagem.outrasCondicoes) && (
                      <p className="saude"><TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{[...(p.triagem.saude || []), p.triagem.outrasCondicoes].filter(Boolean).join(', ')}</p>
                    )}
                    {p.observacoes && <p className="obs">{p.observacoes}</p>}
                    {!p.triagem && <button className="btn-triagem" onClick={() => setForm({ triagem: p })}>Fazer triagem</button>}
                  </div>
                </div>
              </div>
            )) : <div className="vazio">Nenhum paciente ainda. Toque em "+ Cadastrar".</div>}
          </>
        )}
        {aba === 'agenda' && (
          <>
            <div className="titulo-com-botao"><h2>Agenda</h2><button className="btn-mais" onClick={() => setForm('marcar')}>+ Marcar</button></div>
            <div className="dia-nav">
              <button onClick={() => setDia(somaDias(dia, -1))}>‹</button>
              <div className="dia-titulo">
                <strong>{dataBonita(dia)}</strong>
                {dia !== hojeISO() && <span onClick={() => setDia(hojeISO())} style={{ cursor: 'pointer' }}>voltar para hoje</span>}
                {dia === hojeISO() && <span>hoje</span>}
              </div>
              <button onClick={() => setDia(somaDias(dia, 1))}>›</button>
            </div>
            {doDia.length ? doDia.map(g => (
              <div className="cartao" key={g.id}>
                <div className="linha-agenda">
                  <div className="hora-col">{g.hora}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{g.pacienteNome || g.titulo}</strong>
                    {g.pacienteNome && g.titulo && <p style={{ marginTop: 3 }}>{g.titulo}</p>}
                    {g.profissionalNome && <p className="obs">com {g.profissionalNome}{g.origem === 'semeador' ? ' · marcado no Semeador' : ''}</p>}
                  </div>
                  <button className="btn-remover" onClick={() => removerAgendamento(g)} title="Remover">✕</button>
                </div>
              </div>
            )) : <div className="vazio">Nada marcado em {dataBonita(dia)}.<br />Toque em "+ Marcar".</div>}
          </>
        )}
        {aba === 'avisos' && (
          <>
            <div className="titulo-com-botao"><h2>Avisos</h2><button className="btn-mais" onClick={() => setForm('aviso')}>+ Novo</button></div>
            {avisos.length ? avisos.map(a => (
              <div className="cartao" key={a.id}>
                <div className="cartao-linha">
                  <Bolha nome={a.titulo} Icone={Megaphone} />
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
        <button className={aba === 'pacientes' ? 'ativo' : ''} onClick={() => setAba('pacientes')}><ClipboardList size={23} /><span>Pacientes</span></button>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}><CalendarDays size={23} /><span>Agenda</span></button>
        <button className={aba === 'avisos' ? 'ativo' : ''} onClick={() => setAba('avisos')}><Megaphone size={23} /><span>Avisos</span></button>
        <button className={aba === 'equipe' ? 'ativo' : ''} onClick={() => setAba('equipe')}>
          <span className="icone-aba"><Users size={23} />{voluntarios.some(v => v.status === 'pendente') && <i className="bolinha" />}</span>
          <span>Equipe</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(CONFIGURADO ? null : lerLocal('ss-usuario', null));

  // Sem Firebase, a entrada fica salva no aparelho (não pede login toda vez)
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-usuario', usuario); }, [usuario]);

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

  if (!pronto) return <div className="carregando"><LogoApp tamanho={96} /></div>;
  if (!usuario) return <TelaLogin aoEntrarDemo={setUsuario} />;
  return <TelaPrincipal usuario={usuario} aoSair={sair} />;
}

createRoot(document.getElementById('root')).render(<App />);
