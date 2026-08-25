// ═══════════════════════════════════════════════════════════════════════════
//  PALMAR — o aplicativo dos GESTORES do projeto Seja Semente.
//  Ele enxerga (e coordena) tudo que os outros aplicativos produzem:
//    1. PAINEL — os números do projeto em tempo real + chamadas rápidas
//    2. AÇÕES — cria a ação (mutirão) com data, escala os voluntários,
//       acompanha o relatório completo (pacientes, custos, materiais)
//    3. EQUIPE — aprova/edita/remove voluntários; tempo previsto × gasto
//    4. ESTOQUE — materiais com alerta de falta e histórico de gastos
//    5. FINANCEIRO — valor de cada procedimento (inclusive por dente) e o
//       total do que o projeto já produziu
//  Tudo no mesmo banco dos outros apps — contrato em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
const FIREBASE_CONFIG = { apiKey: 'COLE_AQUI' };
import { Bolha, lerLocal, gravarLocal, corDoNome, Abertura, GoogleG, BrotoMini, ligarGestoVoltar, usarTemInternet, idAparelho } from '../logo.jsx';
import { Home, Flag, Users, Package, Wallet, User, ChevronLeft, ChevronRight, Clock, Tag, Plus, Mail, Lock, Eye, EyeOff, BellRing, Megaphone, TriangleAlert, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { TelaChamada, TelaChamarStaff, TelaConvocacoes, TelaConvocacao } from '../chamada.jsx';
import { comprimirImagem } from '../ficha.jsx';

// Lê o QR CODE da nota fiscal com a câmera (a chave de 44 dígitos prova que
// a nota é real; quando o QR traz o valor, ele entra sozinho)
function LeitorQR({ aoLer, aoFechar }) {
  const videoRef = useRef(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true, stream = null, timer = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!vivo) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const jsQR = (await import('jsqr')).default;
        const c = document.createElement('canvas');
        timer = setInterval(() => {
          const v = videoRef.current;
          if (!v || !v.videoWidth) return;
          c.width = v.videoWidth; c.height = v.videoHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, c.width, c.height);
          const q = jsQR(img.data, img.width, img.height);
          if (q?.data) { clearInterval(timer); aoLer(q.data); }
        }, 400);
      } catch (e) { setErro('Não consegui abrir a câmera — confira a permissão nos ajustes.'); }
    })();
    return () => { vivo = false; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  return (
    <div className="chamada-tela" style={{ background: '#0B1F14' }}>
      <p className="chamada-rotulo">🔎 Aponte para o QR da nota</p>
      <video ref={videoRef} playsInline muted style={{ width: '100%', maxWidth: 420, borderRadius: 18 }} />
      {erro && <div className="erro">{erro}</div>}
      <button className="chamada-atender" onClick={aoFechar}>Cancelar</button>
    </div>
  );
}

// Extrai a chave (44 dígitos) e, quando o QR traz, o valor da nota
function lerNotaDoQR(texto) {
  const chave = (String(texto).match(/(\d{44})/) || [])[1] || '';
  let valor = 0;
  const mV = String(texto).match(/[?|&]vNF=([\d.,]+)/i) || String(texto).match(/\|(\d+\.\d{2})\|/);
  if (mV) valor = Number(String(mV[1]).replace(',', '.')) || 0;
  return { chave, valor, url: String(texto).startsWith('http') ? String(texto) : '' };
}

// Logo do Palmar: uma palmeira num quadrado arredondado (desenhada aqui
// mesmo, sem arquivo) — a "árvore que dá sombra" para o projeto crescer
function LogoApp({ tamanho = 120 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }}>
      <defs>
        <linearGradient id="pm-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E5A3A" /><stop offset="1" stopColor="#123B26" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#pm-fundo)" />
      <circle cx="76" cy="24" r="11" fill="#F3C34A" opacity="0.9" />
      <path d="M48 88 C50 66 50 54 51 44 L55 44 C54 56 54 68 56 88 Z" fill="#8A5A33" />
      <g fill="#3FA268">
        <path d="M52 44 C38 34 26 34 16 40 C28 26 46 28 52 40 Z" />
        <path d="M52 44 C66 34 78 34 88 40 C76 26 58 28 52 40 Z" />
        <path d="M52 42 C44 28 44 18 50 10 C38 18 40 34 50 42 Z" />
        <path d="M52 42 C60 28 60 18 54 10 C66 18 64 34 54 42 Z" />
        <path d="M52 43 C48 40 40 42 34 50 C42 44 48 44 52 46 Z" />
        <path d="M52 43 C56 40 64 42 70 50 C62 44 56 44 52 46 Z" />
      </g>
      <circle cx="47" cy="46" r="3.2" fill="#C88A3C" />
      <circle cx="55" cy="47" r="3.2" fill="#C88A3C" />
      <path d="M20 88 Q50 82 80 88 L80 100 L20 100 Z" fill="#2C6E48" />
    </svg>
  );
}

const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null;

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const modAuth = await import('firebase/auth');
  const modFs = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  let auth;
  if (window.__loginGoogleNativo || window.__entrarNativoGoogle) {
    try {
      auth = modAuth.initializeAuth(app, {
        persistence: [modAuth.indexedDBLocalPersistence, modAuth.browserLocalPersistence],
      });
    } catch (e) { auth = modAuth.getAuth(app); }
  } else {
    auth = modAuth.getAuth(app);
  }
  let db;
  try {
    db = modFs.initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: modFs.persistentLocalCache({ tabManager: modFs.persistentMultipleTabManager() }),
    });
  } catch (e) {
    db = modFs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
  fb = { auth, db, fns: { ...modAuth, ...modFs } };
}

