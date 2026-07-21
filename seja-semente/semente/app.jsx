// ═══════════════════════════════════════════════════════════════════════════
//  SEJA SEMENTE — aplicativo central do projeto (versão mobile)
//
//  Fluxo da clínica, na ordem da barra de baixo:
//    1. CADASTRO — a ficha inicial do paciente (nome, contato)
//    2. TRIAGEM — o formulário de diagnóstico (saúde + tipo de procedimento)
//       e as caixinhas por procedimento com o TOTAL de pacientes de cada um
//    3. PACIENTES — todos os pacientes (toque abre a ficha com fotos)
//    4. AGENDAMENTO — marca o paciente com o voluntário/dentista, vendo os
//       horários já ocupados dele no dia
//    5. VOLUNTÁRIOS — solicitações e equipe; toque abre o voluntário com a
//       agenda dele
//    6. PERFIL — quem está usando a central
//  Avisos ficam no sino do topo. Tudo conversa com o Semeador em tempo real
//  pelo Firebase — contrato em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal } from '../logo.jsx';
import { UserPlus, Stethoscope, ClipboardList, CalendarDays, Users, User, Megaphone, TriangleAlert, Sparkles, HeartPulse, Wrench, Syringe, Scissors, Crown, ClipboardCheck, Plus, ChevronLeft } from 'lucide-react';
import { FichaPaciente } from '../ficha.jsx';
import icone from '../icones/icone-central-1024.png';

function LogoApp({ tamanho = 120 }) {
  return <img src={icone} width={tamanho} height={tamanho} alt="Seja Semente"
    style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }} />;
}

const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null;

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const modAuth = await import('firebase/auth');
  const modFs = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  // Dentro do aplicativo do iPhone (WebView), o jeito padrão de iniciar a
  // autenticação e o banco falha — estes dois ajustes são os recomendados:
  let auth;
  try {
    auth = modAuth.initializeAuth(app, { persistence: [modAuth.indexedDBLocalPersistence, modAuth.browserLocalPersistence] });
  } catch (e) {
    auth = modAuth.getAuth(app);
  }
  const db = modFs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  fb = { auth, db, fns: { ...modAuth, ...modFs } };
}