// ─── Procedimentos (mesmos nomes da central/Semeador) ───
const AREAS_FIXAS = ['Profilaxia', 'Periodontia', 'Dentística', 'Endodontia', 'Cirurgia', 'Prótese', 'Raio-X', 'Avaliação'];
const DURACAO_PADRAO = 30;

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function isoDe(v) {
  const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
  if (!d || isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return `${dias[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
const dinheiro = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
function areasDoPaciente(p) {
  const t = p?.triagem;
  if (!t) return [];
  if (Array.isArray(t.areas)) return t.areas;
  if (t.area) return [t.area];
  return t.procedimento ? [t.procedimento] : [];
}

// ─── Modo demonstração (sem Firebase) ───
const DEMO = {
  usuario: { uid: 'gestor-demo', nome: 'Gestora de Teste' },
  voluntarios: [
    { id: 'v1', nome: 'Maria Souza', ministerio: 'Dentista', telefone: '(11) 91234-5678', status: 'ativo', ativo: true, procedimentos: ['Cirurgia', 'Profilaxia'] },
    { id: 'v2', nome: 'Pedro Lima', ministerio: 'Dentista', telefone: '(11) 99876-5432', status: 'ativo', ativo: true, procedimentos: ['Prótese'] },
    { id: 'v3', nome: 'Lucas Andrade', email: 'lucas@gmail.com', telefone: '(11) 95555-4444', status: 'pendente', ativo: false },
  ],
  pacientes: [
    { id: 'p1', codigo: 'SS-0001', nome: 'José da Silva', status: 'concluído', criadoEm: new Date(), triagem: { areas: ['Cirurgia'], dentes: [16, 26] } },
    { id: 'p2', codigo: 'SS-0002', nome: 'Rita Nascimento', status: 'em atendimento', criadoEm: new Date(), triagem: { areas: ['Prótese'], dentes: [11] } },
    { id: 'p3', codigo: 'SS-0003', nome: 'Ana Paula', status: 'triado', criadoEm: new Date(), triagem: { areas: ['Profilaxia'], dentes: [] } },
  ],
  agendamentos: [
    { id: 'g1', area: 'Cirurgia', pacienteId: 'p1', pacienteNome: 'José da Silva', data: hojeISO(), hora: '09:00', duracaoMin: 60, profissionalUid: 'v1', profissionalNome: 'Maria Souza' },
    { id: 'g2', area: 'Prótese', pacienteId: 'p2', pacienteNome: 'Rita Nascimento', data: hojeISO(), hora: '10:30', duracaoMin: 60, profissionalUid: 'v2', profissionalNome: 'Pedro Lima' },
  ],
  atendimentos: [
    { id: 'a1', profissionalUid: 'v1', profissionalNome: 'Maria Souza', pacienteId: 'p1', pacienteNome: 'José da Silva', area: 'Cirurgia', inicio: new Date(Date.now() - 90 * 60000), fim: new Date(Date.now() - 20 * 60000), duracaoMin: 70 },
    { id: 'a2', profissionalUid: 'v2', profissionalNome: 'Pedro Lima', pacienteId: 'p2', pacienteNome: 'Rita Nascimento', area: 'Prótese', inicio: new Date(Date.now() - 50 * 60000), fim: null },
  ],
  estoque: [
    { id: 'e1', nome: 'Luvas de procedimento', quantidade: 2, unidade: 'caixa', valor: 28, minimo: 5 },
    { id: 'e2', nome: 'Anestésico lidocaína', quantidade: 18, unidade: 'tubete', valor: 4.5, minimo: 10 },
    { id: 'e3', nome: 'Sugador descartável', quantidade: 40, unidade: 'un', valor: 0.6, minimo: 20 },
  ],
  movimentos: [
    { id: 'm1', itemId: 'e2', itemNome: 'Anestésico lidocaína', delta: -4, motivo: 'Mutirão de hoje', valorUnit: 4.5, em: new Date(Date.now() - 3600e3) },
  ],
  acoes: [
    { id: 'ac1', titulo: 'Mutirão da Comunidade', data: hojeISO(), local: 'Igreja Central', status: 'iniciada', voluntariosUids: ['v1', 'v2'], registros: [], criadaEm: new Date() },
  ],
  investidores: [
    { id: 'i1', nome: 'Carlos Pereira', empresa: 'Dental Sul Materiais', telefone: '(11) 97777-0000', email: 'carlos@dentalsul.com', acaoId: 'ac1', acaoTitulo: 'Mutirão da Comunidade', criadaEm: new Date() },
  ],
  notas: [
    { id: 'n1', acaoId: 'ac1', acaoTitulo: 'Mutirão da Comunidade', valor: 148.9, descricao: 'Materiais descartáveis', chave: '35260812345678000199650010000012341000012349', origem: 'qr', criadaEm: new Date() },
  ],
  config: { personalizados: [], duracoes: { Cirurgia: 60, Prótese: 60, Profilaxia: 30 }, valores: { Cirurgia: 250, 'Prótese': 900, Profilaxia: 120 }, porDente: { Cirurgia: true } },
};

// ─── Telas de entrada ───
function TelaLogin({ aoEntrarDemo }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [novaConta, setNovaConta] = useState(false);
  const [verSenha, setVerSenha] = useState(false);

  async function entrarGoogle() {
    setErro('');
    if (!CONFIGURADO) { aoEntrarDemo({ ...DEMO.usuario }); return; }
    setCarregando(true);
    const provedor = () => { const p = new fb.fns.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };
    try {
      if (window.__loginGoogleNativo) {
        const c = await window.__loginGoogleNativo();
        await fb.fns.signInWithCredential(fb.auth, fb.fns.GoogleAuthProvider.credential(c.idToken, c.accessToken || undefined));
      } else if (window.__entrarNativoGoogle) await window.__entrarNativoGoogle(fb.auth);
      else {
        try {
          await fb.fns.signInWithPopup(fb.auth, provedor());
        } catch (e2) {
          const cod = e2?.code || '';
          if (cod === 'auth/popup-closed-by-user' || cod === 'auth/cancelled-popup-request') { setCarregando(false); return; }
          if (cod === 'auth/popup-blocked') {
            window.location.href = 'https://seja-semente-app.firebaseapp.com';
            return;
          }
          if (cod === 'auth/network-request-failed') {
            setCarregando(false);
            setErro('Sem conexão com a internet agora — confira a rede e tente de novo.');
            return;
          }
          throw e2;
        }
      }
    } catch (e) {
      if (!String(e?.message || '').includes('cancelado')) setErro('Google não entrou — código: ' + (e?.code || '') + ' · ' + String(e?.message || e).slice(0, 160));
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
        ? 'Não consegui criar a conta — a senha precisa de 6+ caracteres e o e-mail ser válido.'
        : 'Não consegui entrar. Confira o e-mail e a senha.');
    }
    setCarregando(false);
  }

  return (
    <div className="tela-login">
      <LogoApp tamanho={118} />
      <h1>Palmar</h1>
      <p className="login-etiqueta">Gestão do Seja Semente</p>
      <div className="divisor-broto"><i /><BrotoMini tamanho={19} /><i /></div>
      <p className="missao">Quem coordena, faz a semente <em>crescer</em>.</p>
      {!CONFIGURADO && <div className="faixa-demo">Modo demonstração — o Firebase ainda não foi configurado</div>}
      <button className="btn-google" onClick={entrarGoogle} disabled={carregando}>
        <GoogleG tamanho={23} /> Entrar com Google
      </button>
      {CONFIGURADO && (
        <>
          <div className="separador">ou com e-mail</div>
          <label className="campo-login">
            <Mail size={19} />
            <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="campo-login">
            <Lock size={19} />
            <input placeholder={novaConta ? 'Crie uma senha (6+ caracteres)' : 'Senha'} type={verSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrarEmail()} />
            <button type="button" className="olho" onClick={() => setVerSenha(!verSenha)} aria-label="Mostrar senha">{verSenha ? <EyeOff size={19} /> : <Eye size={19} />}</button>
          </label>
          <button className="btn-principal btn-entrar" onClick={entrarEmail} disabled={carregando}>
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

function TelaCodigo({ usuario, aoResgatar, aoSair }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  async function enviar() {
    setErro('');
    setCarregando(true);
    try {
      const msg = await aoResgatar(codigo);
      if (msg) setErro(msg);
    } catch (e) { setErro('Não consegui validar agora. Tente de novo.'); }
    setCarregando(false);
  }
  return (
    <div className="tela-login">
      <LogoApp tamanho={104} />
      <h1>Acesso ao Palmar</h1>
      <p className="missao">Olá, {usuario.nome?.split(' ')[0] || 'tudo bem'}! O Palmar é só dos gestores — digite o código de acesso que a coordenação te passou.</p>
      <label className="campo-login" style={{ maxWidth: 330 }}>
        <input placeholder="Código (ex.: PM-K7P2Q9)" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && enviar()} style={{ textAlign: 'center', letterSpacing: 1, fontWeight: 800 }} />
      </label>
      {erro && <div className="erro">{erro}</div>}
      <button className="btn-principal" disabled={!codigo.trim() || carregando} onClick={enviar}>{carregando ? 'Verificando…' : 'Entrar'}</button>
      <button className="link-troca" onClick={aoSair}>Sair / trocar de conta</button>
    </div>
  );
}

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}
function Vazio({ texto }) { return <div className="vazio">{texto}</div>; }

// ─── A tela principal, com as abas ───
function TelaPrincipal({ usuario, aoSair, aoChamarStaff }) {
  const [aba, setAba] = useState('painel');
  const [tela, setTela] = useState(null);
  const temInternet = usarTemInternet();

  // Dados dos outros aplicativos (leitura em tempo real)
  const [pacientes, setPacientes] = useState(CONFIGURADO ? [] : DEMO.pacientes);
  const [voluntarios, setVoluntarios] = useState(CONFIGURADO ? [] : lerLocal('pm-voluntarios', DEMO.voluntarios));
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : DEMO.agendamentos);
  const [atendimentos, setAtendimentos] = useState(CONFIGURADO ? [] : DEMO.atendimentos);
  const [centralUsuarios, setCentralUsuarios] = useState([]);
  const [configProc, setConfigProc] = useState(CONFIGURADO ? { personalizados: [], duracoes: {}, valores: {}, porDente: {} } : lerLocal('pm-config', DEMO.config));
  // Dados do próprio Palmar
  const [acoes, setAcoes] = useState(CONFIGURADO ? [] : lerLocal('pm-acoes', DEMO.acoes));
  const [estoque, setEstoque] = useState(CONFIGURADO ? [] : lerLocal('pm-estoque', DEMO.estoque));
  const [movimentos, setMovimentos] = useState(CONFIGURADO ? [] : lerLocal('pm-movimentos', DEMO.movimentos));
  const [convocacoes, setConvocacoes] = useState(CONFIGURADO ? [] : lerLocal('pm-convocacoes', []));
  const [investidores, setInvestidores] = useState(CONFIGURADO ? [] : lerLocal('pm-investidores', DEMO.investidores));
  const [notas, setNotas] = useState(CONFIGURADO ? [] : lerLocal('pm-notas', DEMO.notas));
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-investidores', investidores); }, [investidores]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-notas', notas); }, [notas]);

  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-voluntarios', voluntarios); }, [voluntarios]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-config', configProc); }, [configProc]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-acoes', acoes); }, [acoes]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-estoque', estoque); }, [estoque]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-movimentos', movimentos); }, [movimentos]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-convocacoes', convocacoes); }, [convocacoes]);

  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, doc, onSnapshot, query, orderBy } = fb.fns;
    const escuta = (col, ord, poe) => onSnapshot(query(collection(fb.db, col), orderBy(...ord)), s => poe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const soltar = [
      escuta('pacientes', ['criadoEm', 'desc'], setPacientes),
      escuta('voluntarios', ['nome'], setVoluntarios),
      escuta('agendamentos', ['data'], setAgendamentos),
      escuta('atendimentos', ['inicio', 'desc'], setAtendimentos),
      escuta('central-usuarios', ['nome'], setCentralUsuarios),
      escuta('acoes', ['data', 'desc'], setAcoes),
      escuta('estoque', ['nome'], setEstoque),
      escuta('estoque-movimentos', ['em', 'desc'], setMovimentos),
      escuta('convocacoes', ['criadaEm', 'desc'], setConvocacoes),
      escuta('investidores', ['nome'], setInvestidores),
      escuta('notas', ['criadaEm', 'desc'], setNotas),
      onSnapshot(doc(fb.db, 'config', 'procedimentos'), snap => {
        if (snap.exists()) setConfigProc({ personalizados: [], duracoes: {}, valores: {}, porDente: {}, ...snap.data() });
      }),
    ];
    return () => soltar.forEach(s => s());
  }, []);

  const todasAreas = [...AREAS_FIXAS, ...(configProc.personalizados || []).map(p => p.nome)];
  const duracaoDe = (nome) => configProc.duracoes?.[nome] || DURACAO_PADRAO;
  const valorDe = (nome) => Number(configProc.valores?.[nome] || 0);
  const ehPorDente = (nome) => !!configProc.porDente?.[nome];
  const equipeAtiva = voluntarios.filter(v => v.status === 'ativo' || v.ativo === true);
  const pendentes = voluntarios.filter(v => v.status === 'pendente');

  async function salvarConfig(mudanca) {
    const nova = { ...configProc, ...mudanca };
    setConfigProc(nova);
    if (!CONFIGURADO) return;
    const { doc, setDoc } = fb.fns;
    setDoc(doc(fb.db, 'config', 'procedimentos'), nova).catch(() => {});
  }

  // ─── Custos: quanto "vale" cada atendimento feito ───
  function dentesDoPaciente(pid) {
    const p = pacientes.find(x => x.id === pid);
    return p?.triagem?.dentes?.length || 0;
  }
  function custoAtendimento(a) {
    const v = valorDe(a.area);
    if (!v) return 0;
    return ehPorDente(a.area) ? v * Math.max(1, dentesDoPaciente(a.pacienteId)) : v;
  }

  // ─── Pessoas chamáveis (sino e chamada de grupo) ───
  const pessoasChamaveis = (() => {
    const mapa = new Map();
    for (const v of equipeAtiva) mapa.set(v.id, { uid: v.id, nome: v.nome || '', avatar: v.avatar || '', foto: v.fotoMini || (String(v.foto || '').startsWith('http') ? v.foto : ''), detalhe: v.ministerio || 'Voluntário' });
    for (const u of centralUsuarios) if (!mapa.has(u.id)) mapa.set(u.id, { uid: u.id, nome: u.nome || '', avatar: u.avatar || '', foto: u.fotoMini || '', detalhe: 'Central Seja Semente' });
    mapa.delete(usuario.uid);
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  })();

  // ─── Equipe: aprovar / recusar / editar / remover ───
  async function responderSolicitacao(v, aprovar) {
    const mudanca = aprovar ? { status: 'ativo', ativo: true } : { status: 'recusado', ativo: false };
    if (!CONFIGURADO) { setVoluntarios(vs => vs.map(x => x.id === v.id ? { ...x, ...mudanca } : x)); return; }
    const { doc, updateDoc } = fb.fns;
    updateDoc(doc(fb.db, 'voluntarios', v.id), mudanca).catch(() => {});
  }
  async function salvarVoluntario(v, campos) {
    if (!CONFIGURADO) { setVoluntarios(vs => vs.map(x => x.id === v.id ? { ...x, ...campos } : x)); return; }
    const { doc, updateDoc } = fb.fns;
    updateDoc(doc(fb.db, 'voluntarios', v.id), campos).catch(() => {});
  }
  async function removerVoluntario(v) {
    setTela(null);
    if (!CONFIGURADO) { setVoluntarios(vs => vs.filter(x => x.id !== v.id)); return; }
    const { doc, deleteDoc } = fb.fns;
    deleteDoc(doc(fb.db, 'voluntarios', v.id)).catch(() => {});
  }

  // Tempo previsto × gasto por voluntário (só atendimentos encerrados)
  function temposDo(v) {
    const feitos = atendimentos.filter(a => a.profissionalUid === v.id && a.fim && a.duracaoMin);
    const porArea = {};
    for (const a of feitos) {
      const chave = a.area || 'Outros';
      (porArea[chave] = porArea[chave] || []).push(a.duracaoMin);
    }
    return Object.entries(porArea).map(([area, tempos]) => ({
      area,
      quantos: tempos.length,
      media: Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length),
      previsto: duracaoDe(area),
    }));
  }

  // ─── Ações (mutirões) ───
  async function criarAcao(f) {
    const nova = { ...f, status: 'planejada', voluntariosUids: [], registros: [], criadaPorUid: usuario.uid, criadaPorNome: usuario.nome || '' };
    if (!CONFIGURADO) {
      const id = 'ac' + Math.floor(Math.random() * 1e9);
      setAcoes(as => [{ id, ...nova, criadaEm: new Date() }, ...as]);
      setTela({ acao: id });
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    const ref = await addDoc(collection(fb.db, 'acoes'), { ...nova, criadaEm: serverTimestamp() }).catch(() => null);
    if (ref) setTela({ acao: ref.id });
  }
  async function salvarAcao(a, campos) {
    if (!CONFIGURADO) { setAcoes(as => as.map(x => x.id === a.id ? { ...x, ...campos } : x)); return; }
    const { doc, setDoc } = fb.fns;
    setDoc(doc(fb.db, 'acoes', a.id), campos, { merge: true }).catch(() => {});
  }
  async function excluirAcao(a) {
    setTela(null);
    setAba('acoes');
    if (!CONFIGURADO) { setAcoes(as => as.filter(x => x.id !== a.id)); return; }
    const { doc, deleteDoc } = fb.fns;
    deleteDoc(doc(fb.db, 'acoes', a.id)).catch(() => {});
  }

  // ─── Estoque ───
  async function criarItem(f) {
    if (!CONFIGURADO) { setEstoque(es => [...es, { id: 'e' + Math.floor(Math.random() * 1e9), ...f }].sort((a, b) => a.nome.localeCompare(b.nome))); setTela(null); return; }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'estoque'), { ...f, criadoEm: serverTimestamp() }).catch(() => {});
    setTela(null);
  }
  async function salvarItem(item, campos) {
    if (!CONFIGURADO) { setEstoque(es => es.map(x => x.id === item.id ? { ...x, ...campos } : x)); return; }
    const { doc, updateDoc } = fb.fns;
    updateDoc(doc(fb.db, 'estoque', item.id), campos).catch(() => {});
  }
  async function excluirItem(item) {
    setTela(null);
    if (!CONFIGURADO) { setEstoque(es => es.filter(x => x.id !== item.id)); return; }
    const { doc, deleteDoc } = fb.fns;
    deleteDoc(doc(fb.db, 'estoque', item.id)).catch(() => {});
  }
  // Entrada (+) ou saída (−) de material, com motivo e ação vinculada
  async function movimentar(item, delta, motivo, acaoId) {
    if (!delta) return;
    const acao = acoes.find(a => a.id === acaoId);
    const registro = {
      itemId: item.id, itemNome: item.nome, delta, motivo: motivo || '',
      acaoId: acaoId || '', acaoTitulo: acao?.titulo || '', valorUnit: Number(item.valor || 0),
    };
    const novaQtd = Math.max(0, Number(item.quantidade || 0) + delta);
    if (!CONFIGURADO) {
      setEstoque(es => es.map(x => x.id === item.id ? { ...x, quantidade: novaQtd } : x));
      setMovimentos(ms => [{ id: 'm' + Math.floor(Math.random() * 1e9), ...registro, em: new Date() }, ...ms]);
      return;
    }
    const { doc, updateDoc, collection, addDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'estoque', item.id), { quantidade: novaQtd }).catch(() => {});
    addDoc(collection(fb.db, 'estoque-movimentos'), { ...registro, em: serverTimestamp() }).catch(() => {});
  }
  const emFalta = estoque.filter(i => Number(i.quantidade || 0) <= Number(i.minimo || 0));

  // ─── Investidores (patrocinadores — a Colheita vai ler isto depois) ───
  async function criarInvestidor(f) {
    const acao = acoes.find(a => a.id === f.acaoId);
    const dados = { ...f, acaoTitulo: acao?.titulo || '' };
    if (!CONFIGURADO) { setInvestidores(is => [...is, { id: 'i' + Math.floor(Math.random() * 1e9), ...dados, criadaEm: new Date() }].sort((a, b) => a.nome.localeCompare(b.nome))); setTela(null); return; }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'investidores'), { ...dados, criadaEm: serverTimestamp() }).catch(() => {});
    setTela(null);
  }
  async function salvarInvestidor(i, campos) {
    const acao = acoes.find(a => a.id === campos.acaoId);
    const dados = { ...campos, acaoTitulo: acao?.titulo || '' };
    if (!CONFIGURADO) { setInvestidores(is => is.map(x => x.id === i.id ? { ...x, ...dados } : x)); setTela(null); return; }
    const { doc, updateDoc } = fb.fns;
    updateDoc(doc(fb.db, 'investidores', i.id), dados).catch(() => {});
    setTela(null);
  }
  async function excluirInvestidor(i) {
    setTela(null);
    if (!CONFIGURADO) { setInvestidores(is => is.filter(x => x.id !== i.id)); return; }
    const { doc, deleteDoc } = fb.fns;
    deleteDoc(doc(fb.db, 'investidores', i.id)).catch(() => {});
  }

  // ─── Notas fiscais (foto ou QR — a Colheita vai ler isto depois) ───
  async function criarNota(f) {
    const acao = acoes.find(a => a.id === f.acaoId);
    const dados = { ...f, acaoTitulo: acao?.titulo || '', criadaPorUid: usuario.uid, criadaPorNome: usuario.nome || '' };
    if (!CONFIGURADO) { setNotas(ns => [{ id: 'n' + Math.floor(Math.random() * 1e9), ...dados, criadaEm: new Date() }, ...ns]); setTela(f.acaoId ? { acao: f.acaoId } : 'notas'); return; }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'notas'), { ...dados, criadaEm: serverTimestamp() }).catch(() => {});
    setTela(f.acaoId ? { acao: f.acaoId } : 'notas');
  }
  async function excluirNota(n) {
    if (!CONFIGURADO) { setNotas(ns => ns.filter(x => x.id !== n.id)); return; }
    const { doc, deleteDoc } = fb.fns;
    deleteDoc(doc(fb.db, 'notas', n.id)).catch(() => {});
  }

  // ─── Código de acesso ao Palmar (gerado no Perfil) ───
  const [codigoGerado, setCodigoGerado] = useState('');
  async function gerarCodigo() {
    const cod = 'PM-' + Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    setCodigoGerado(cod);
    if (!CONFIGURADO) return;
    const { doc, setDoc, serverTimestamp } = fb.fns;
    setDoc(doc(fb.db, 'palmar-codigos', cod), { criadoPorUid: usuario.uid, criadoPorNome: usuario.nome || '', criadoEm: serverTimestamp() }).catch(() => {});
  }

  // ═══ TELAS CHEIAS ═══
  if (tela === 'chamarStaff') return <TelaChamarStaff pessoas={pessoasChamaveis} aoChamar={aoChamarStaff} aoVoltar={() => setTela(null)} />;
  if (tela?.convocacao) {
    const c = convocacoes.find(x => x.id === tela.convocacao);
    if (c) return <TelaConvocacao convocacao={c} pessoas={pessoasChamaveis}
      aoChamar={(sel) => {
        if (!sel.length) return;
        for (const p of sel) aoChamarStaff(p, c.titulo, c.id);
        const marca = {}; const agora = new Date();
        for (const p of sel) marca[p.uid] = { nome: p.nome || '', em: agora };
        if (!CONFIGURADO) { setConvocacoes(cs => cs.map(x => x.id === c.id ? { ...x, chamados: { ...x.chamados, ...marca } } : x)); return; }
        fb.fns.setDoc(fb.fns.doc(fb.db, 'convocacoes', c.id), { chamados: marca }, { merge: true }).catch(() => {});
      }}
      aoExcluir={() => {
        setTela('convocacoes');
        if (!CONFIGURADO) { setConvocacoes(cs => cs.filter(x => x.id !== c.id)); return; }
        fb.fns.deleteDoc(fb.fns.doc(fb.db, 'convocacoes', c.id)).catch(() => {});
      }}
      aoVoltar={() => setTela('convocacoes')} />;
  }
  if (tela === 'convocacoes' || tela?.convocacao) return <TelaConvocacoes convocacoes={convocacoes}
    aoCriar={async (titulo) => {
      const nova = { titulo, criadaPorUid: usuario.uid, criadaPorNome: usuario.nome || '', chamados: {} };
      if (!CONFIGURADO) {
        const id = 'cv' + Math.floor(Math.random() * 1e9);
        setConvocacoes(cs => [{ id, ...nova, criadaEm: new Date() }, ...cs]);
        setTela({ convocacao: id });
        return;
      }
      const { collection, addDoc, serverTimestamp } = fb.fns;
      const ref = await addDoc(collection(fb.db, 'convocacoes'), { ...nova, criadaEm: serverTimestamp() }).catch(() => null);
      if (ref) setTela({ convocacao: ref.id });
    }}
    aoAbrir={(c) => setTela({ convocacao: c.id })}
    aoExcluir={(c) => {
      if (!CONFIGURADO) { setConvocacoes(cs => cs.filter(x => x.id !== c.id)); return; }
      fb.fns.deleteDoc(fb.fns.doc(fb.db, 'convocacoes', c.id)).catch(() => {});
    }}
    aoVoltar={() => setTela(null)} />;

  if (tela === 'novaAcao') return <FormAcao aoCancelar={() => setTela(null)} aoSalvar={criarAcao} />;
  if (tela?.novaNota !== undefined) return <FormNota acoes={acoes} acaoInicial={tela.novaNota || ''} aoCancelar={() => setTela(tela.novaNota ? { acao: tela.novaNota } : 'notas')} aoSalvar={criarNota} />;
  if (tela === 'notas') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>📄 Notas fiscais</h2><button className="btn-mais" onClick={() => setTela({ novaNota: '' })}>+ Nota</button></div>
      <p className="dica" style={{ marginTop: 0 }}>Total registrado: <strong>{dinheiro(notas.reduce((s, n) => s + Number(n.valor || 0), 0))}</strong> · a Colheita vai mostrar tudo isso aos investidores.</p>
      {notas.length ? notas.map(n => (
        <div className="cartao" key={n.id}>
          <div className="cartao-topo"><strong>{n.descricao || 'Nota fiscal'}</strong>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{dinheiro(n.valor)}</strong>
              <button className="btn-remover" onClick={() => excluirNota(n)}>✕</button>
            </span>
          </div>
          <p className="obs" style={{ margin: 0 }}>
            {n.chave ? '✓ QR real · …' + n.chave.slice(-8) : '📷 foto'}{n.acaoTitulo ? ` · ${n.acaoTitulo}` : ''}
          </p>
          {n.foto && <img src={n.foto} alt="nota" style={{ maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />}
        </div>
      )) : <Vazio texto="Nenhuma nota registrada — toque em + Nota." />}
    </div>
  );
  if (tela === 'novoInvestidor') return <FormInvestidor acoes={acoes} aoCancelar={() => setTela(null)} aoSalvar={criarInvestidor} />;
  if (tela?.investidor) {
    const i = investidores.find(x => x.id === tela.investidor);
    if (i) return <FormInvestidor investidor={i} acoes={acoes} aoCancelar={() => setTela(null)} aoSalvar={(f) => salvarInvestidor(i, f)} aoExcluir={() => excluirInvestidor(i)} />;
  }
  if (tela?.acao) {
    const a = acoes.find(x => x.id === tela.acao);
    if (a) return <TelaAcao acao={a} equipe={equipeAtiva} pacientes={pacientes} atendimentos={atendimentos} movimentos={movimentos}
      todasAreas={todasAreas} valorDe={valorDe} ehPorDente={ehPorDente} custoAtendimento={custoAtendimento}
      notas={notas.filter(n => n.acaoId === a.id)} aoNovaNota={() => setTela({ novaNota: a.id })} aoExcluirNota={excluirNota}
      aoSalvar={(campos) => salvarAcao(a, campos)} aoExcluir={() => excluirAcao(a)} aoVoltar={() => setTela(null)} />;
  }
  if (tela?.voluntario) {
    const v = voluntarios.find(x => x.id === tela.voluntario);
    if (v) return <TelaVoluntario voluntario={v} agendamentos={agendamentos.filter(g => g.profissionalUid === v.id)}
      tempos={temposDo(v)} todasAreas={todasAreas}
      aoSalvar={(campos) => salvarVoluntario(v, campos)} aoRemover={() => removerVoluntario(v)}
      aoChamar={() => aoChamarStaff({ uid: v.id, nome: v.nome || '' })} aoVoltar={() => setTela(null)} />;
  }
  if (tela === 'novoItem') return <FormItem aoCancelar={() => setTela(null)} aoSalvar={criarItem} />;
  if (tela?.item) {
    const i = estoque.find(x => x.id === tela.item);
    if (i) return <TelaItem item={i} acoes={acoes} movimentos={movimentos.filter(m => m.itemId === i.id)}
      aoSalvar={(campos) => salvarItem(i, campos)} aoMovimentar={(delta, motivo, acaoId) => movimentar(i, delta, motivo, acaoId)}
      aoExcluir={() => excluirItem(i)} aoVoltar={() => setTela(null)} />;
  }
  if (tela === 'movimentos') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
      <h2>Histórico de materiais</h2>
      {movimentos.length ? movimentos.slice(0, 80).map(m => (
        <div className="cartao" key={m.id}>
          <div className="cartao-topo">
            <strong>{m.delta > 0 ? '📥' : '📤'} {m.itemNome}</strong>
            <span className={'chip ' + (m.delta > 0 ? 'concluído' : 'em-atendimento')}>{m.delta > 0 ? '+' : ''}{m.delta}</span>
          </div>
          <p className="obs" style={{ margin: 0 }}>
            {[m.motivo, m.acaoTitulo && `ação: ${m.acaoTitulo}`, m.valorUnit ? dinheiro(Math.abs(m.delta) * m.valorUnit) : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
      )) : <Vazio texto="Nenhuma movimentação registrada ainda." />}
    </div>
  );

  // ═══ NÚMEROS DO PAINEL ═══
  const hoje = hojeISO();
  const atendHoje = atendimentos.filter(a => isoDe(a.inicio) === hoje);
  const agendaHoje = agendamentos.filter(g => g.data === hoje);
  const totalGerado = atendimentos.filter(a => a.fim).reduce((s, a) => s + custoAtendimento(a), 0);
  const acaoDeHoje = acoes.find(a => a.data === hoje);

  return (
    <div className="tela-principal">
      <header className="compacta">
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={30} /></div>
          <div>
            <strong>Palmar</strong>
            <div className="status online">{temInternet ? `● Gestão · ${usuario.nome?.split(' ')[0] || ''}` : '📴 Sem internet'}</div>
          </div>
        </div>
      </header>

      <main>
        {aba === 'painel' && (
          <>
            <h2>Visão do projeto</h2>
            {emFalta.length > 0 && (
              <div className="erro" style={{ background: '#FBE3DA', border: '1.5px solid #E8A08C', borderRadius: 14, padding: '11px 14px', marginBottom: 10 }}>
                ⚠ {emFalta.length} material{emFalta.length === 1 ? '' : 'is'} em falta no estoque — toque na aba Estoque para ver.
              </div>
            )}
            {acaoDeHoje && (
              <button className="cartao" style={{ width: '100%', textAlign: 'left', border: '1.5px solid #37935B', cursor: 'pointer' }} onClick={() => setTela({ acao: acaoDeHoje.id })}>
                <div className="cartao-topo"><strong>🌱 Ação de hoje: {acaoDeHoje.titulo}</strong><span className={'chip ' + (acaoDeHoje.status === 'iniciada' ? 'em-atendimento' : 'aguardando')}>{acaoDeHoje.status}</span></div>
                <p className="obs" style={{ margin: 0 }}>{acaoDeHoje.local || ''} · toque para abrir o relatório em tempo real</p>
              </button>
            )}
            <div className="grade-numeros">
              <div className="cartao-numero"><strong>{pacientes.length}</strong><span>pacientes</span></div>
              <div className="cartao-numero"><strong>{pacientes.filter(p => p.triagem).length}</strong><span>triagens feitas</span></div>
              <div className="cartao-numero"><strong>{agendaHoje.length}</strong><span>agendados hoje</span></div>
              <div className="cartao-numero"><strong>{atendHoje.length}</strong><span>atendimentos hoje</span></div>
              <div className="cartao-numero"><strong>{equipeAtiva.length}</strong><span>voluntários ativos</span></div>
              <div className="cartao-numero destaque"><strong>{dinheiro(totalGerado)}</strong><span>valor já produzido</span></div>
            </div>
            <h2 style={{ fontSize: 20, marginTop: 16 }}>Chamar agora</h2>
            <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 6 }} onClick={() => setTela('chamarStaff')}>🔔 Chamar alguém da equipe</button>
            <button className="btn-principal" style={{ maxWidth: 'none' }} onClick={() => setTela('convocacoes')}>📣 Chamada de grupo (ex.: almoço)</button>
            <p className="dica" style={{ margin: '6px 0 0' }}>O celular de quem for chamado toca como uma ligação, mesmo bloqueado.</p>
          </>
        )}

        {aba === 'acoes' && (
          <>
            <div className="titulo-com-botao"><h2>Ações</h2><button className="btn-mais" onClick={() => setTela('novaAcao')}>+ Nova ação</button></div>
            <p className="dica" style={{ marginTop: 0 }}>Cada ação (mutirão) tem data, equipe escalada e o relatório completo — pacientes, custos e materiais.</p>
            {acoes.length ? acoes.map(a => (
              <div className="cartao" key={a.id} onClick={() => setTela({ acao: a.id })} style={{ cursor: 'pointer' }}>
                <div className="cartao-topo">
                  <strong>🌱 {a.titulo}</strong>
                  <span className={'chip ' + (a.status === 'iniciada' ? 'em-atendimento' : a.status === 'encerrada' ? 'concluído' : 'aguardando')}>{a.status}</span>
                </div>
                <p className="obs" style={{ margin: 0 }}>{dataBonita(a.data)}{a.local ? ` · ${a.local}` : ''} · {(a.voluntariosUids || []).length} escalado(s)</p>
              </div>
            )) : <Vazio texto="Nenhuma ação criada ainda — toque em + Nova ação." />}
          </>
        )}

        {aba === 'equipe' && (
          <>
            {(() => {
              const ranking = equipeAtiva
                .map(v => ({ v, n: atendimentos.filter(a => a.profissionalUid === v.id && a.fim).length }))
                .filter(x => x.n > 0)
                .sort((a, b) => b.n - a.n);
              return ranking.length > 0 && (
                <>
                  <h2>🏆 Ranking de atendimentos</h2>
                  {ranking.slice(0, 10).map((x, i) => (
                    <div className="cartao" key={x.v.id} style={i === 0 ? { border: '1.5px solid #F0A912' } : undefined}>
                      <div className="cartao-linha" style={{ alignItems: 'center' }}>
                        <span style={{ fontSize: 22, width: 34, textAlign: 'center' }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                        <Bolha nome={x.v.nome} />
                        <strong style={{ flex: 1 }}>{x.v.nome}</strong>
                        <span className="chip concluído">{x.n} atendimento{x.n === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
            {pendentes.length > 0 && (
              <>
                <h2>Solicitações</h2>
                {pendentes.map(v => (
                  <div className="cartao pendente" key={v.id}>
                    <div className="cartao-topo"><strong>{v.nome}</strong><span className="chip aguardando">pendente</span></div>
                    <p>{[v.email, v.telefone].filter(Boolean).join(' · ')}</p>
                    <div className="linha-botoes">
                      <button className="btn-recusar" onClick={() => responderSolicitacao(v, false)}>Recusar</button>
                      <button className="btn-aprovar" onClick={() => responderSolicitacao(v, true)}>Aprovar</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            <h2>Equipe</h2>
            <p className="dica" style={{ marginTop: 0 }}>Toque num voluntário para ver a agenda, os tempos e editar.</p>
            {equipeAtiva.length ? equipeAtiva.map(v => {
              const tempos = temposDo(v);
              return (
                <div className="cartao" key={v.id} onClick={() => setTela({ voluntario: v.id })} style={{ cursor: 'pointer' }}>
                  <div className="cartao-linha">
                    <Bolha nome={v.nome} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cartao-topo"><strong>{v.nome}</strong>
                        <button className="btn-chamar" title={'Chamar ' + v.nome} onClick={(e) => { e.stopPropagation(); aoChamarStaff({ uid: v.id, nome: v.nome || '' }); }}><BellRing size={16} strokeWidth={2.4} /></button>
                      </div>
                      <p className="obs" style={{ margin: 0 }}>{[v.ministerio, v.telefone].filter(Boolean).join(' · ')}</p>
                      {tempos.length > 0 && (
                        <p className="obs" style={{ margin: '4px 0 0' }}>
                          ⏱ {tempos.map(t => `${t.area}: ${t.media} min (previsto ${t.previsto})`).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : <Vazio texto="Nenhum voluntário ativo ainda." />}

            <div className="titulo-com-botao" style={{ marginTop: 16 }}><h2>🤝 Investidores</h2><button className="btn-mais" onClick={() => setTela('novoInvestidor')}>+ Adicionar</button></div>
            <p className="dica" style={{ marginTop: 0 }}>Quem patrocina as ações. Na Colheita, eles vão poder acompanhar tudo que foi feito com o apoio deles.</p>
            {investidores.length ? investidores.map(i => (
              <div className="cartao" key={i.id} onClick={() => setTela({ investidor: i.id })} style={{ cursor: 'pointer' }}>
                <div className="cartao-linha">
                  <Bolha nome={i.nome} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cartao-topo"><strong>{i.nome}</strong>{i.acaoTitulo && <span className="chip triado">{i.acaoTitulo}</span>}</div>
                    <p className="obs" style={{ margin: 0 }}>{[i.empresa, i.telefone, i.email].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              </div>
            )) : <Vazio texto="Nenhum investidor cadastrado ainda." />}
          </>
        )}

        {aba === 'estoque' && (
          <>
            <div className="titulo-com-botao"><h2>Estoque</h2><button className="btn-mais" onClick={() => setTela('novoItem')}>+ Material</button></div>
            {emFalta.length > 0 && (
              <div className="erro" style={{ background: '#FBE3DA', border: '1.5px solid #E8A08C', borderRadius: 14, padding: '11px 14px', marginBottom: 10 }}>
                ⚠ Em falta: {emFalta.map(i => i.nome).join(', ')}
              </div>
            )}
            {estoque.length ? estoque.map(i => {
              const falta = Number(i.quantidade || 0) <= Number(i.minimo || 0);
              return (
                <div className="cartao" key={i.id} onClick={() => setTela({ item: i.id })} style={{ cursor: 'pointer', ...(falta ? { border: '1.5px solid #E8A08C' } : {}) }}>
                  <div className="cartao-topo">
                    <strong>{i.nome}</strong>
                    <span className={'chip ' + (falta ? 'aguardando' : 'concluído')}>{i.quantidade} {i.unidade}{falta ? ' · FALTA' : ''}</span>
                  </div>
                  <p className="obs" style={{ margin: 0 }}>{dinheiro(i.valor)} por {i.unidade} · mínimo {i.minimo} {i.unidade}</p>
                </div>
              );
            }) : <Vazio texto="Nenhum material cadastrado — toque em + Material." />}
            <button className="btn-principal" style={{ maxWidth: 'none', marginTop: 8 }} onClick={() => setTela('movimentos')}>📜 Ver histórico de materiais</button>
          </>
        )}

        {aba === 'financeiro' && (
          <>
            <h2>Financeiro</h2>
            <p className="dica" style={{ marginTop: 0 }}>Defina o valor de cada procedimento. Se marcar "por dente", o valor multiplica pelos dentes marcados na triagem do paciente.</p>
            {todasAreas.map(nome => (
              <div className="cartao" key={nome}>
                <div className="cartao-topo"><strong style={{ color: corDoNome(nome) }}>{nome}</strong>
                  <label className={ehPorDente(nome) ? 'caixa marcada' : 'caixa'} style={{ margin: 0, padding: '4px 10px', fontSize: 13 }}>
                    <input type="checkbox" checked={ehPorDente(nome)} onChange={() => salvarConfig({ porDente: { ...configProc.porDente, [nome]: !ehPorDente(nome) } })} />
                    por dente
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <span className="obs">R$</span>
                  <input type="number" min="0" step="10" style={{ width: 120 }} value={configProc.valores?.[nome] ?? ''} placeholder="0"
                    onChange={e => salvarConfig({ valores: { ...configProc.valores, [nome]: Number(e.target.value || 0) } })} />
                  <span className="obs">{ehPorDente(nome) ? 'por dente tratado' : 'por atendimento'}</span>
                </div>
              </div>
            ))}
            <button className="btn-principal" style={{ maxWidth: 'none', marginTop: 8 }} onClick={() => setTela('notas')}>📄 Notas fiscais ({dinheiro(notas.reduce((s, n) => s + Number(n.valor || 0), 0))})</button>
            <p className="dica" style={{ margin: '6px 0 0' }}>Tire foto ou escaneie o QR da nota — o código prova que ela é real, e o gasto entra na ação.</p>
            <h2 style={{ fontSize: 20, marginTop: 16 }}>O que o projeto já produziu</h2>
            {(() => {
              const feitos = atendimentos.filter(a => a.fim);
              const porArea = {};
              for (const a of feitos) {
                const chave = a.area || 'Outros';
                porArea[chave] = porArea[chave] || { quantos: 0, total: 0 };
                porArea[chave].quantos++;
                porArea[chave].total += custoAtendimento(a);
              }
              const linhas = Object.entries(porArea);
              const total = linhas.reduce((s, [, v]) => s + v.total, 0);
              return linhas.length ? (
                <>
                  {linhas.map(([area, v]) => (
                    <div className="cartao" key={area}>
                      <div className="cartao-topo"><strong style={{ color: corDoNome(area) }}>{area}</strong><strong>{dinheiro(v.total)}</strong></div>
                      <p className="obs" style={{ margin: 0 }}>{v.quantos} atendimento(s) concluído(s)</p>
                    </div>
                  ))}
                  <div className="cartao" style={{ border: '1.5px solid #37935B' }}>
                    <div className="cartao-topo"><strong>💰 Total produzido</strong><strong style={{ fontSize: 20 }}>{dinheiro(total)}</strong></div>
                    <p className="obs" style={{ margin: 0 }}>É quanto esses atendimentos custariam fora do projeto — o valor doado em sorrisos.</p>
                  </div>
                </>
              ) : <Vazio texto="Quando os atendimentos forem concluídos (botão Chamar paciente no Semeador), os valores aparecem aqui." />;
            })()}
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
                  {usuario.email && <p>{usuario.email}</p>}
                  <p className="obs">Gestão · Palmar</p>
                </div>
              </div>
            </div>
            <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong>Dar acesso ao Palmar</strong>
              <p className="dica" style={{ margin: 0 }}>Gere um código e passe para outro gestor. Ele entra com a conta dele e digita o código. Cada código serve uma vez.</p>
              {codigoGerado ? (
                <>
                  <div className="codigo-grande">{codigoGerado}</div>
                  <button className="btn-secundario" onClick={() => { navigator.clipboard?.writeText(codigoGerado); }}>Copiar</button>
                </>
              ) : (
                <button className="btn-principal" style={{ maxWidth: 'none' }} onClick={gerarCodigo}>Gerar código de acesso</button>
              )}
            </div>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'painel' ? 'ativo' : ''} onClick={() => setAba('painel')}><Home size={22} /><span>Painel</span></button>
        <button className={aba === 'acoes' ? 'ativo' : ''} onClick={() => setAba('acoes')}><Flag size={22} /><span>Ações</span></button>
        <button className={aba === 'equipe' ? 'ativo' : ''} onClick={() => setAba('equipe')}>
          <span className="icone-aba"><Users size={22} />{pendentes.length > 0 && <i className="bolinha" />}</span>
          <span>Equipe</span>
        </button>
        <button className={aba === 'estoque' ? 'ativo' : ''} onClick={() => setAba('estoque')}>
          <span className="icone-aba"><Package size={22} />{emFalta.length > 0 && <i className="bolinha" />}</span>
          <span>Estoque</span>
        </button>
        <button className={aba === 'financeiro' ? 'ativo' : ''} onClick={() => setAba('financeiro')}><Wallet size={22} /><span>Valores</span></button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}><User size={22} /><span>Perfil</span></button>
      </nav>
    </div>
  );
}

// ─── Nova ação ───
function FormAcao({ aoCancelar, aoSalvar }) {
  const [f, setF] = useState({ titulo: '', data: hojeISO(), local: '' });
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>Nova ação</h2>
      <Campo rotulo="Nome da ação"><input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Mutirão da Comunidade" /></Campo>
      <Campo rotulo="Data"><input type="date" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
      <Campo rotulo="Local (opcional)"><input value={f.local} onChange={e => setF({ ...f, local: e.target.value })} placeholder="Ex.: Igreja Central" /></Campo>
      <p className="dica">Depois de criar, você escala os voluntários e acompanha o relatório em tempo real.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.titulo.trim() || !f.data} onClick={() => aoSalvar(f)}>Criar ação</button>
      </div>
    </div>
  );
}

// ─── A ação aberta: escala, status e relatório em tempo real ───
function TelaAcao({ acao, equipe, pacientes, atendimentos, movimentos, todasAreas, valorDe, ehPorDente, custoAtendimento, notas = [], aoNovaNota, aoExcluirNota, aoSalvar, aoExcluir, aoVoltar }) {
  const escalados = acao.voluntariosUids || [];
  const alternaEscala = (id) => aoSalvar({ voluntariosUids: escalados.includes(id) ? escalados.filter(x => x !== id) : [...escalados, id] });

  // Relatório do dia da ação (em tempo real, vindo do Semeador/central)
  const doDia = atendimentos.filter(a => isoDe(a.inicio) === acao.data);
  const registros = acao.registros || [];
  const custoAtend = doDia.reduce((s, a) => s + custoAtendimento(a), 0);
  const custoRegistros = registros.reduce((s, r) => s + Number(r.valor || 0), 0);
  const gastosMateriais = movimentos.filter(m => m.acaoId === acao.id && m.delta < 0);
  const custoMateriais = gastosMateriais.reduce((s, m) => s + Math.abs(m.delta) * Number(m.valorUnit || 0), 0);
  const gastoNotas = notas.reduce((s, n) => s + Number(n.valor || 0), 0);

  // Registro manual (para ações passadas ou pacientes fora do fluxo)
  const [novo, setNovo] = useState({ pacienteNome: '', area: todasAreas[0] || '', dentes: 1 });
  const valorNovo = valorDe(novo.area) * (ehPorDente(novo.area) ? Math.max(1, Number(novo.dentes || 1)) : 1);
  function adicionarRegistro() {
    if (!novo.pacienteNome.trim()) return;
    const r = { id: 'r' + Math.floor(Math.random() * 1e9), pacienteNome: novo.pacienteNome.trim(), area: novo.area, dentes: Number(novo.dentes || 1), valor: valorNovo, em: new Date() };
    aoSalvar({ registros: [...registros, r] });
    setNovo({ pacienteNome: '', area: todasAreas[0] || '', dentes: 1 });
  }

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>🌱 {acao.titulo}</h2>
        <span className={'chip ' + (acao.status === 'iniciada' ? 'em-atendimento' : acao.status === 'encerrada' ? 'concluído' : 'aguardando')}>{acao.status}</span>
      </div>
      <p className="dica" style={{ marginTop: 0 }}>{dataBonita(acao.data)}{acao.local ? ` · ${acao.local}` : ''}</p>
      <div className="linha-botoes" style={{ marginBottom: 12 }}>
        {acao.status !== 'iniciada' && <button className="btn-principal" onClick={() => aoSalvar({ status: 'iniciada', iniciadaEm: new Date() })}>▶ Iniciar ação</button>}
        {acao.status === 'iniciada' && <button className="btn-secundario" onClick={() => aoSalvar({ status: 'encerrada', encerradaEm: new Date() })}>⏹ Encerrar ação</button>}
      </div>

      <h3 style={{ margin: '10px 0 8px' }}>Equipe escalada ({escalados.length})</h3>
      <p className="dica" style={{ margin: '0 0 8px' }}>Marque quem participa desta ação.</p>
      {equipe.length ? equipe.map(v => (
        <label key={v.id} className={escalados.includes(v.id) ? 'caixa marcada' : 'caixa'} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, width: '100%' }}>
          <input type="checkbox" checked={escalados.includes(v.id)} onChange={() => alternaEscala(v.id)} />
          <Bolha nome={v.nome} />
          <span style={{ flex: 1 }}><strong>{v.nome}</strong>{v.ministerio && <span className="obs" style={{ display: 'block' }}>{v.ministerio}</span>}</span>
        </label>
      )) : <p className="dica">Nenhum voluntário ativo para escalar.</p>}

      <h3 style={{ margin: '16px 0 8px' }}>Relatório em tempo real</h3>
      <div className="grade-numeros">
        <div className="cartao-numero"><strong>{doDia.length + registros.length}</strong><span>atendimentos</span></div>
        <div className="cartao-numero"><strong>{dinheiro(custoAtend + custoRegistros)}</strong><span>valor produzido</span></div>
        <div className="cartao-numero"><strong>{gastosMateriais.length}</strong><span>materiais usados</span></div>
        <div className="cartao-numero"><strong>{dinheiro(custoMateriais)}</strong><span>custo de materiais</span></div>
        <div className="cartao-numero"><strong>{notas.length}</strong><span>notas fiscais</span></div>
        <div className="cartao-numero"><strong>{dinheiro(gastoNotas)}</strong><span>gasto em notas</span></div>
      </div>

      {doDia.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 8px' }}>Pacientes do dia (automático)</h3>
          {doDia.map(a => (
            <div className="cartao" key={a.id}>
              <div className="cartao-topo"><strong>{a.pacienteNome}</strong><strong>{dinheiro(custoAtendimento(a))}</strong></div>
              <p className="obs" style={{ margin: 0 }}>{a.area} · {a.profissionalNome}{a.duracaoMin ? ` · ${a.duracaoMin} min` : a.fim ? '' : ' · em andamento'}</p>
            </div>
          ))}
        </>
      )}

      <h3 style={{ margin: '14px 0 8px' }}>Adicionar atendimento manual</h3>
      <p className="dica" style={{ margin: '0 0 8px' }}>Para registrar ações passadas ou algo feito fora do fluxo — o valor sai da tabela de Valores (por dente, quando marcado).</p>
      <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={novo.pacienteNome} onChange={e => setNovo({ ...novo, pacienteNome: e.target.value })} placeholder="Nome do paciente" />
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ flex: 1 }} value={novo.area} onChange={e => setNovo({ ...novo, area: e.target.value })}>
            {todasAreas.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {ehPorDente(novo.area) && <input type="number" min="1" style={{ width: 90 }} value={novo.dentes} onChange={e => setNovo({ ...novo, dentes: e.target.value })} placeholder="dentes" />}
        </div>
        <div className="cartao-topo"><span className="obs">{ehPorDente(novo.area) ? `${novo.dentes || 1} dente(s)` : 'por atendimento'}</span><strong>{dinheiro(valorNovo)}</strong></div>
        <button className="btn-mais" disabled={!novo.pacienteNome.trim()} onClick={adicionarRegistro}>+ Registrar</button>
      </div>
      {registros.length > 0 && registros.map(r => (
        <div className="cartao" key={r.id}>
          <div className="cartao-topo"><strong>{r.pacienteNome}</strong>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{dinheiro(r.valor)}</strong>
              <button className="btn-remover" onClick={() => aoSalvar({ registros: registros.filter(x => x.id !== r.id) })}>✕</button>
            </span>
          </div>
          <p className="obs" style={{ margin: 0 }}>{r.area}{r.dentes > 1 ? ` · ${r.dentes} dentes` : ''} · manual</p>
        </div>
      ))}

      <div className="titulo-com-botao" style={{ marginTop: 14 }}><h3 style={{ margin: 0 }}>📄 Notas fiscais da ação</h3>
        <button className="btn-mais" onClick={aoNovaNota}>+ Nota</button>
      </div>
      {notas.length ? notas.map(n => (
        <div className="cartao" key={n.id}>
          <div className="cartao-topo"><strong>{n.descricao || 'Nota fiscal'}</strong>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{dinheiro(n.valor)}</strong>
              <button className="btn-remover" onClick={() => aoExcluirNota(n)}>✕</button>
            </span>
          </div>
          <p className="obs" style={{ margin: 0 }}>{n.chave ? '✓ QR real · …' + n.chave.slice(-8) : '📷 foto'}</p>
          {n.foto && <img src={n.foto} alt="nota" style={{ maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />}
        </div>
      )) : <p className="dica" style={{ margin: '4px 0 0' }}>Nenhuma nota nesta ação — toque em + Nota para fotografar ou escanear o QR.</p>}

      {gastosMateriais.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 8px' }}>Materiais usados nesta ação</h3>
          {gastosMateriais.map(m => (
            <div className="cartao" key={m.id}>
              <div className="cartao-topo"><strong>{m.itemNome}</strong><strong>{dinheiro(Math.abs(m.delta) * m.valorUnit)}</strong></div>
              <p className="obs" style={{ margin: 0 }}>{Math.abs(m.delta)} unidade(s){m.motivo ? ` · ${m.motivo}` : ''}</p>
            </div>
          ))}
        </>
      )}

      <button className="btn-sair" style={{ width: '100%', marginTop: 14 }} onClick={aoExcluir}>🗑 Excluir esta ação</button>
    </div>
  );
}

// ─── O voluntário aberto: editar, agenda, tempos, remover ───
function TelaVoluntario({ voluntario: v, agendamentos, tempos, todasAreas, aoSalvar, aoRemover, aoChamar, aoVoltar }) {
  const [f, setF] = useState({ nome: v.nome || '', telefone: v.telefone || '', ministerio: v.ministerio || '', email: v.email || '' });
  const [editando, setEditando] = useState(false);
  const procs = v.procedimentos || [];
  const alternaProc = (nome) => aoSalvar({ procedimentos: procs.includes(nome) ? procs.filter(x => x !== nome) : [...procs, nome] });
  const porData = {};
  for (const g of agendamentos) (porData[g.data] = porData[g.data] || []).push(g);
  const datas = Object.keys(porData).sort();
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="cartao">
        <div className="cartao-linha">
          <Bolha nome={v.nome} />
          <div style={{ flex: 1 }}>
            <div className="cartao-topo"><strong>{v.nome}</strong>
              <button className="btn-chamar" title="Chamar" onClick={aoChamar}><BellRing size={16} strokeWidth={2.4} /></button>
            </div>
            <p className="obs" style={{ margin: 0 }}>{[v.ministerio, v.telefone, v.email].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      </div>

      {editando ? (
        <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Nome" />
          <input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="Telefone" />
          <input value={f.ministerio} onChange={e => setF({ ...f, ministerio: e.target.value })} placeholder="Ministério / função" />
          <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="E-mail" />
          <div className="linha-botoes">
            <button className="btn-secundario" onClick={() => setEditando(false)}>Cancelar</button>
            <button className="btn-principal" onClick={() => { aoSalvar(f); setEditando(false); }}>Salvar</button>
          </div>
        </div>
      ) : (
        <button className="btn-secundario" style={{ width: '100%', marginBottom: 10 }} onClick={() => setEditando(true)}><Pencil size={15} /> Editar dados</button>
      )}

      <h3 style={{ margin: '10px 0 8px' }}>Procedimentos que faz</h3>
      <div className="caixas">
        {todasAreas.map(nome => (
          <label key={nome} className={procs.includes(nome) ? 'caixa marcada' : 'caixa'}>
            <input type="checkbox" checked={procs.includes(nome)} onChange={() => alternaProc(nome)} />
            {nome}
          </label>
        ))}
      </div>

      <h3 style={{ margin: '14px 0 8px' }}>⏱ Tempos (média × previsto)</h3>
      {tempos.length ? tempos.map(t => (
        <div className="cartao" key={t.area}>
          <div className="cartao-topo"><strong style={{ color: corDoNome(t.area) }}>{t.area}</strong>
            <span className={'chip ' + (t.media <= t.previsto ? 'concluído' : 'aguardando')}>{t.media} min · previsto {t.previsto}</span>
          </div>
          <p className="obs" style={{ margin: 0 }}>{t.quantos} atendimento(s) medido(s){t.media > t.previsto ? ` · ${t.media - t.previsto} min acima do previsto` : ' · dentro do previsto 👏'}</p>
        </div>
      )) : <p className="dica">Sem atendimentos medidos ainda (o cronômetro liga quando ele usa "Chamar paciente" no Semeador).</p>}

      <h3 style={{ margin: '14px 0 8px' }}>📅 Agenda</h3>
      {datas.length ? datas.map(d => (
        <div key={d}>
          <p className="dica" style={{ margin: '8px 0 4px', fontWeight: 800 }}>{dataBonita(d)}</p>
          {porData[d].sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(g => (
            <div className="cartao" key={g.id}>
              <div className="cartao-topo"><strong>{g.hora} · {g.pacienteNome || g.titulo}</strong><span className="chip triado">{g.area || g.titulo}</span></div>
            </div>
          ))}
        </div>
      )) : <p className="dica">Nenhum agendamento para este voluntário.</p>}

      <button className="btn-sair" style={{ width: '100%', marginTop: 14 }} onClick={aoRemover}>🗑 Remover da equipe</button>
    </div>
  );
}

// ─── Nota fiscal: tirar foto (valor manual) ou escanear o QR (chave de 44
// dígitos que prova que a nota é real — e o valor entra sozinho quando vem) ───
function FormNota({ acoes, acaoInicial, aoCancelar, aoSalvar }) {
  const [f, setF] = useState({ acaoId: acaoInicial || '', descricao: '', valor: '', foto: '', chave: '', url: '', origem: '' });
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');

  async function pegarFoto(e) {
    setErro('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await comprimirImagem(file, 0.6, 900);
      if (dataUrl.length > 900000) dataUrl = await comprimirImagem(file, 0.45, 700);
      if (dataUrl.length > 900000) { setErro('A foto ficou grande demais — tente de novo.'); return; }
      setF(x => ({ ...x, foto: dataUrl, origem: x.origem || 'foto' }));
    } catch (e2) { setErro('Não consegui ler essa imagem.'); }
  }

  function leuQR(texto) {
    setLendo(false);
    const { chave, valor, url } = lerNotaDoQR(texto);
    if (!chave) { setErro('Esse QR não parece de nota fiscal (não achei a chave de 44 dígitos).'); return; }
    setF(x => ({ ...x, chave, url, origem: 'qr', valor: valor ? String(valor) : x.valor }));
  }

  const valorNum = Number(String(f.valor).replace(',', '.')) || 0;

  if (lendo) return <LeitorQR aoLer={leuQR} aoFechar={() => setLendo(false)} />;
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>📄 Nova nota fiscal</h2>
      <div className="linha-botoes" style={{ marginBottom: 10 }}>
        <button className="btn-principal" onClick={() => { setErro(''); setLendo(true); }}>🔎 Escanear QR</button>
        <label className="btn-secundario" style={{ cursor: 'pointer', textAlign: 'center' }}>
          📷 Tirar foto
          <input type="file" accept="image/*" capture="environment" onChange={pegarFoto} style={{ display: 'none' }} />
        </label>
      </div>
      {f.chave && <div className="cartao" style={{ border: '1.5px solid #37935B' }}>
        <div className="cartao-topo"><strong>✓ Nota real (QR lido)</strong><span className="chip concluído">…{f.chave.slice(-8)}</span></div>
        <p className="obs" style={{ margin: 0 }}>Chave: {f.chave}</p>
      </div>}
      {f.foto && <img src={f.foto} alt="nota" style={{ maxWidth: '100%', borderRadius: 12, marginBottom: 10 }} />}
      <Campo rotulo="Valor da nota (R$)">
        <input type="number" min="0" step="0.01" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} placeholder={f.origem === 'qr' && !f.valor ? 'Esse QR não trouxe o valor — digite' : '0,00'} />
      </Campo>
      <Campo rotulo="Do que é (opcional)"><input value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: materiais descartáveis" /></Campo>
      <Campo rotulo="Ação vinculada">
        <select value={f.acaoId} onChange={e => setF({ ...f, acaoId: e.target.value })}>
          <option value="">Sem ação</option>
          {acoes.map(a => <option key={a.id} value={a.id}>{a.titulo} ({dataBonita(a.data)})</option>)}
        </select>
      </Campo>
      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!valorNum && !f.chave} onClick={() => aoSalvar({ ...f, valor: valorNum, origem: f.origem || (f.chave ? 'qr' : 'foto') })}>Salvar nota</button>
      </div>
    </div>
  );
}

// ─── Investidor (patrocinador de ação — a Colheita mostra tudo a ele) ───
function FormInvestidor({ investidor, acoes, aoCancelar, aoSalvar, aoExcluir }) {
  const [f, setF] = useState({
    nome: investidor?.nome || '', empresa: investidor?.empresa || '',
    telefone: investidor?.telefone || '', email: investidor?.email || '',
    acaoId: investidor?.acaoId || '', observacoes: investidor?.observacoes || '',
  });
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>🤝 {investidor ? 'Investidor' : 'Novo investidor'}</h2>
      <Campo rotulo="Nome"><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Nome do investidor" /></Campo>
      <Campo rotulo="Empresa (opcional)"><input value={f.empresa} onChange={e => setF({ ...f, empresa: e.target.value })} /></Campo>
      <Campo rotulo="Telefone"><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} /></Campo>
      <Campo rotulo="E-mail"><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Vai servir para ele entrar na Colheita" /></Campo>
      <Campo rotulo="Ação que patrocina (opcional)">
        <select value={f.acaoId} onChange={e => setF({ ...f, acaoId: e.target.value })}>
          <option value="">Nenhuma / o projeto todo</option>
          {acoes.map(a => <option key={a.id} value={a.id}>{a.titulo} ({dataBonita(a.data)})</option>)}
        </select>
      </Campo>
      <Campo rotulo="Observações"><input value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} /></Campo>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Salvar</button>
      </div>
      {investidor && <button className="btn-sair" style={{ width: '100%', marginTop: 10 }} onClick={aoExcluir}>🗑 Remover investidor</button>}
    </div>
  );
}

// ─── Estoque: novo material e material aberto ───
function FormItem({ aoCancelar, aoSalvar }) {
  const [f, setF] = useState({ nome: '', quantidade: 0, unidade: 'un', valor: 0, minimo: 0 });
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>Novo material</h2>
      <Campo rotulo="Nome"><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Luvas de procedimento" /></Campo>
      <Campo rotulo="Quantidade atual"><input type="number" min="0" value={f.quantidade} onChange={e => setF({ ...f, quantidade: Number(e.target.value || 0) })} /></Campo>
      <Campo rotulo="Unidade (un, caixa, tubete…)"><input value={f.unidade} onChange={e => setF({ ...f, unidade: e.target.value })} /></Campo>
      <Campo rotulo="Valor por unidade (R$)"><input type="number" min="0" step="0.5" value={f.valor} onChange={e => setF({ ...f, valor: Number(e.target.value || 0) })} /></Campo>
      <Campo rotulo="Quantidade mínima (alerta de falta)"><input type="number" min="0" value={f.minimo} onChange={e => setF({ ...f, minimo: Number(e.target.value || 0) })} /></Campo>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Adicionar</button>
      </div>
    </div>
  );
}

function TelaItem({ item, acoes, movimentos, aoSalvar, aoMovimentar, aoExcluir, aoVoltar }) {
  const [mov, setMov] = useState({ qtd: 1, motivo: '', acaoId: '' });
  const falta = Number(item.quantidade || 0) <= Number(item.minimo || 0);
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>{item.nome}</h2>
        <span className={'chip ' + (falta ? 'aguardando' : 'concluído')}>{item.quantidade} {item.unidade}{falta ? ' · FALTA' : ''}</span>
      </div>
      <p className="dica" style={{ marginTop: 0 }}>{dinheiro(item.valor)} por {item.unidade} · alerta abaixo de {item.minimo} {item.unidade}</p>

      <h3 style={{ margin: '10px 0 8px' }}>Movimentar</h3>
      <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" min="1" style={{ width: 90 }} value={mov.qtd} onChange={e => setMov({ ...mov, qtd: Math.max(1, Number(e.target.value || 1)) })} />
          <input style={{ flex: 1 }} value={mov.motivo} onChange={e => setMov({ ...mov, motivo: e.target.value })} placeholder="Motivo (ex.: mutirão, compra…)" />
        </div>
        <select value={mov.acaoId} onChange={e => setMov({ ...mov, acaoId: e.target.value })}>
          <option value="">Sem ação vinculada</option>
          {acoes.map(a => <option key={a.id} value={a.id}>{a.titulo} ({dataBonita(a.data)})</option>)}
        </select>
        <div className="linha-botoes">
          <button className="btn-secundario" onClick={() => aoMovimentar(-mov.qtd, mov.motivo, mov.acaoId)}>📤 Saída (−{mov.qtd})</button>
          <button className="btn-principal" onClick={() => aoMovimentar(mov.qtd, mov.motivo, mov.acaoId)}>📥 Entrada (+{mov.qtd})</button>
        </div>
      </div>

      <h3 style={{ margin: '14px 0 8px' }}>Ajustes</h3>
      <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Campo rotulo="Valor por unidade (R$)"><input type="number" min="0" step="0.5" defaultValue={item.valor} onBlur={e => aoSalvar({ valor: Number(e.target.value || 0) })} /></Campo>
        <Campo rotulo="Quantidade mínima"><input type="number" min="0" defaultValue={item.minimo} onBlur={e => aoSalvar({ minimo: Number(e.target.value || 0) })} /></Campo>
      </div>

      <h3 style={{ margin: '14px 0 8px' }}>Últimas movimentações</h3>
      {movimentos.length ? movimentos.slice(0, 15).map(m => (
        <div className="cartao" key={m.id}>
          <div className="cartao-topo"><strong>{m.delta > 0 ? '📥 Entrada' : '📤 Saída'}</strong><span className={'chip ' + (m.delta > 0 ? 'concluído' : 'em-atendimento')}>{m.delta > 0 ? '+' : ''}{m.delta}</span></div>
          <p className="obs" style={{ margin: 0 }}>{[m.motivo, m.acaoTitulo && `ação: ${m.acaoTitulo}`].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      )) : <p className="dica">Nenhuma movimentação ainda.</p>}

      <button className="btn-sair" style={{ width: '100%', marginTop: 14 }} onClick={aoExcluir}>🗑 Excluir material</button>
    </div>
  );
}

// ─── O aplicativo (login → acesso → telas) ───
function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(CONFIGURADO ? null : lerLocal('pm-usuario', null));
  const [acesso, setAcesso] = useState(CONFIGURADO ? 'checando' : 'liberado');

  useEffect(() => { if (!CONFIGURADO) gravarLocal('pm-usuario', usuario); }, [usuario]);

  // Acesso: o primeiro gestor vira fundador; os demais entram por código
  // (palmar-codigos) ou e-mail autorizado (palmar-autorizados)
  useEffect(() => {
    if (!CONFIGURADO) { setAcesso('liberado'); return; }
    if (!usuario) { setAcesso('checando'); return; }
    let cancelado = false;
    const lembrete = 'pm-ja-entrou-' + usuario.uid;
    const libera = () => { gravarLocal(lembrete, true); if (!cancelado) setAcesso('liberado'); };
    const nega = () => { if (!cancelado) setAcesso(lerLocal(lembrete, false) ? 'liberado' : 'pedir'); };
    (async () => {
      try {
        const { doc, getDoc, setDoc, getDocs, collection, query, limit, serverTimestamp } = fb.fns;
        const meu = await getDoc(doc(fb.db, 'palmar-usuarios', usuario.uid));
        if (meu.exists()) { libera(); return; }
        if (usuario.email) {
          const conv = await getDoc(doc(fb.db, 'palmar-autorizados', usuario.email.toLowerCase()));
          if (conv.exists()) {
            setDoc(doc(fb.db, 'palmar-usuarios', usuario.uid), { nome: usuario.nome || '', email: usuario.email || '', papel: 'gestor', criadoEm: serverTimestamp() }).catch(() => {});
            libera();
            return;
          }
        }
        const algum = await getDocs(query(collection(fb.db, 'palmar-usuarios'), limit(1)));
        if (algum.empty) {
          setDoc(doc(fb.db, 'palmar-usuarios', usuario.uid), { nome: usuario.nome || '', email: usuario.email || '', papel: 'fundador', criadoEm: serverTimestamp() }).catch(() => {});
          libera();
          return;
        }
        nega();
      } catch (e) { nega(); }
    })();
    return () => { cancelado = true; };
  }, [usuario]);

  async function resgatarCodigo(codigo) {
    const cod = codigo.trim().toUpperCase();
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = fb.fns;
    const ref = doc(fb.db, 'palmar-codigos', cod);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 'Código não encontrado. Confira as letras.';
    if (snap.data().usadoPor) return 'Esse código já foi usado.';
    setDoc(doc(fb.db, 'palmar-usuarios', usuario.uid), { nome: usuario.nome || '', email: usuario.email || '', papel: 'gestor', criadoEm: serverTimestamp() }).catch(() => {});
    updateDoc(ref, { usadoPor: usuario.uid, usadoPorNome: usuario.nome || '', usadoEm: serverTimestamp() }).catch(() => {});
    gravarLocal('pm-ja-entrou-' + usuario.uid, true);
    setAcesso('liberado');
    return '';
  }

  const [erroInicial, setErroInicial] = useState('');
  const largou = useRef(false);

  useEffect(() => {
    if (!CONFIGURADO) return;
    const pega = (e) => {
      if (largou.current) return;
      const m = String(e?.reason?.message || e?.message || e?.type || e || '');
      if (!m || m === 'error' || m.toLowerCase().includes('script error')) return;
      setErroInicial(atual => atual || m);
    };
    window.addEventListener('unhandledrejection', pega);
    window.addEventListener('error', pega);
    let soltar = null;
    ligarFirebase().then(() => {
      if (!window.__loginGoogleNativo && !window.__entrarNativoGoogle) fb.fns.getRedirectResult?.(fb.auth).catch(() => {});
      soltar = fb.fns.onAuthStateChanged(fb.auth, u => {
        setUsuario(u ? { uid: u.uid, email: u.email, nome: u.displayName || u.email, foto: u.photoURL || '' } : null);
        setPronto(true);
        largou.current = true;
      });
    }).catch(e => { setErroInicial(String(e?.message || e)); setPronto(true); });
    return () => { soltar?.(); window.removeEventListener('unhandledrejection', pega); window.removeEventListener('error', pega); };
  }, []);

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    if (window.__sairNativoGoogle) { try { await window.__sairNativoGoogle(); } catch (e) { /* segue */ } }
    setUsuario(null);
  }

  // ─── Chamadas (paciente e staff): a mesma tela de ligação dos outros ───
  const [chamadas, setChamadas] = useState([]);
  const [chamadasVistas, setChamadasVistas] = useState([]);
  useEffect(() => {
    if (!CONFIGURADO || !usuario) return;
    const { collection, onSnapshot, query, where } = fb.fns;
    return onSnapshot(query(collection(fb.db, 'chamadas'), where('ativa', '==', true)), snap => {
      const agora = Date.now();
      setChamadas(snap.docs.map(d => {
        const c = { id: d.id, ...d.data() };
        const t = c.criadoEm?.toDate?.()?.getTime?.() ?? agora;
        return { ...c, nova: agora - t < 3 * 60 * 1000 };
      }));
    });
  }, [usuario?.uid]);
  function encerrarChamada(c, atendida) {
    setChamadasVistas(v => [...v, c.id]);
    if (!CONFIGURADO) { setChamadas(cs => cs.filter(x => x.id !== c.id)); return; }
    const { doc, updateDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'chamadas', c.id), atendida
      ? { ativa: false, atendidaPorUid: usuario?.uid, atendidaPorNome: usuario?.nome || '', atendidaEm: serverTimestamp() }
      : { ativa: false }).catch(() => {});
  }
  const chamadaNaTela = chamadas.find(c => c.ativa !== false && c.nova && !chamadasVistas.includes(c.id)
    && (CONFIGURADO ? c.chamadoPorAparelho !== idAparelho() : true)
    && (!CONFIGURADO || c.tipo !== 'staff' || c.paraUid === usuario?.uid));
  function chamarStaff(pessoa, motivo = '', convocacaoId = '') {
    const dados = {
      tipo: 'staff', paraUid: pessoa.uid, paraNome: pessoa.nome || '', paraFoto: pessoa.foto || '',
      chamadoPorUid: usuario?.uid || '', chamadoPorNome: usuario?.nome || '',
      chamadoPorFoto: usuario?.foto || '', chamadoPorAparelho: idAparelho(), ativa: true,
      ...(motivo ? { motivo, convocacaoId } : {}),
    };
    if (!CONFIGURADO) { setChamadas(cs => [...cs, { id: 'c' + Math.floor(Math.random() * 1e9), ...dados, nova: true }]); return; }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'chamadas'), { ...dados, criadoEm: serverTimestamp() }).catch(() => {});
  }
  useEffect(() => {
    window.__atenderChamada = (id) => encerrarChamada({ id }, true);
    return () => { delete window.__atenderChamada; };
  });
  // Push (quando a casca nativa do Palmar existir): registra o aparelho
  useEffect(() => {
    if (!CONFIGURADO || !usuario || !window.__registrarPush) return;
    const { doc, setDoc, serverTimestamp } = fb.fns;
    const grava = (token) => {
      if (!token) return;
      setDoc(doc(fb.db, 'aparelhos', token), {
        uid: usuario.uid, nome: usuario.nome || '', app: 'palmar',
        aparelho: idAparelho(), atualizadoEm: serverTimestamp(),
        ...(window.__tokenVoip ? { voipToken: window.__tokenVoip } : {}),
      }, { merge: true }).catch(() => {});
    };
    grava(window.__tokenPush);
    const ouve = (e) => grava(e.detail);
    const ouveVoip = () => grava(window.__tokenPush);
    window.addEventListener('token-push', ouve);
    window.addEventListener('token-voip', ouveVoip);
    window.__registrarPush();
    const vigia = setInterval(() => { if (window.__tokenVoip && window.__tokenPush) { grava(window.__tokenPush); clearInterval(vigia); } }, 3000);
    setTimeout(() => clearInterval(vigia), 60000);
    return () => { clearInterval(vigia); window.removeEventListener('token-push', ouve); window.removeEventListener('token-voip', ouveVoip); };
  }, [usuario?.uid]);

  const [abrindo, setAbrindo] = useState(true);
  const abertura = abrindo ? <Abertura tema="verde" nome="Palmar" frase="quem coordena, faz crescer" aoTerminar={() => setAbrindo(false)} /> : null;

  let conteudo;
  if (erroInicial) conteudo = (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Ops, algo travou</h1>
      <p className="login-sub">Erro técnico na largada — manda um print desta tela:<br /><b>{erroInicial}</b></p>
      <button className="btn-principal" onClick={() => window.location.reload()}>Tentar de novo</button>
    </div>
  );
  else if (!pronto) conteudo = <div className="carregando"><LogoApp tamanho={96} /></div>;
  else if (!usuario) conteudo = <TelaLogin aoEntrarDemo={setUsuario} />;
  else if (acesso === 'checando') conteudo = <div className="carregando"><LogoApp tamanho={96} /></div>;
  else if (acesso === 'pedir') conteudo = <TelaCodigo usuario={usuario} aoResgatar={resgatarCodigo} aoSair={sair} />;
  else conteudo = <TelaPrincipal usuario={usuario} aoSair={sair} aoChamarStaff={chamarStaff} />;
  return <>{conteudo}{chamadaNaTela && <TelaChamada chamada={chamadaNaTela} aoAtender={c => encerrarChamada(c, true)} />}{abertura}</>;
}


export { App };