// ─── Procedimentos (as caixinhas da triagem) e ficha de saúde ───
const AREAS = [
  { nome: 'Profilaxia', detalhe: 'limpeza', Icone: Sparkles, cor: '#29A0CE' },
  { nome: 'Periodontia', detalhe: 'gengiva', Icone: HeartPulse, cor: '#E24B26' },
  { nome: 'Dentística', detalhe: 'restauração', Icone: Wrench, cor: '#5FA83C' },
  { nome: 'Endodontia', detalhe: 'canal', Icone: Syringe, cor: '#7E4A9E' },
  { nome: 'Cirurgia', detalhe: 'extração', Icone: Scissors, cor: '#C22326' },
  { nome: 'Prótese', detalhe: '', Icone: Crown, cor: '#F0A912' },
  { nome: 'Avaliação', detalhe: 'primeira consulta', Icone: ClipboardCheck, cor: '#2F7D4E' },
  { nome: 'Outro', detalhe: 'outro procedimento', Icone: Plus, cor: '#55645A' },
];
const CONDICOES_SAUDE = ['Hipertensão / pressão alta', 'Diabetes', 'Problema cardíaco', 'Alergia a medicamento', 'Medicação contínua', 'Gestante'];
const PROXIMO_STATUS = { 'triado': 'em atendimento', 'em atendimento': 'concluído', 'concluído': 'triado' };

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'central-demo', nome: 'Coordenação (teste)' },
  pacientes: [
    { id: 'p1', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', observacoes: 'Sente dor no dente há duas semanas.', status: 'triado', criadoEm: new Date(), triagem: { area: 'Cirurgia', saude: ['Hipertensão / pressão alta'], outrasCondicoes: '' } },
    { id: 'p2', nome: 'Ana Paula', idade: '34', telefone: '(11) 94444-2222', observacoes: 'Chegou pela campanha do agasalho.', status: 'cadastrado', criadoEm: new Date(Date.now() - 864e5), triagem: null },
    { id: 'p3', nome: 'Carlos Mendes', idade: '41', telefone: '(11) 97777-2222', observacoes: '', status: 'em atendimento', criadoEm: new Date(Date.now() - 3 * 864e5), triagem: { area: 'Prótese', saude: ['Diabetes', 'Medicação contínua'], outrasCondicoes: 'Insulina 2x ao dia' } },
  ],
  agendamentos: [
    { id: 'g1', area: 'Cirurgia', titulo: 'Cirurgia (extração)', pacienteId: 'p1', pacienteNome: 'José da Silva', data: hojeISO(), hora: '14:00', profissionalUid: 'v1', profissionalNome: 'Maria Souza', origem: 'central', criadoEm: new Date() },
  ],
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo à central Seja Semente!', texto: 'Fluxo: cadastre o paciente, faça a triagem, e agende com o voluntário.', autor: 'Sistema', criadoEm: new Date() },
  ],
  voluntarios: [
    { id: 'v1', nome: 'Maria Souza', ministerio: 'Dentista', telefone: '(11) 91234-5678', status: 'ativo', ativo: true },
    { id: 'v2', nome: 'Pedro Lima', ministerio: 'Dentista', telefone: '(11) 99876-5432', status: 'ativo', ativo: true },
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
function areaDe(nome) { return AREAS.find(a => a.nome === nome); }

// ═══════════════════════════════════════════════════════════════════════════
//  Telas
// ═══════════════════════════════════════════════════════════════════════════

function TelaLogin({ aoEntrarDemo }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [novaConta, setNovaConta] = useState(false);

  async function entrarGoogle() {
    setErro('');
    if (!CONFIGURADO) {
      aoEntrarDemo({ ...DEMO.usuario });
      return;
    }
    setCarregando(true);
    try {
      if (window.__entrarNativoGoogle) await window.__entrarNativoGoogle(fb.auth);
      else await fb.fns.signInWithPopup(fb.auth, new fb.fns.GoogleAuthProvider());
    } catch (e) {
      if (!String(e?.message || '').includes('cancelado')) {
        const caminho = window.__entrarNativoGoogle ? 'nativo' : 'navegador';
        setErro(`Google não entrou (${caminho}): ${e?.code || ''} ${e?.message || e}`.slice(0, 220));
      }
    }
    setCarregando(false);
  }

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

// TRIAGEM: o formulário de diagnóstico do paciente
function FormTriagem({ paciente, aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ area: AREAS[0].nome, saude: [], outrasCondicoes: '' });
  const alternaSaude = c => setF({ ...f, saude: f.saude.includes(c) ? f.saude.filter(x => x !== c) : [...f.saude, c] });
  return (
    <div className="folha">
      <h2>Triagem — {paciente.nome}</h2>
      <div className="campo"><span>Tipo de procedimento que vai fazer</span>
        <div className="caixas">
          {AREAS.map(a => (
            <label key={a.nome} className={f.area === a.nome ? 'caixa marcada' : 'caixa'} onClick={() => setF({ ...f, area: a.nome })}>
              <a.Icone size={15} style={{ color: a.cor }} />{a.nome}
            </label>
          ))}
        </div>
      </div>
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
      <Campo rotulo="Outras condições de saúde"><input value={f.outrasCondicoes} onChange={e => setF({ ...f, outrasCondicoes: e.target.value })} placeholder="Ex.: cirurgia recente, asma…" /></Campo>
      <p className="dica">Depois da triagem, o paciente entra na caixinha do procedimento e já pode ser agendado com um voluntário.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" onClick={() => aoSalvar(f)}>Concluir triagem</button>
      </div>
    </div>
  );
}

// AGENDAMENTO: paciente + voluntário (vendo os horários dele no dia) + hora
function FormMarcar({ pacientes, voluntarios, agendamentos, dataInicial, aoSalvar, aoCancelar }) {
  const triados = pacientes.filter(p => p.triagem);
  const [f, setF] = useState({
    pacienteId: triados[0]?.id || '',
    profissionalUid: voluntarios[0]?.id || '',
    data: dataInicial, hora: '08:00',
  });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const pac = triados.find(p => p.id === f.pacienteId);
  const prof = voluntarios.find(p => p.id === f.profissionalUid);
  const area = pac?.triagem?.area ? areaDe(pac.triagem.area) : null;
  const ocupados = agendamentos
    .filter(g => g.profissionalUid === f.profissionalUid && g.data === f.data)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  return (
    <div className="folha">
      <h2>Agendar paciente</h2>
      {triados.length === 0 && <p className="dica">Nenhum paciente com triagem ainda — faça a triagem primeiro.</p>}
      <Campo rotulo="Paciente">
        <select value={f.pacienteId} onChange={muda('pacienteId')}>
          {triados.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.triagem.area}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Voluntário / dentista que vai atender">
        <select value={f.profissionalUid} onChange={muda('profissionalUid')}>
          {voluntarios.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ministerio ? ` — ${p.ministerio}` : ''}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data"><input type="date" value={f.data} onChange={muda('data')} /></Campo>
      <Campo rotulo="Hora"><input type="time" value={f.hora} onChange={muda('hora')} /></Campo>
      {prof && (
        <p className="dica">
          {ocupados.length
            ? `Horários já ocupados de ${prof.nome} em ${dataBonita(f.data)}: ${ocupados.map(g => g.hora).join(', ')}`
            : `${prof.nome} está com o dia ${dataBonita(f.data)} livre.`}
        </p>
      )}
      <p className="dica">O agendamento cai na hora na agenda do voluntário, no Semeador dele.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!pac || !prof} onClick={() => aoSalvar({
          area: pac.triagem.area,
          titulo: pac.triagem.area + (area?.detalhe ? ` (${area.detalhe})` : ''),
          pacienteId: pac.id, pacienteNome: pac.nome,
          profissionalUid: prof.id, profissionalNome: prof.nome,
          data: f.data, hora: f.hora,
        })}>Agendar</button>
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
  const [tela, setTela] = useState(null); // null | 'avisos' | 'novoAviso' | 'marcar' | {triagem} | {area} | {voluntario}
  const [dia, setDia] = useState(hojeISO());
  const [cadastradoMsg, setCadastradoMsg] = useState('');
  const [novo, setNovo] = useState({ nome: '', idade: '', telefone: '', observacoes: '' });
  const [pacientes, setPacientes] = useState(CONFIGURADO ? [] : lerLocal('ss-pacientes', DEMO.pacientes));
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : lerLocal('ss-agendamentos', DEMO.agendamentos));
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : lerLocal('ss-avisos', DEMO.avisos));
  const [voluntarios, setVoluntarios] = useState(CONFIGURADO ? [] : lerLocal('ss-voluntarios', DEMO.voluntarios));

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
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, col), { ...dados, ...local, criadoEm: serverTimestamp() });
  }

  async function cadastrarPaciente() {
    const nome = novo.nome.trim();
    if (!nome) return;
    await salvar('pacientes', { ...novo, nome }, { status: 'cadastrado', triagem: null, criadoEm: new Date() }, setPacientes);
    setNovo({ nome: '', idade: '', telefone: '', observacoes: '' });
    setCadastradoMsg(`${nome} cadastrado! Agora é só fazer a triagem.`);
    setTimeout(() => setCadastradoMsg(''), 5000);
  }

  async function salvarTriagem(paciente, triagem) {
    if (!CONFIGURADO) {
      setPacientes(ps => ps.map(p => p.id === paciente.id ? { ...p, triagem, status: 'triado' } : p));
      setTela(null);
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'pacientes', paciente.id), { triagem, status: 'triado' });
    setTela(null);
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

  // ─── Ficha do paciente (dados + fotos do que foi feito) ───
  const [fichaId, setFichaId] = useState(null);
  const [fichaPaciente, setFichaPaciente] = useState(null);
  const [fichaArquivos, setFichaArquivos] = useState([]);
  const [demoArquivos, setDemoArquivos] = useState({});

  useEffect(() => {
    if (!fichaId) { setFichaPaciente(null); setFichaArquivos([]); return; }
    if (!CONFIGURADO) {
      setFichaPaciente(pacientes.find(p => p.id === fichaId) || null);
      setFichaArquivos(demoArquivos[fichaId] || []);
      return;
    }
    const { doc, onSnapshot, collection, query, orderBy } = fb.fns;
    const s1 = onSnapshot(doc(fb.db, 'pacientes', fichaId), snap => setFichaPaciente(snap.exists() ? { id: snap.id, ...snap.data() } : null));
    const s2 = onSnapshot(query(collection(fb.db, 'pacientes', fichaId, 'arquivos'), orderBy('criadoEm', 'desc')), snap => setFichaArquivos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { s1(); s2(); };
  }, [fichaId, pacientes, demoArquivos]);

  async function salvarArquivo(dataUrl, legenda) {
    const registro = { dataUrl, legenda, autorUid: usuario.uid, autorNome: usuario.nome || '' };
    if (!CONFIGURADO) {
      setDemoArquivos(a => ({ ...a, [fichaId]: [{ id: 'f' + Math.floor(Math.random() * 1e9), ...registro, criadoEm: new Date() }, ...(a[fichaId] || [])] }));
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, 'pacientes', fichaId, 'arquivos'), { ...registro, criadoEm: serverTimestamp() });
  }

  // ─── Telas por cima das abas ───
  if (fichaId) return <FichaPaciente paciente={fichaPaciente} arquivos={fichaArquivos} aoVoltar={() => setFichaId(null)} aoSalvarArquivo={salvarArquivo} />;
  if (tela?.triagem) return <FormTriagem paciente={tela.triagem} aoCancelar={() => setTela(null)} aoSalvar={t => salvarTriagem(tela.triagem, t)} />;
  if (tela === 'marcar') return <FormMarcar pacientes={pacientes} voluntarios={profissionais} agendamentos={agendamentos} dataInicial={dia} aoCancelar={() => setTela(null)} aoSalvar={async f => { await salvar('agendamentos', f, { origem: 'central', criadoEm: new Date() }, setAgendamentos); setTela(null); }} />;
  if (tela === 'novoAviso') return <FormAviso aoCancelar={() => setTela('avisos')} aoSalvar={async f => { await salvar('avisos', f, { autor: usuario.nome, criadoEm: new Date() }, setAvisos); setTela('avisos'); }} />;

  if (tela === 'avisos') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>Avisos</h2><button className="btn-mais" onClick={() => setTela('novoAviso')}>+ Novo</button></div>
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
    </div>
  );

  if (tela?.area) {
    const daArea = pacientes.filter(p => p.triagem?.area === tela.area.nome);
    const A = tela.area;
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
        <div className="cartao-linha" style={{ alignItems: 'center', marginBottom: 4 }}>
          <span className="caixa-area-icone" style={{ background: A.cor + '22', color: A.cor }}><A.Icone size={26} strokeWidth={2.2} /></span>
          <h2 style={{ margin: 0 }}>{A.nome} · {daArea.length} paciente{daArea.length === 1 ? '' : 's'}</h2>
        </div>
        {daArea.length ? daArea.map(p => (
          <div className="cartao" key={p.id} onClick={() => setFichaId(p.id)} style={{ cursor: 'pointer' }}>
            <div className="cartao-linha">
              <Bolha nome={p.nome} />
              <div>
                <div className="cartao-topo">
                  <strong>{p.nome}</strong>
                  <button className={'chip ' + p.status.replace(' ', '-')} onClick={e => { e.stopPropagation(); mudarStatus(p); }}>{p.status}</button>
                </div>
                <p className="obs">{[p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </div>
        )) : <div className="vazio">Nenhum paciente de {A.nome} ainda.</div>}
      </div>
    );
  }

  if (tela?.voluntario) {
    const v = tela.voluntario;
    const dele = agendamentos.filter(g => g.profissionalUid === v.id)
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
        <div className="cartao">
          <div className="cartao-linha">
            <Bolha nome={v.nome} />
            <div>
              <strong style={{ fontSize: 18 }}>{v.nome}</strong>
              <p className="obs">{[v.ministerio, v.telefone, v.email].filter(Boolean).join(' · ')}</p>
              {v.cpf && <p className="obs">CPF: {v.cpf}{v.nascimento ? ` · Nascimento: ${dataNascimentoBonita(v.nascimento)}` : ''}</p>}
            </div>
          </div>
        </div>
        <h2 style={{ fontSize: 20, margin: '8px 0 2px' }}>Agenda de {v.nome.split(' ')[0]}</h2>
        {dele.length ? dele.map(g => (
          <div className="cartao" key={g.id} onClick={() => g.pacienteId && setFichaId(g.pacienteId)} style={g.pacienteId ? { cursor: 'pointer' } : undefined}>
            <div className="linha-agenda">
              <div className="hora-col">{g.hora}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{g.pacienteNome || g.titulo}</strong>
                <p className="obs">{dataBonita(g.data)}{g.titulo && g.pacienteNome ? ` · ${g.titulo}` : ''}</p>
              </div>
            </div>
          </div>
        )) : <div className="vazio">Nada agendado para {v.nome.split(' ')[0]} ainda.</div>}
      </div>
    );
  }

  const doDia = agendamentos.filter(g => g.data === dia).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const semTriagem = pacientes.filter(p => !p.triagem);

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={40} /></div>
          <div style={{ flex: 1 }}>
            <strong>Seja Semente</strong>
            <div className="status">Central · {usuario.nome}</div>
          </div>
          <button className="btn-header" onClick={() => setTela('avisos')} title="Avisos"><Megaphone size={21} /></button>
        </div>
      </header>

      <main>
        {aba === 'cadastro' && (
          <>
            <h2>Cadastro do paciente</h2>
            {cadastradoMsg && <div className="banner-ok">✓ {cadastradoMsg}</div>}
            <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Campo rotulo="Nome do paciente"><input value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></Campo>
              <Campo rotulo="Idade"><input value={novo.idade} onChange={e => setNovo({ ...novo, idade: e.target.value })} inputMode="numeric" /></Campo>
              <Campo rotulo="Telefone"><input value={novo.telefone} onChange={e => setNovo({ ...novo, telefone: e.target.value })} inputMode="tel" /></Campo>
              <Campo rotulo="Observações"><textarea rows={3} value={novo.observacoes} onChange={e => setNovo({ ...novo, observacoes: e.target.value })} /></Campo>
              <button className="btn-principal" style={{ maxWidth: 'none' }} disabled={!novo.nome.trim()} onClick={cadastrarPaciente}>Cadastrar paciente</button>
            </div>
            <p className="dica" style={{ marginTop: 10 }}>Depois do cadastro, o próximo passo é a aba Triagem.</p>
          </>
        )}

        {aba === 'triagem' && (
          <>
            <h2>Triagem</h2>
            {semTriagem.length > 0 && (
              <>
                <p className="dica" style={{ marginBottom: 8 }}>Aguardando triagem:</p>
                {semTriagem.map(p => (
                  <div className="cartao" key={p.id}>
                    <div className="cartao-linha">
                      <Bolha nome={p.nome} />
                      <div>
                        <div className="cartao-topo"><strong>{p.nome}</strong><span className="chip aguardando">sem triagem</span></div>
                        <p className="obs">{[p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                        <button className="btn-triagem" onClick={() => setTela({ triagem: p })}>Fazer triagem</button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            <p className="dica" style={{ margin: '10px 0 8px' }}>Pacientes por procedimento (toque para ver):</p>
            <div className="grade-areas">
              {AREAS.map(a => {
                const total = pacientes.filter(p => p.triagem?.area === a.nome).length;
                return (
                  <button key={a.nome} className="caixa-area" onClick={() => setTela({ area: a })}>
                    <span className="caixa-area-icone" style={{ background: a.cor + '22', color: a.cor }}><a.Icone size={26} strokeWidth={2.2} /></span>
                    <strong>{a.nome}</strong>
                    <span className="caixa-area-detalhe">{total} paciente{total === 1 ? '' : 's'}{a.detalhe ? ` · ${a.detalhe}` : ''}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {aba === 'pacientes' && (
          <>
            <h2>Pacientes</h2>
            {pacientes.length ? pacientes.map(p => (
              <div className="cartao" key={p.id} onClick={() => setFichaId(p.id)} style={{ cursor: 'pointer' }}>
                <div className="cartao-linha">
                  <Bolha nome={p.nome} />
                  <div>
                    <div className="cartao-topo">
                      <strong>{p.nome}</strong>
                      {p.triagem
                        ? <button className={'chip ' + p.status.replace(' ', '-')} onClick={e => { e.stopPropagation(); mudarStatus(p); }}>{p.status}</button>
                        : <span className="chip aguardando">sem triagem</span>}
                    </div>
                    {p.triagem && <p>{p.triagem.area}</p>}
                    <p className="obs">{[p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                    {p.triagem && (p.triagem.saude?.length > 0 || p.triagem.outrasCondicoes) && (
                      <p className="saude"><TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{[...(p.triagem.saude || []), p.triagem.outrasCondicoes].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>
            )) : <div className="vazio">Nenhum paciente ainda — cadastre na aba Cadastro.</div>}
          </>
        )}

        {aba === 'agenda' && (
          <>
            <div className="titulo-com-botao"><h2>Agendamento</h2><button className="btn-mais" onClick={() => setTela('marcar')}>+ Agendar</button></div>
            <div className="dia-nav">
              <button onClick={() => setDia(somaDias(dia, -1))}>‹</button>
              <div className="dia-titulo">
                <strong>{dataBonita(dia)}</strong>
                {dia !== hojeISO() ? <span onClick={() => setDia(hojeISO())} style={{ cursor: 'pointer' }}>voltar para hoje</span> : <span>hoje</span>}
              </div>
              <button onClick={() => setDia(somaDias(dia, 1))}>›</button>
            </div>
            {doDia.length ? doDia.map(g => (
              <div className="cartao" key={g.id} onClick={() => g.pacienteId && setFichaId(g.pacienteId)} style={g.pacienteId ? { cursor: 'pointer' } : undefined}>
                <div className="linha-agenda">
                  <div className="hora-col">{g.hora}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{g.pacienteNome || g.titulo}</strong>
                    {g.pacienteNome && g.titulo && <p style={{ marginTop: 3 }}>{g.titulo}</p>}
                    {g.profissionalNome && <p className="obs">com {g.profissionalNome}</p>}
                  </div>
                  <button className="btn-remover" onClick={e => { e.stopPropagation(); removerAgendamento(g); }} title="Remover">✕</button>
                </div>
              </div>
            )) : <div className="vazio">Nada marcado em {dataBonita(dia)}.<br />Toque em "+ Agendar".</div>}
          </>
        )}

        {aba === 'voluntarios' && (() => {
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
              <h2>Voluntários</h2>
              {equipe.length ? equipe.map(v => (
                <div className="cartao" key={v.id} onClick={() => setTela({ voluntario: v })} style={{ cursor: 'pointer' }}>
                  <div className="cartao-linha">
                    <Bolha nome={v.nome} />
                    <div>
                      <div className="cartao-topo"><strong>{v.nome}</strong>{v.ativo === false && <span className="chip aguardando">inativo</span>}</div>
                      <p>{[v.ministerio, v.telefone].filter(Boolean).join(' · ')}</p>
                      <p className="obs">{agendamentos.filter(g => g.profissionalUid === v.id).length} agendamento(s) — toque para ver a agenda</p>
                    </div>
                  </div>
                </div>
              )) : <div className="vazio">Nenhum voluntário cadastrado ainda.</div>}
            </>
          );
        })()}

        {aba === 'perfil' && (
          <>
            <h2>Meu perfil</h2>
            <div className="cartao">
              <div className="cartao-linha">
                <Bolha nome={usuario.nome} />
                <div>
                  <p style={{ marginTop: 0 }}><strong>{usuario.nome}</strong></p>
                  {usuario.email && <p>{usuario.email}</p>}
                  <p className="obs">Central do Seja Semente</p>
                </div>
              </div>
            </div>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'cadastro' ? 'ativo' : ''} onClick={() => setAba('cadastro')}><UserPlus size={22} /><span>Cadastro</span></button>
        <button className={aba === 'triagem' ? 'ativo' : ''} onClick={() => setAba('triagem')}>
          <span className="icone-aba"><Stethoscope size={22} />{semTriagem.length > 0 && <i className="bolinha" />}</span>
          <span>Triagem</span>
        </button>
        <button className={aba === 'pacientes' ? 'ativo' : ''} onClick={() => setAba('pacientes')}><ClipboardList size={22} /><span>Pacientes</span></button>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}><CalendarDays size={22} /><span>Agenda</span></button>
        <button className={aba === 'voluntarios' ? 'ativo' : ''} onClick={() => setAba('voluntarios')}>
          <span className="icone-aba"><Users size={22} />{voluntarios.some(v => v.status === 'pendente') && <i className="bolinha" />}</span>
          <span>Voluntár.</span>
        </button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}><User size={22} /><span>Perfil</span></button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(CONFIGURADO ? null : lerLocal('ss-usuario', null));

  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-usuario', usuario); }, [usuario]);

  const [erroInicial, setErroInicial] = useState('');

  useEffect(() => {
    if (!CONFIGURADO) return;
    const pega = (e) => setErroInicial(atual => atual || String(e?.reason?.message || e?.message || e?.type || e));
    window.addEventListener('unhandledrejection', pega);
    window.addEventListener('error', pega);
    let soltar = null;
    ligarFirebase().then(() => {
      soltar = fb.fns.onAuthStateChanged(fb.auth, u => {
        setUsuario(u ? { uid: u.uid, email: u.email, nome: u.displayName || u.email } : null);
        setPronto(true);
      });
    }).catch(e => { setErroInicial(String(e?.message || e)); setPronto(true); });
    return () => { soltar?.(); window.removeEventListener('unhandledrejection', pega); window.removeEventListener('error', pega); };
  }, []);

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    setUsuario(null);
  }

  if (erroInicial) return (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Ops, algo travou</h1>
      <p className="login-sub">Erro técnico na largada — manda um print desta tela:<br /><b>{erroInicial}</b></p>
      <button className="btn-principal" onClick={() => window.location.reload()}>Tentar de novo</button>
    </div>
  );
  if (!pronto) return <div className="carregando"><LogoApp tamanho={96} /></div>;
  if (!usuario) return <TelaLogin aoEntrarDemo={setUsuario} />;
  return <TelaPrincipal usuario={usuario} aoSair={sair} />;
}

createRoot(document.getElementById('root')).render(<App />);
