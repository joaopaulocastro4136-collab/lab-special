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
import { RedeDeSeguranca } from '../rede.jsx';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal, corDoNome, Abertura, GoogleG, BrotoMini, ligarGestoVoltar, usarTemInternet, idAparelho } from '../logo.jsx';
import { Home, Flag, Users, Package, Wallet, User, ChevronLeft, ChevronRight, Clock, Tag, Plus, Mail, Lock, Eye, EyeOff, BellRing, Megaphone, TriangleAlert, CalendarDays, Pencil, Trash2, Camera, Images } from 'lucide-react';
import { TelaChamada, TelaChamarStaff, TelaConvocacoes, TelaConvocacao } from '../chamada.jsx';
import { comprimirImagem } from '../ficha.jsx';
import { SeletorUnidade, Contador } from '../estoque.jsx';
import { Arcada } from '../dentes.jsx';
import { CartaoDepoimento } from '../depoimento.jsx';
import { TelaApagarConta, BotaoApagarConta, apagarConta } from '../conta.jsx';

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
// Quantidade de um item do estoque, aceitando os dois nomes de campo
// (`quantidade` daqui do Palmar e `qtd` da central/Semeador)
function qtdEstoque(item) {
  return Number(item?.quantidade ?? item?.qtd ?? 0);
}

// Variação de um movimento de estoque: o Palmar grava `delta` (±) e a
// central/Semeador gravam `tipo` + `qtd` — esta função entende os dois
function deltaMov(m) {
  if (typeof m?.delta === 'number') return m.delta;
  const q = Number(m?.qtd || 0);
  return m?.tipo === 'entrada' ? q : -q;
}

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
          <stop offset="0" stopColor="#2A6B45" /><stop offset="1" stopColor="#143D28" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#pm-fundo)" />
      <circle cx="50" cy="47" r="33" fill="#4F8C5C" stroke="#9FC7A4" strokeWidth="2" />
      <g fill="#FFFFFF">
        <path d="M50 20 L60 34 L54 34 L63 47 L56 47 L66 61 L34 61 L44 47 L37 47 L46 34 L40 34 Z" />
        <rect x="47" y="61" width="6" height="11" rx="1.4" />
      </g>
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
// Os dias que uma ação cobre (do início ao fim). Ações antigas, sem
// `dataFim`, cobrem só o dia da data — continuam funcionando igual.
function diasDaAcao(a) {
  if (!a?.data) return [];
  const fim = a.dataFim && a.dataFim >= a.data ? a.dataFim : a.data;
  const dias = [];
  const d = new Date(a.data + 'T12:00:00');
  const alvo = new Date(fim + 'T12:00:00');
  while (d <= alvo && dias.length < 120) {
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return dias;
}
// A ação está acontecendo neste dia?
function acaoPegaODia(a, iso) {
  if (!a?.data || !iso) return false;
  const fim = a.dataFim && a.dataFim >= a.data ? a.dataFim : a.data;
  return iso >= a.data && iso <= fim;
}
// Texto do período: "sexta, 26/08" ou "26/08 a 28/08"
// Data com hora, para o registro de início/encerramento
function quandoBonito(v) {
  const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
  if (!d || isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function periodoBonito(a) {
  if (!a?.data) return '';
  if (!a.dataFim || a.dataFim === a.data) return dataBonita(a.data);
  const curto = (iso) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
  return `${curto(a.data)} a ${curto(a.dataFim)} (${diasDaAcao(a).length} dias)`;
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

function TelaCodigo({ usuario, aoResgatar, aoSair, aoApagarConta }) {
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
      {aoApagarConta && <button className="link-troca" style={{ color: '#B3402A' }} onClick={aoApagarConta}>Apagar minha conta</button>}
    </div>
  );
}

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}
function Vazio({ texto }) { return <div className="vazio">{texto}</div>; }

// ─── A tela principal, com as abas ───
function TelaPrincipal({ usuario, aoSair, aoApagarConta, aoChamarStaff }) {
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
  const [procedimentos, setProcedimentos] = useState(CONFIGURADO ? [] : (DEMO.procedimentos || []));
  const [depoimentos, setDepoimentos] = useState(CONFIGURADO ? [] : (DEMO.depoimentos || []));
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
      escuta('estoque-movimentos', ['criadoEm', 'desc'], setMovimentos),
      escuta('convocacoes', ['criadaEm', 'desc'], setConvocacoes),
      escuta('investidores', ['nome'], setInvestidores),
      escuta('notas', ['criadaEm', 'desc'], setNotas),
      // O que os dentistas registraram no Semeador (dentes tratados, o que
      // foi feito e as fotos de antes/depois) — é isto que mostra, pessoa
      // por pessoa, o trabalho de cada ação
      escuta('procedimentos-feitos', ['em', 'desc'], setProcedimentos),
      escuta('depoimentos', ['criadoEm', 'desc'], setDepoimentos),
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
    // O formulário já pode trazer a escala e, na ação ANTIGA, os
    // procedimentos lançados e o status encerrado
    const nova = {
      status: 'planejada', voluntariosUids: [], registros: [], retroativa: false,
      dataFim: f.data, ...f, criadaPorUid: usuario.uid, criadaPorNome: usuario.nome || '',
    };
    // O que cada pessoa vai fazer na ação entra também no cadastro dela —
    // é assim que o Seja Semente passa a oferecer aquele dentista na hora de
    // agendar o procedimento
    for (const [uid, procs] of Object.entries(f.procedimentosPorUid || {})) {
      const v = voluntarios.find(x => x.id === uid);
      if (!v || !procs.length) continue;
      const juntos = [...new Set([...(v.procedimentos || []), ...procs])];
      if (juntos.length !== (v.procedimentos || []).length) salvarVoluntario(v, { procedimentos: juntos });
    }
    if (!CONFIGURADO) {
      const id = 'ac' + Math.floor(Math.random() * 1e9);
      setAcoes(as => [{ id, ...nova, criadaEm: new Date() }, ...as]);
      setTela({ acao: id });
      return;
    }
    const { collection, doc, setDoc, serverTimestamp } = fb.fns;
    const ref = doc(collection(fb.db, 'acoes'));
    setDoc(ref, { ...nova, criadaEm: serverTimestamp() }).catch(() => {});
    setTela({ acao: ref.id });
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
  // O Palmar chama a quantidade de `quantidade`; a central e o Semeador
  // chamam de `qtd`. Toda gravação daqui grava OS DOIS, e toda leitura aceita
  // os dois — assim os três aplicativos veem exatamente o mesmo estoque.
  async function criarItem(f) {
    const dados = { ...f, qtd: Number(f.quantidade || 0) };
    if (!CONFIGURADO) { setEstoque(es => [...es, { id: 'e' + Math.floor(Math.random() * 1e9), ...dados }].sort((a, b) => a.nome.localeCompare(b.nome))); setTela(null); return; }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'estoque'), { ...dados, criadoEm: serverTimestamp() }).catch(() => {});
    setTela(null);
  }
  async function salvarItem(item, campos) {
    if (campos.quantidade !== undefined) campos = { ...campos, qtd: Number(campos.quantidade || 0) };
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
    // Nunca retirar mais do que existe: o registro precisa bater com a baixa
    if (delta < 0) delta = -Math.min(-delta, qtdEstoque(item));
    if (!delta) return;
    const acao = acoes.find(a => a.id === acaoId);
    const registro = {
      itemId: item.id, itemNome: item.nome, delta, motivo: motivo || '',
      // dialeto da central/Semeador (eles mostram tipo + qtd no extrato)
      tipo: delta < 0 ? 'saida' : 'entrada', qtd: Math.abs(delta), unidade: item.unidade || 'un',
      acaoId: acaoId || '', acaoTitulo: acao?.titulo || '', valorUnit: Number(item.valor || 0),
      autorUid: usuario.uid, autorNome: usuario.nome || '',
    };
    const novaQtd = Math.max(0, qtdEstoque(item) + delta);
    if (!CONFIGURADO) {
      setEstoque(es => es.map(x => x.id === item.id ? { ...x, quantidade: novaQtd, qtd: novaQtd } : x));
      setMovimentos(ms => [{ id: 'm' + Math.floor(Math.random() * 1e9), ...registro, em: new Date() }, ...ms]);
      return;
    }
    const { doc, updateDoc, collection, addDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'estoque', item.id), { quantidade: novaQtd, qtd: novaQtd }).catch(() => {});
    addDoc(collection(fb.db, 'estoque-movimentos'), { ...registro, em: serverTimestamp(), criadoEm: serverTimestamp() }).catch(() => {});
  }
  const emFalta = estoque.filter(i => qtdEstoque(i) <= Number(i.minimo || 0));

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
      const { collection, doc, setDoc, serverTimestamp } = fb.fns;
      const ref = doc(collection(fb.db, 'convocacoes'));
      setDoc(ref, { ...nova, criadaEm: serverTimestamp() }).catch(() => {});
      setTela({ convocacao: ref.id });
    }}
    aoAbrir={(c) => setTela({ convocacao: c.id })}
    aoExcluir={(c) => {
      if (!CONFIGURADO) { setConvocacoes(cs => cs.filter(x => x.id !== c.id)); return; }
      fb.fns.deleteDoc(fb.fns.doc(fb.db, 'convocacoes', c.id)).catch(() => {});
    }}
    aoVoltar={() => setTela(null)} />;

  if (tela === 'novaAcao' || tela === 'acaoAntiga') return <FormAcao
    antiga={tela === 'acaoAntiga'} equipe={equipeAtiva} todasAreas={todasAreas}
    valorDe={valorDe} ehPorDente={ehPorDente}
    aoCancelar={() => setTela(null)} aoSalvar={criarAcao} />;
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
  if (tela === 'valores') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
      <h2>🏷 Valores dos procedimentos</h2>
      <p className="dica" style={{ marginTop: 0 }}>Quanto vale cada procedimento. Se marcar "por dente", o valor multiplica pelos dentes marcados na triagem do paciente.</p>
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
    </div>
  );
  // ── Ficha do paciente vista pela gestão: um checkup completo, só leitura ──
  if (tela?.paciente) {
    const p = pacientes.find(x => x.id === tela.paciente);
    if (p) return <FichaGestao paciente={p} fb={CONFIGURADO ? fb : null}
      procedimentos={procedimentos.filter(r => r.pacienteId === p.id)}
      atendimentos={atendimentos.filter(a => a.pacienteId === p.id && a.fim)}
      agendamentos={agendamentos.filter(g => g.pacienteId === p.id)}
      depoimento={depoimentos.find(d => d.pacienteId === p.id) || null}
      custoAtendimento={custoAtendimento} aoVoltar={() => setTela(tela.voltarPara || null)} />;
  }

  if (tela?.especialidade) {
    const area = tela.especialidade;
    const daArea = atendimentos.filter(a => a.fim && (a.area || 'Outros') === area)
      .map(a => ({ pacienteId: a.pacienteId, nome: a.pacienteNome, quem: a.profissionalNome, quando: isoDe(a.inicio), valor: custoAtendimento(a), extra: a.duracaoMin ? `${a.duracaoMin} min` : '' }));
    const manuais = acoes.flatMap(ac => (ac.registros || [])
      .filter(r => (r.area || 'Outros') === area)
      .map(r => ({ pacienteId: '', nome: r.pacienteNome, quem: 'registro manual', quando: ac.data, valor: Number(r.valor || 0), extra: r.dentes > 1 ? `${r.dentes} dentes` : '' })));
    const lista = [...daArea, ...manuais].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
    const total = lista.reduce((s, x) => s + x.valor, 0);
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
        <h2 style={{ color: corDoNome(area) }}>{area}</h2>
        <div className="grade-numeros">
          <div className="cartao-numero"><strong>{lista.length}</strong><span>atendimentos</span></div>
          <div className="cartao-numero destaque"><strong>{dinheiro(total)}</strong><span>produzido</span></div>
        </div>
        <p className="dica">{ehPorDente(area) ? `${dinheiro(valorDe(area))} por dente tratado` : `${dinheiro(valorDe(area))} por atendimento`}</p>
        <p className="dica" style={{ marginTop: 0 }}>Toque no paciente para abrir a ficha dele — o que foi feito, as fotos e todas as informações.</p>
        {lista.length ? lista.map((x, i) => {
          const abrivel = !!x.pacienteId && pacientes.some(p => p.id === x.pacienteId);
          const Tag = abrivel ? 'button' : 'div';
          return (
            <Tag className="cartao" key={i} onClick={abrivel ? () => setTela({ paciente: x.pacienteId, voltarPara: { especialidade: area } }) : undefined}
              style={abrivel ? { width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', font: 'inherit' } : undefined}>
              <div className="cartao-topo">
                <strong>{x.nome || 'Paciente'}</strong>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong>{dinheiro(x.valor)}</strong>
                  {abrivel && <ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F' }} />}
                </span>
              </div>
              <p className="obs" style={{ margin: 0 }}>{[dataBonita(x.quando), x.quem, x.extra].filter(Boolean).join(' · ')}</p>
            </Tag>
          );
        }) : <Vazio texto="Nenhum atendimento desta especialidade ainda." />}
      </div>
    );
  }
  if (tela === 'novoInvestidor') return <FormInvestidor acoes={acoes} aoCancelar={() => setTela(null)} aoSalvar={criarInvestidor} />;
  if (tela?.investidor) {
    const i = investidores.find(x => x.id === tela.investidor);
    if (i) return <FormInvestidor investidor={i} acoes={acoes} aoCancelar={() => setTela(null)} aoSalvar={(f) => salvarInvestidor(i, f)} aoExcluir={() => excluirInvestidor(i)} />;
  }
  if (tela?.acao) {
    const a = acoes.find(x => x.id === tela.acao);
    if (a) return <TelaAcao acao={a} equipe={equipeAtiva} pacientes={pacientes} atendimentos={atendimentos} movimentos={movimentos}
      todasAreas={todasAreas} valorDe={valorDe} ehPorDente={ehPorDente} custoAtendimento={custoAtendimento} procedimentos={procedimentos}
      notas={notas.filter(n => n.acaoId === a.id)} aoNovaNota={() => setTela({ novaNota: a.id })} aoExcluirNota={excluirNota}
      aoSalvar={(campos) => salvarAcao(a, campos.status === 'encerrada'
        ? { ...campos, encerradaPorNome: usuario.nome || '' }
        : campos)}
      aoSalvarProcs={(v, procs) => {
        // Guarda o que a pessoa faz NESTA ação e libera no cadastro dela,
        // para o Seja Semente já oferecê-la ao agendar aquele procedimento
        salvarAcao(a, { procedimentosPorUid: { ...(a.procedimentosPorUid || {}), [v.id]: procs } });
        const juntos = [...new Set([...(v.procedimentos || []), ...procs])];
        if (juntos.length !== (v.procedimentos || []).length) salvarVoluntario(v, { procedimentos: juntos });
      }}
      aoExcluir={() => excluirAcao(a)} aoVoltar={() => setTela(null)} />;
  }
  if (tela?.voluntario) {
    const v = voluntarios.find(x => x.id === tela.voluntario);
    if (v) return <TelaVoluntario voluntario={v} agendamentos={agendamentos.filter(g => g.profissionalUid === v.id)}
      tempos={temposDo(v)} todasAreas={todasAreas}
      atendimentos={atendimentos} procedimentos={procedimentos} pacientes={pacientes}
      custoAtendimento={custoAtendimento}
      aoAbrirPaciente={(id) => setTela({ paciente: id, voltarPara: { voluntario: v.id } })}
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
            <strong>{deltaMov(m) > 0 ? '📥' : '📤'} {m.itemNome}</strong>
            <span className={'chip ' + (deltaMov(m) > 0 ? 'concluído' : 'em-atendimento')}>{deltaMov(m) > 0 ? '+' : ''}{deltaMov(m)}</span>
          </div>
          <p className="obs" style={{ margin: 0 }}>
            {[m.motivo, m.autorNome && `por ${String(m.autorNome).split(' ')[0]}`, m.acaoTitulo && `ação: ${m.acaoTitulo}`, m.valorUnit ? dinheiro(Math.abs(deltaMov(m)) * m.valorUnit) : ''].filter(Boolean).join(' · ')}
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
  const acaoDeHoje = acoes.find(a => acaoPegaODia(a, hoje) && a.status !== 'encerrada') || acoes.find(a => acaoPegaODia(a, hoje));

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
            <p className="dica" style={{ marginTop: 0 }}>Cada ação (mutirão) tem data, local, equipe e o relatório completo — pacientes, custos e materiais.</p>
            <button className="btn-secundario" style={{ width: '100%', marginBottom: 10 }} onClick={() => setTela('acaoAntiga')}>📚 Adicionar ação antiga (antes do aplicativo)</button>
            {acoes.length ? acoes.map(a => (
              <div className="cartao" key={a.id} onClick={() => setTela({ acao: a.id })} style={{ cursor: 'pointer' }}>
                <div className="cartao-topo">
                  <strong>{a.retroativa ? '📚' : '🌱'} {a.titulo}</strong>
                  <span className={'chip ' + (a.status === 'iniciada' ? 'em-atendimento' : a.status === 'encerrada' ? 'concluído' : 'aguardando')}>{a.retroativa ? 'antiga' : a.status}</span>
                </div>
                <p className="obs" style={{ margin: 0 }}>{periodoBonito(a)}{a.local ? ` · ${a.local}` : ''} · {(a.voluntariosUids || []).length} pessoa(s){(a.registros || []).length ? ` · ${(a.registros || []).length} lançamento(s)` : ''}</p>
              </div>
            )) : <Vazio texto="Nenhuma ação criada ainda — toque em + Nova ação." />}
          </>
        )}

        {aba === 'equipe' && (
          <>
            {(() => {
              const ranking = equipeAtiva
                .map(v => {
                  const meus = atendimentos.filter(a => a.profissionalUid === v.id && a.fim);
                  const procs = procedimentos.filter(r => r.autorUid === v.id);
                  return {
                    v, n: meus.length,
                    valor: meus.reduce((s2, a) => s2 + custoAtendimento(a), 0),
                    dentes: procs.reduce((s2, r) => s2 + (r.dentes || []).length, 0),
                  };
                })
                .filter(x => x.n > 0)
                .sort((a, b) => b.n - a.n);
              return ranking.length > 0 && (
                <>
                  <h2>🏆 Ranking de atendimentos</h2>
                  <p className="dica" style={{ marginTop: 0 }}>Toque em alguém para ver os pacientes que atendeu e quanto produziu.</p>
                  {ranking.slice(0, 10).map((x, i) => (
                    <button className="cartao" key={x.v.id} onClick={() => setTela({ voluntario: x.v.id })}
                      style={{ width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer', border: i === 0 ? '1.5px solid #F0A912' : 'none' }}>
                      <div className="cartao-linha" style={{ alignItems: 'center' }}>
                        <span style={{ fontSize: 22, width: 34, textAlign: 'center' }}>{['🥇', '🥈', '🥉'][i] || `${i + 1}º`}</span>
                        <Bolha nome={x.v.nome} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block' }}>{x.v.nome}</strong>
                          <span className="obs">{dinheiro(x.valor)} produzido{x.dentes ? ` · ${x.dentes} dente(s)` : ''}</span>
                        </span>
                        <span className="chip concluído" style={{ flex: 'none' }}>{x.n} atend.</span>
                        <ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F', flex: 'none' }} />
                      </div>
                    </button>
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
              const falta = qtdEstoque(i) <= Number(i.minimo || 0);
              return (
                <div className="cartao" key={i.id} onClick={() => setTela({ item: i.id })} style={{ cursor: 'pointer', ...(falta ? { border: '1.5px solid #E8A08C' } : {}) }}>
                  <div className="cartao-topo">
                    <strong>{i.nome}</strong>
                    <span className={'chip ' + (falta ? 'aguardando' : 'concluído')}>{qtdEstoque(i)} {i.unidade}{falta ? ' · FALTA' : ''}</span>
                  </div>
                  <p className="obs" style={{ margin: 0 }}>{dinheiro(i.valor)} por {i.unidade} · mínimo {i.minimo} {i.unidade}</p>
                </div>
              );
            }) : <Vazio texto="Nenhum material cadastrado — toque em + Material." />}
            <button className="btn-principal" style={{ maxWidth: 'none', marginTop: 8 }} onClick={() => setTela('movimentos')}>📜 Ver histórico de materiais</button>
          </>
        )}

        {aba === 'financeiro' && (() => {
          // O que o projeto já produziu, por especialidade (atendimentos
          // concluídos + registros manuais das ações)
          const feitos = atendimentos.filter(a => a.fim);
          const porArea = {};
          for (const a of feitos) {
            const chave = a.area || 'Outros';
            porArea[chave] = porArea[chave] || { quantos: 0, total: 0 };
            porArea[chave].quantos++;
            porArea[chave].total += custoAtendimento(a);
          }
          for (const ac of acoes) for (const r of (ac.registros || [])) {
            const chave = r.area || 'Outros';
            porArea[chave] = porArea[chave] || { quantos: 0, total: 0 };
            porArea[chave].quantos++;
            porArea[chave].total += Number(r.valor || 0);
          }
          const linhas = Object.entries(porArea).sort((a, b) => b[1].total - a[1].total);
          const total = linhas.reduce((s, [, v]) => s + v.total, 0);
          const gastoNotas = notas.reduce((s, n) => s + Number(n.valor || 0), 0);
          return (
            <>
              <h2>Financeiro</h2>
              <div className="cartao-numero destaque" style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 30 }}>{dinheiro(total)}</strong>
                <span>valor já produzido pelo projeto</span>
              </div>
              <h2 style={{ fontSize: 20 }}>Por especialidade</h2>
              <p className="dica" style={{ marginTop: 0 }}>Toque numa especialidade para ver os atendimentos, um por um.</p>
              {linhas.length ? linhas.map(([area, v]) => (
                <button className="cartao" key={area} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none' }} onClick={() => setTela({ especialidade: area })}>
                  <div className="cartao-topo">
                    <strong style={{ color: corDoNome(area) }}>{area}</strong>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong>{dinheiro(v.total)}</strong>
                      <ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F' }} />
                    </span>
                  </div>
                  <p className="obs" style={{ margin: 0 }}>{v.quantos} atendimento(s) · {dinheiro(v.total / Math.max(1, v.quantos))} cada, em média</p>
                </button>
              )) : <Vazio texto="Quando os atendimentos forem concluídos, o que foi produzido aparece aqui, separado por especialidade." />}

              <h2 style={{ fontSize: 20, marginTop: 18 }}>Gastos e ajustes</h2>
              <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 6 }} onClick={() => setTela('notas')}>📄 Notas fiscais ({dinheiro(gastoNotas)})</button>
              <p className="dica" style={{ margin: '0 0 12px' }}>Tire foto ou escaneie o QR da nota — o código prova que ela é real, e o gasto entra na ação.</p>
              <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 6 }} onClick={() => setTela('valores')}>🏷 Valores dos procedimentos</button>
              <p className="dica" style={{ margin: 0 }}>Quanto vale cada procedimento — é daqui que sai o valor produzido.</p>
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
            <BotaoApagarConta aoAbrir={aoApagarConta} />
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
function FormAcao({ antiga, aoCancelar, aoSalvar }) {
  // Criar ação é simples de propósito: nome, quando, onde e (se quiser) as
  // fotos do lugar. A equipe, o que cada um faz e os lançamentos ficam
  // DENTRO da ação, depois de criada — cada coisa na sua caixinha.
  const [f, setF] = useState({ titulo: '', data: hojeISO(), dataFim: hojeISO(), local: '' });
  const [fotos, setFotos] = useState([]);

  async function pegarFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let d = await comprimirImagem(file, 0.7, 900);
      if (d.length > 800000) d = await comprimirImagem(file, 0.5, 700);
      setFotos(fs => [...fs, d].slice(0, 6));
    } catch (err) { /* imagem ilegível */ }
  }

  const podeSalvar = f.titulo.trim() && f.data;
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>{antiga ? '📚 Registrar ação antiga' : 'Nova ação'}</h2>
      <p className="dica" style={{ marginTop: 0 }}>
        {antiga
          ? 'Para mutirões que aconteceram antes do aplicativo. Registre o básico agora — depois você entra na ação e lança o que foi feito.'
          : 'Só o essencial: nome, quando e onde. Depois de criar, você entra na ação e cuida da equipe, dos procedimentos e do relatório.'}
      </p>
      <Campo rotulo="Nome da ação"><input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Mutirão da Comunidade" /></Campo>
      <div className="linha-botoes">
        <Campo rotulo="Começa em"><input type="date" value={f.data}
          onChange={e => setF({ ...f, data: e.target.value, dataFim: (f.dataFim && f.dataFim >= e.target.value) ? f.dataFim : e.target.value })} /></Campo>
        <Campo rotulo="Termina em"><input type="date" value={f.dataFim} min={f.data}
          onChange={e => setF({ ...f, dataFim: e.target.value })} /></Campo>
      </div>
      {f.dataFim > f.data && <p className="dica" style={{ margin: '0 0 8px' }}>🗓 {diasDaAcao(f).length} dias de atendimento — a agenda do Seja Semente abre em todos eles.</p>}
      <Campo rotulo="Local"><input value={f.local} onChange={e => setF({ ...f, local: e.target.value })} placeholder="Ex.: Igreja Central" /></Campo>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>📷 Fotos do local (opcional)</strong>
        <p className="dica" style={{ margin: '0 0 8px' }}>Elas aparecem na Colheita, mostrando onde o projeto esteve.</p>
        {fotos.length > 0 && (
          <div className="grade-fotos" style={{ marginBottom: 8 }}>
            {fotos.map((ft, i) => (
              <div key={i} className="foto-mini" style={{ position: 'relative' }}>
                <img src={ft} alt={'local ' + (i + 1)} />
                <button className="btn-remover" style={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={() => setFotos(fs => fs.filter((_, k) => k !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
        {fotos.length < 6 && (
          <div className="foto-ad-vazia">
            <label className="foto-ad-botao">
              <Camera size={19} /><span>Tirar foto</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pegarFoto} />
            </label>
            <label className="foto-ad-botao secundario">
              <Images size={19} /><span>Da galeria</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pegarFoto} />
            </label>
          </div>
        )}
      </div>

      <div className="linha-botoes" style={{ marginTop: 10 }}>
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!podeSalvar} onClick={() => aoSalvar({
          ...f, fotosLocal: fotos,
          ...(antiga ? { retroativa: true, status: 'encerrada' } : {}),
        })}>{antiga ? 'Registrar ação' : 'Criar ação'}</button>
      </div>
    </div>
  );
}

// ─── A ação aberta: escala, status e relatório em tempo real ───
// ─── A ação aberta: um menu de caixinhas. Cada uma abre a SUA página
//     (não é rolar para baixo) — e volta com o botão ou arrastando o dedo
//     da beirada esquerda para a direita. ───
function TelaAcao({ acao, equipe, pacientes, atendimentos, movimentos, todasAreas, valorDe, ehPorDente, custoAtendimento, notas = [], procedimentos = [], aoNovaNota, aoExcluirNota, aoSalvar, aoSalvarProcs, aoExcluir, aoVoltar }) {
  const [pagina, setPagina] = useState(null); // 'equipe' | 'relatorio' | 'pacientes' | 'notas' | 'materiais' | 'lancamentos'
  const [vendoPessoa, setVendoPessoa] = useState(null);
  const [editandoProcs, setEditandoProcs] = useState(null);
  const [diaEscolhido, setDiaEscolhido] = useState('');

  const escalados = acao.voluntariosUids || [];
  const registros = acao.registros || [];
  const alternaEscala = (id) => aoSalvar({ voluntariosUids: escalados.includes(id) ? escalados.filter(x => x !== id) : [...escalados, id] });

  // Tudo o que aconteceu nos dias da ação
  const diasDela = diasDaAcao(acao);
  const procsDaAcao = procedimentos.filter(r => diasDela.includes(r.data || isoDe(r.em || r.criadoEm)));
  const feitos = atendimentos.filter(a => a.fim && diasDela.includes(isoDe(a.inicio)));
  const gastosMateriais = movimentos.filter(m => deltaMov(m) < 0
    && (m.acaoId === acao.id || (!m.acaoId && diasDela.includes(isoDe(m.em || m.criadoEm)))));

  const custoAtend = feitos.reduce((s, a) => s + custoAtendimento(a), 0);
  const custoRegistros = registros.reduce((s, r) => s + Number(r.valor || 0), 0);
  const custoMateriais = gastosMateriais.reduce((s, m) => s + Math.abs(deltaMov(m)) * Number(m.valorUnit || 0), 0);
  const gastoNotas = notas.reduce((s, n) => s + Number(n.valor || 0), 0);
  const produzido = custoAtend + custoRegistros;
  const gasto = custoMateriais + gastoNotas;
  const totalManuais = registros.reduce((s, r) => s + (Number(r.dentes || 0) > 0 ? 1 : Number(r.quantos || 1)), 0);
  const dentesTratados = procsDaAcao.reduce((s, r) => s + (r.dentes || []).length, 0)
    + registros.reduce((s, r) => s + Number(r.dentes || 0), 0);
  const pessoasAtendidas = new Set([...feitos.map(a => a.pacienteId), ...procsDaAcao.map(r => r.pacienteId)].filter(Boolean)).size;

  // O que foi feito, por especialidade (o "segmento" da ação)
  const porEspecialidade = (() => {
    const m = {};
    const poe = (area, quantos, valor) => {
      const k = area || 'Outros';
      m[k] = m[k] || { quantos: 0, valor: 0 };
      m[k].quantos += quantos; m[k].valor += valor;
    };
    for (const a of feitos) poe(a.area, 1, custoAtendimento(a));
    for (const r of registros) poe(r.area, Number(r.dentes || 0) > 0 ? Number(r.dentes) : Number(r.quantos || 1), Number(r.valor || 0));
    return Object.entries(m).sort((a, b) => b[1].valor - a[1].valor);
  })();

  const primeiroNome = (n) => String(n || '').split(' ')[0];
  const voltarPagina = () => { setPagina(null); setVendoPessoa(null); setEditandoProcs(null); };

  // ═══ PÁGINA: a ficha de uma pessoa dentro da ação ═══
  if (vendoPessoa) {
    const v = vendoPessoa;
    const doDele = feitos.filter(a => a.profissionalUid === v.id);
    const procsDele = procsDaAcao.filter(r => r.autorUid === v.id);
    const manuaisDele = registros.filter(r => r.profissionalUid === v.id);
    const materiaisDele = gastosMateriais.filter(m => m.autorUid === v.id);
    const valorDele = doDele.reduce((sm, a) => sm + custoAtendimento(a), 0) + manuaisDele.reduce((sm, r) => sm + Number(r.valor || 0), 0);
    const dentesDele = procsDele.reduce((sm, r) => sm + (r.dentes || []).length, 0);
    const minutos = doDele.reduce((sm, a) => sm + Number(a.duracaoMin || 0), 0);
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => setVendoPessoa(null)}><ChevronLeft size={18} /> Voltar</button>
        <div className="cartao">
          <div className="cartao-linha">
            <Bolha nome={v.nome} />
            <div style={{ flex: 1 }}>
              <strong>{v.nome}</strong>
              <p className="obs" style={{ margin: 0 }}>na ação {acao.titulo} · {periodoBonito(acao)}</p>
            </div>
          </div>
        </div>
        <div className="grade-numeros">
          <div className="cartao-numero"><strong>{doDele.length + manuaisDele.length}</strong><span>atendimentos</span></div>
          <div className="cartao-numero"><strong>{dentesDele}</strong><span>dentes tratados</span></div>
          <div className="cartao-numero"><strong>{minutos ? `${minutos} min` : '—'}</strong><span>tempo na cadeira</span></div>
          <div className="cartao-numero destaque"><strong>{dinheiro(valorDele)}</strong><span>valor produzido</span></div>
        </div>
        {procsDele.length > 0 && (
          <>
            <h3 style={{ margin: '14px 0 8px' }}>O que ele(a) registrou</h3>
            {procsDele.map(r => (
              <div className="cartao" key={r.id}>
                <div className="cartao-topo"><strong>{r.pacienteNome}</strong>{r.area && <span className="chip concluído">{r.area}</span>}</div>
                {r.descricao && <p style={{ margin: '4px 0 0' }}>{r.descricao}</p>}
                <p className="obs" style={{ margin: '2px 0 0' }}>
                  {(r.dentes || []).length ? `Dentes: ${r.dentes.join(', ')}` : 'sem dentes marcados'}
                  {(r.fotoAntesId && r.fotoDepoisId) ? ' · 📷 antes e depois' : ''}
                </p>
              </div>
            ))}
          </>
        )}
        {doDele.length > 0 && (
          <>
            <h3 style={{ margin: '14px 0 8px' }}>Atendimentos cronometrados</h3>
            {doDele.map(a => (
              <div className="cartao" key={a.id}>
                <div className="cartao-topo"><strong>{a.pacienteNome}</strong><strong>{dinheiro(custoAtendimento(a))}</strong></div>
                <p className="obs" style={{ margin: 0 }}>{a.area}{a.duracaoMin ? ` · ${a.duracaoMin} min` : ''}</p>
              </div>
            ))}
          </>
        )}
        {materiaisDele.length > 0 && (
          <>
            <h3 style={{ margin: '14px 0 8px' }}>Materiais que retirou</h3>
            {materiaisDele.map(m => (
              <div className="cartao" key={m.id}>
                <div className="cartao-linha" style={{ alignItems: 'center' }}>
                  {m.itemFoto && <img className="estoque-foto" src={m.itemFoto} alt={m.itemNome} />}
                  <div style={{ flex: 1 }}>
                    <div className="cartao-topo"><strong>{m.itemNome}</strong><strong>{dinheiro(Math.abs(deltaMov(m)) * Number(m.valorUnit || 0))}</strong></div>
                    <p className="obs" style={{ margin: 0 }}>{Math.abs(deltaMov(m))} unidade(s)</p>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {!doDele.length && !procsDele.length && !manuaisDele.length && <Vazio texto="Esta pessoa ainda não registrou nada nesta ação." />}
      </div>
    );
  }

  // ═══ PÁGINA: EQUIPE (marcar quem participa e o que cada um faz) ═══
  if (pagina === 'equipe') return (
    <div className="folha">
      <button className="btn-voltar" onClick={voltarPagina}><ChevronLeft size={18} /> Voltar</button>
      <h2>👥 Equipe da ação</h2>
      <p className="dica" style={{ marginTop: 0 }}>Marque quem participa e, em cada pessoa, o que ela vai fazer (o 🦷). Assim o Seja Semente já sabe quem oferecer em cada procedimento. Toque no nome para ver o que ela fez.</p>
      {equipe.length ? equipe.map(v => {
        const marcado = escalados.includes(v.id);
        const meus = (acao.procedimentosPorUid || {})[v.id] || v.procedimentos || [];
        const doDele = feitos.filter(a => a.profissionalUid === v.id);
        const quantos = doDele.length + procsDaAcao.filter(r => r.autorUid === v.id).length + registros.filter(r => r.profissionalUid === v.id).length;
        const valorDele = doDele.reduce((sm, a) => sm + custoAtendimento(a), 0)
          + registros.filter(r => r.profissionalUid === v.id).reduce((sm, r) => sm + Number(r.valor || 0), 0);
        return (
          <div key={v.id} className={marcado ? 'caixa marcada' : 'caixa'} style={{ display: 'block', marginBottom: 8, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={marcado} onChange={() => alternaEscala(v.id)} />
              <Bolha nome={v.nome} />
              <button type="button" onClick={() => marcado && setVendoPessoa(v)}
                style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', font: 'inherit', cursor: marcado ? 'pointer' : 'default', padding: 0, minWidth: 0 }}>
                <strong>{v.nome}</strong>
                <span className="obs" style={{ display: 'block' }}>
                  {marcado
                    ? (meus.length ? `🦷 ${meus.join(' · ')}` : '⚠ marque o que ela vai fazer')
                    : (v.ministerio || 'toque na caixinha para incluir')}
                </span>
                {marcado && quantos > 0 && <span className="obs" style={{ display: 'block' }}>{quantos} atendimento(s) · {dinheiro(valorDele)}</span>}
              </button>
              {marcado && (
                <button type="button" className="btn-remover" title="O que ela vai fazer"
                  onClick={() => setEditandoProcs(editandoProcs === v.id ? null : v.id)}
                  style={{ background: '#E5F3EA', color: '#226343' }}>🦷</button>
              )}
              {marcado && <ChevronRight size={18} strokeWidth={2.6} style={{ opacity: 0.5, flex: 'none' }} />}
            </div>
            {marcado && editandoProcs === v.id && (
              <div className="caixas" style={{ marginTop: 8, width: '100%' }}>
                {todasAreas.map(nome => (
                  <label key={nome} className={meus.includes(nome) ? 'caixa marcada' : 'caixa'} style={{ margin: 0, padding: '5px 10px', fontSize: 12.5 }}>
                    <input type="checkbox" checked={meus.includes(nome)} onChange={() => {
                      aoSalvarProcs(v, meus.includes(nome) ? meus.filter(x => x !== nome) : [...meus, nome]);
                    }} />
                    {nome}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      }) : <Vazio texto="Nenhum voluntário ativo para escalar." />}
    </div>
  );

  // ═══ PÁGINA: RELATÓRIO ═══
  if (pagina === 'relatorio') return (
    <div className="folha">
      <button className="btn-voltar" onClick={voltarPagina}><ChevronLeft size={18} /> Voltar</button>
      <h2>📊 Relatório da ação</h2>
      <p className="dica" style={{ marginTop: 0 }}>{acao.titulo} · {periodoBonito(acao)}{acao.local ? ` · ${acao.local}` : ''}</p>
      <div className="cartao-numero destaque" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 30 }}>{dinheiro(produzido)}</strong>
        <span>valor da ação (tratamento entregue)</span>
      </div>
      <div className="grade-numeros">
        <div className="cartao-numero"><strong>{feitos.length + totalManuais}</strong><span>atendimentos</span></div>
        <div className="cartao-numero"><strong>{pessoasAtendidas}</strong><span>pessoas atendidas</span></div>
        <div className="cartao-numero"><strong>{dentesTratados}</strong><span>dentes tratados</span></div>
        <div className="cartao-numero"><strong>{escalados.length}</strong><span>pessoas na equipe</span></div>
        <div className="cartao-numero"><strong>{dinheiro(custoMateriais)}</strong><span>materiais</span></div>
        <div className="cartao-numero"><strong>{dinheiro(gastoNotas)}</strong><span>notas fiscais</span></div>
      </div>
      <div className="cartao" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
        <strong>💰 Resultado (produzido − gastos)</strong>
        <b style={{ fontSize: 18, color: (produzido - gasto) >= 0 ? '#226343' : '#B3402A' }}>{dinheiro(produzido - gasto)}</b>
      </div>
      {gasto > 0 && produzido > 0 && (
        <div className="cartao" style={{ border: '1.5px solid #37935B' }}>
          <div className="cartao-topo"><strong>💚 Cada R$ 1,00 gasto virou</strong><strong style={{ fontSize: 20 }}>{dinheiro(produzido / gasto)}</strong></div>
          <p className="obs" style={{ margin: 0 }}>em tratamento entregue para quem precisava.</p>
        </div>
      )}
      <h3 style={{ margin: '16px 0 8px' }}>Por segmento (especialidade)</h3>
      {porEspecialidade.length ? porEspecialidade.map(([area, v]) => (
        <div className="cartao" key={area}>
          <div className="cartao-topo">
            <strong style={{ color: corDoNome(area) }}>{area}</strong>
            <strong>{dinheiro(v.valor)}</strong>
          </div>
          <p className="obs" style={{ margin: 0 }}>{v.quantos} procedimento(s){v.quantos ? ` · ${dinheiro(v.valor / v.quantos)} cada, em média` : ''}</p>
        </div>
      )) : <Vazio texto="Ainda sem procedimentos registrados nesta ação." />}
      <p className="dica" style={{ marginTop: 12 }}>Estes números vão sozinhos para a Colheita, para quem apoia o projeto acompanhar. 💚</p>
    </div>
  );

  // ═══ PÁGINA: PACIENTES (por dia) ═══
  if (pagina === 'pacientes') {
    const dia = diaEscolhido || (diasDela.includes(hojeISO()) ? hojeISO() : diasDela[0] || acao.data);
    const doDia = procsDaAcao.filter(r => (r.data || isoDe(r.em || r.criadoEm)) === dia);
    const atendDia = feitos.filter(a => isoDe(a.inicio) === dia);
    // Uma linha por paciente, juntando o que o dentista registrou com o
    // atendimento cronometrado
    const linhas = (() => {
      const m = new Map();
      for (const a of atendDia) {
        const k = a.pacienteId || a.pacienteNome;
        const x = m.get(k) || { id: a.pacienteId, nome: a.pacienteNome, areas: [], quem: [], dentes: 0, valor: 0, comRegistro: false };
        x.valor += custoAtendimento(a);
        if (a.area && !x.areas.includes(a.area)) x.areas.push(a.area);
        if (a.profissionalNome && !x.quem.includes(a.profissionalNome)) x.quem.push(a.profissionalNome);
        m.set(k, x);
      }
      for (const r of doDia) {
        const k = r.pacienteId || r.pacienteNome;
        const x = m.get(k) || { id: r.pacienteId, nome: r.pacienteNome, areas: [], quem: [], dentes: 0, valor: 0, comRegistro: false };
        x.dentes += (r.dentes || []).length;
        x.comRegistro = true;
        if (r.area && !x.areas.includes(r.area)) x.areas.push(r.area);
        if (r.autorNome && !x.quem.includes(r.autorNome)) x.quem.push(r.autorNome);
        m.set(k, x);
      }
      return [...m.values()];
    })();
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={voltarPagina}><ChevronLeft size={18} /> Voltar</button>
        <h2>🧑‍🤝‍🧑 Pacientes do dia</h2>
        <p className="dica" style={{ marginTop: 0 }}>Escolha o dia e veja quem foi atendido — é o que os dentistas registraram no Semeador.</p>
        <Campo rotulo="Dia">
          <select value={dia} onChange={e => setDiaEscolhido(e.target.value)}>
            {diasDela.map(d => <option key={d} value={d}>{dataBonita(d)}</option>)}
          </select>
        </Campo>
        <div className="grade-numeros">
          <div className="cartao-numero"><strong>{linhas.length}</strong><span>pessoas neste dia</span></div>
          <div className="cartao-numero destaque"><strong>{dinheiro(linhas.reduce((s, x) => s + x.valor, 0))}</strong><span>entregue no dia</span></div>
        </div>
        {linhas.length ? linhas.map(x => (
          <div className="cartao" key={x.id || x.nome}>
            <div className="cartao-linha" style={{ alignItems: 'center' }}>
              <Bolha nome={x.nome} foto={pacientes.find(p => p.id === x.id)?.foto} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cartao-topo">
                  <strong>{x.nome}</strong>
                  {x.comRegistro ? <span className="chip concluído">registrado</span> : <span className="chip aguardando">sem registro</span>}
                </div>
                <p className="obs" style={{ margin: 0 }}>
                  {x.areas.join(', ') || 'sem procedimento'}{x.dentes ? ` · ${x.dentes} dente(s)` : ''}
                  {x.quem.length ? ` · ${x.quem.map(primeiroNome).join(', ')}` : ''}
                </p>
              </div>
              {x.valor > 0 && <strong style={{ flex: 'none' }}>{dinheiro(x.valor)}</strong>}
            </div>
          </div>
        )) : <Vazio texto="Ninguém atendido neste dia ainda." />}
      </div>
    );
  }

  // ═══ PÁGINA: NOTAS FISCAIS ═══
  if (pagina === 'notas') return (
    <div className="folha">
      <button className="btn-voltar" onClick={voltarPagina}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>📄 Notas fiscais</h2><button className="btn-mais" onClick={aoNovaNota}>+ Nota</button></div>
      <p className="dica" style={{ marginTop: 0 }}>As compras desta ação. Escaneie o QR da nota — o código prova que ela é real.</p>
      <div className="cartao-numero destaque" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 26 }}>{dinheiro(gastoNotas)}</strong><span>em {notas.length} nota(s)</span>
      </div>
      {notas.length ? notas.map(n => (
        <div className="cartao" key={n.id}>
          <div className="cartao-topo"><strong>{n.descricao || 'Nota fiscal'}</strong>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>{dinheiro(n.valor)}</strong>
              <button className="btn-remover" onClick={() => aoExcluirNota(n)}>✕</button>
            </span>
          </div>
          <p className="obs" style={{ margin: 0 }}>{n.chave ? '✓ QR real · …' + String(n.chave).slice(-8) : '📷 foto'}</p>
          {n.foto && <img src={n.foto} alt="nota" style={{ maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />}
        </div>
      )) : <Vazio texto="Nenhuma nota nesta ação — toque em + Nota para fotografar ou escanear o QR." />}
    </div>
  );

  // ═══ PÁGINA: MATERIAIS ═══
  if (pagina === 'materiais') return (
    <div className="folha">
      <button className="btn-voltar" onClick={voltarPagina}><ChevronLeft size={18} /> Voltar</button>
      <h2>📦 Materiais usados</h2>
      <p className="dica" style={{ marginTop: 0 }}>O que saiu do estoque nesta ação — quem retirou, quanto e quanto custou.</p>
      <div className="cartao-numero destaque" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 26 }}>{dinheiro(custoMateriais)}</strong><span>em {gastosMateriais.length} retirada(s)</span>
      </div>
      {gastosMateriais.length ? gastosMateriais.map(m => (
        <div className="cartao" key={m.id}>
          <div className="cartao-linha" style={{ alignItems: 'center' }}>
            {m.itemFoto && <img className="estoque-foto" src={m.itemFoto} alt={m.itemNome} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cartao-topo"><strong>{m.itemNome}</strong><strong>{dinheiro(Math.abs(deltaMov(m)) * Number(m.valorUnit || 0))}</strong></div>
              <p className="obs" style={{ margin: 0 }}>
                {Math.abs(deltaMov(m))} {m.unidade || 'un'}
                {m.autorNome ? ` · ${primeiroNome(m.autorNome)}` : ''}
              </p>
            </div>
          </div>
        </div>
      )) : <Vazio texto="Nenhum material retirado nesta ação ainda." />}
    </div>
  );

  // ═══ PÁGINA: LANÇAMENTOS (só na ação antiga) ═══
  if (pagina === 'lancamentos') return (
    <LancamentosAntigos acao={acao} equipe={equipe} todasAreas={todasAreas} valorDe={valorDe} ehPorDente={ehPorDente}
      aoSalvar={aoSalvar} aoVoltar={voltarPagina} />
  );

  // ═══ O MENU DA AÇÃO ═══
  const caixa = (id, icone, titulo, detalhe, valor) => (
    <button className="cartao caixa-menu" onClick={() => setPagina(id)}>
      <span className="caixa-menu-icone">{icone}</span>
      <span className="caixa-menu-texto">
        <strong>{titulo}</strong>
        <span className="obs">{detalhe}</span>
      </span>
      {valor && <span className="caixa-menu-valor">{valor}</span>}
      <ChevronRight size={20} strokeWidth={2.6} style={{ color: '#9AA79F', flex: 'none' }} />
    </button>
  );

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>{acao.retroativa ? '📚' : '🌱'} {acao.titulo}</h2>
        <span className={'chip ' + (acao.status === 'iniciada' ? 'em-atendimento' : acao.status === 'encerrada' ? 'concluído' : 'aguardando')}>{acao.retroativa ? 'antiga' : acao.status}</span>
      </div>
      <p className="dica" style={{ marginTop: 0 }}>{periodoBonito(acao)}{acao.local ? ` · ${acao.local}` : ''}</p>

      {(acao.fotosLocal || []).length > 0 && (
        <div className="grade-fotos" style={{ marginBottom: 10 }}>
          {acao.fotosLocal.map((ft, i) => <span key={i} className="foto-mini"><img src={ft} alt={'local ' + (i + 1)} /></span>)}
        </div>
      )}

      {!acao.retroativa && (
        acao.status === 'encerrada' ? (
          <div className="cartao" style={{ border: '1.5px solid #E8A08C', background: '#FBE3DA' }}>
            <strong style={{ display: 'block', color: '#8F2F1B' }}>⏹ Ação encerrada</strong>
            <p className="obs" style={{ margin: '4px 0 0' }}>
              {acao.iniciadaEm ? `Começou ${quandoBonito(acao.iniciadaEm)} · ` : ''}
              Encerrada {quandoBonito(acao.encerradaEm)}
              {acao.encerradaPorNome ? ` por ${primeiroNome(acao.encerradaPorNome)}` : ''}.
            </p>
            <p className="obs" style={{ margin: '4px 0 0' }}>Ninguém agenda nem atende mais nestes dias — no Seja Semente e no Semeador já está fechado, e a Colheita mostra o encerramento.</p>
            <button className="btn-secundario" style={{ width: '100%', marginTop: 10 }} onClick={() => {
              if (window.confirm('Reabrir esta ação? A equipe volta a agendar e atender nos dias dela.')) {
                aoSalvar({ status: 'iniciada', encerradaEm: null, encerradaPorNome: '', reabertaEm: new Date() });
              }
            }}>↩ Reabrir ação</button>
          </div>
        ) : (
          <div className="linha-botoes" style={{ marginBottom: 12 }}>
            {acao.status !== 'iniciada' && <button className="btn-principal" onClick={() => aoSalvar({ status: 'iniciada', iniciadaEm: new Date() })}>▶ Iniciar ação</button>}
            {acao.status === 'iniciada' && (
              <button className="btn-secundario" onClick={() => {
                if (window.confirm('Encerrar a ação?\n\nDepois de encerrada ninguém consegue agendar nem chamar paciente nos dias dela. Dá para reabrir se precisar.')) {
                  aoSalvar({ status: 'encerrada', encerradaEm: new Date() });
                }
              }}>⏹ Encerrar ação</button>
            )}
          </div>
        )
      )}

      <div className="menu-acao">
        {caixa('equipe', '👥', 'Equipe', escalados.length ? `${escalados.length} pessoa(s) · toque para ver e marcar` : 'ninguém marcado ainda')}
        {caixa('relatorio', '📊', 'Relatório', `${feitos.length + totalManuais} atendimento(s) · ${pessoasAtendidas} pessoa(s)`, dinheiro(produzido))}
        {caixa('pacientes', '🧑‍🤝‍🧑', 'Pacientes do dia', 'quem foi atendido, dia a dia')}
        {caixa('notas', '📄', 'Notas fiscais', `${notas.length} nota(s)`, dinheiro(gastoNotas))}
        {caixa('materiais', '📦', 'Materiais usados', `${gastosMateriais.length} retirada(s)`, dinheiro(custoMateriais))}
        {acao.retroativa && caixa('lancamentos', '✍️', 'Lançamentos', `${registros.length} lançamento(s) · o que foi feito no mutirão`, dinheiro(custoRegistros))}
      </div>

      <button className="btn-sair" style={{ width: '100%', marginTop: 14 }} onClick={aoExcluir}>🗑 Excluir esta ação</button>
    </div>
  );
}

// ─── Lançamentos da ação ANTIGA: aqui sim entra na mão, porque o mutirão
//     aconteceu antes do aplicativo existir ───
function LancamentosAntigos({ acao, equipe, todasAreas, valorDe, ehPorDente, aoSalvar, aoVoltar }) {
  const registros = acao.registros || [];
  const [item, setItem] = useState({ area: todasAreas[0] || '', quantos: 1, dentes: 1, descricao: '', quemUid: '' });
  const porDente = ehPorDente(item.area);
  const unidades = porDente ? Math.max(1, Number(item.dentes || 1)) : Math.max(1, Number(item.quantos || 1));
  const valorItem = valorDe(item.area) * unidades;

  function adicionar() {
    const quem = equipe.find(v => v.id === item.quemUid);
    const novo = {
      id: 'r' + Math.floor(Math.random() * 1e9),
      area: item.area,
      quantos: porDente ? 1 : Math.max(1, Number(item.quantos || 1)),
      dentes: porDente ? Math.max(1, Number(item.dentes || 1)) : 0,
      descricao: item.descricao.trim(),
      profissionalUid: quem?.id || '', profissionalNome: quem?.nome || '',
      pacienteNome: item.descricao.trim() || item.area,
      valor: valorItem,
    };
    aoSalvar({ registros: [...registros, novo] });
    setItem({ ...item, quantos: 1, dentes: 1, descricao: '' });
  }

  const total = registros.reduce((s, r) => s + Number(r.valor || 0), 0);
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>✍️ Lançamentos</h2>
      <p className="dica" style={{ marginTop: 0 }}>Como este mutirão aconteceu antes do aplicativo, o que foi feito entra aqui: escolha a especialidade, diga quantos (ou quantos dentes) e vá adicionando.</p>
      <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Campo rotulo="Especialidade">
          <select value={item.area} onChange={e => setItem({ ...item, area: e.target.value })}>
            {todasAreas.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Campo>
        <Campo rotulo={porDente ? 'Quantos dentes' : 'Quantos procedimentos'}>
          <input type="number" min="1" value={porDente ? item.dentes : item.quantos}
            onChange={e => setItem(porDente ? { ...item, dentes: e.target.value } : { ...item, quantos: e.target.value })} />
        </Campo>
        <Campo rotulo="Quem fez (opcional)">
          <select value={item.quemUid} onChange={e => setItem({ ...item, quemUid: e.target.value })}>
            <option value="">— não informado —</option>
            {equipe.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observação (paciente, detalhe do que foi feito)">
          <input value={item.descricao} onChange={e => setItem({ ...item, descricao: e.target.value })} placeholder="Ex.: José da Silva — extração do 36" />
        </Campo>
        <div className="cartao-topo">
          <span className="obs">{porDente ? `${unidades} dente(s)` : `${unidades} procedimento(s)`}</span>
          <strong>{dinheiro(valorItem)}</strong>
        </div>
        <button className="btn-mais" onClick={adicionar}>+ Adicionar</button>
      </div>
      {registros.length > 0 && (
        <>
          <div className="cartao-numero destaque" style={{ margin: '12px 0' }}>
            <strong style={{ fontSize: 26 }}>{dinheiro(total)}</strong><span>em {registros.length} lançamento(s)</span>
          </div>
          {registros.map(r => (
            <div className="cartao" key={r.id}>
              <div className="cartao-topo"><strong>{r.area}</strong>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <strong>{dinheiro(r.valor)}</strong>
                  <button className="btn-remover" onClick={() => aoSalvar({ registros: registros.filter(x => x.id !== r.id) })}>✕</button>
                </span>
              </div>
              <p className="obs" style={{ margin: 0 }}>
                {r.dentes > 0 ? `${r.dentes} dente(s)` : `${r.quantos} procedimento(s)`}
                {r.profissionalNome ? ` · ${r.profissionalNome}` : ''}{r.descricao ? ` · ${r.descricao}` : ''}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Ficha do paciente pelos olhos da gestão: dados, o que foi feito, as
//     fotos (buscadas sob demanda) e o depoimento. Só leitura — é o checkup
//     de quem coordena o projeto. ───
function FichaGestao({ paciente: p, fb, procedimentos = [], atendimentos = [], agendamentos = [], depoimento, custoAtendimento, aoVoltar }) {
  const [arquivos, setArquivos] = useState([]);
  const [vendo, setVendo] = useState(null);
  const t = p.triagem || null;
  const areas = Array.isArray(t?.areas) ? t.areas : (t?.area ? [t.area] : (t?.procedimento ? [t.procedimento] : []));

  // Busca as fotos da ficha só quando esta tela abre
  useEffect(() => {
    if (!fb) return;
    const { collection, query, orderBy, onSnapshot } = fb.fns;
    return onSnapshot(query(collection(fb.db, 'pacientes', p.id, 'arquivos'), orderBy('criadoEm', 'desc')),
      snap => setArquivos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [p.id]);
  const fotoDe = (id) => arquivos.find(a => a.id === id) || null;
  const totalProduzido = atendimentos.reduce((s, a) => s + custoAtendimento(a), 0);

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="cartao">
        <div className="cartao-linha">
          <Bolha nome={p.nome} foto={p.foto} />
          <div style={{ flex: 1 }}>
            <div className="cartao-topo">
              <strong style={{ fontSize: 18 }}>{p.nome}</strong>
              {p.codigo && <span className="chip concluído">{p.codigo}</span>}
            </div>
            <p className="obs" style={{ margin: 0 }}>{[p.idade ? `${p.idade} anos` : '', p.telefone, p.cpf ? `CPF ${p.cpf}` : ''].filter(Boolean).join(' · ')}</p>
            {p.endereco && <p className="obs" style={{ margin: 0 }}>📍 {p.endereco}</p>}
            {areas.length > 0 && <p className="obs" style={{ margin: '4px 0 0' }}>{areas.join(' · ')}</p>}
            {t && (t.saude?.length > 0 || t.outrasCondicoes) && (
              <p className="saude" style={{ margin: '4px 0 0' }}>
                <TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                {[...(t.saude || []), t.outrasCondicoes].filter(Boolean).join(', ')}
              </p>
            )}
            {p.observacoes && <p className="obs" style={{ margin: '4px 0 0' }}>{p.observacoes}</p>}
          </div>
        </div>
      </div>

      <div className="grade-numeros">
        <div className="cartao-numero"><strong>{procedimentos.length || atendimentos.length}</strong><span>atendimentos</span></div>
        <div className="cartao-numero"><strong>{procedimentos.reduce((s, r) => s + (r.dentes || []).length, 0)}</strong><span>dentes tratados</span></div>
        <div className="cartao-numero"><strong>{arquivos.length}</strong><span>fotos na ficha</span></div>
        <div className="cartao-numero destaque"><strong>{dinheiro(totalProduzido)}</strong><span>valor entregue</span></div>
      </div>

      {(t?.dentes?.length > 0 || t?.gengiva?.length > 0) && (
        <div className="cartao">
          <strong style={{ display: 'block', marginBottom: 8 }}>Marcação da triagem</strong>
          <Arcada marcados={t.dentes || []} gengiva={t.gengiva || []} compacta />
        </div>
      )}

      {depoimento && (
        <>
          <h3 style={{ margin: '14px 0 8px' }}>💬 O que {String(p.nome).split(' ')[0]} disse</h3>
          <CartaoDepoimento depoimento={depoimento} destaque />
        </>
      )}

      <h3 style={{ margin: '14px 0 8px' }}>🦷 O que foi feito ({procedimentos.length})</h3>
      {procedimentos.length ? procedimentos.map(r => {
        const antes = fotoDe(r.fotoAntesId), depois = fotoDe(r.fotoDepoisId);
        return (
          <div className="cartao" key={r.id}>
            <div className="cartao-topo">
              <strong style={{ color: corDoNome(r.area || '') }}>{r.area || 'Atendimento'}</strong>
              <span className="obs">{dataBonita(r.data || isoDe(r.em || r.criadoEm))}{r.autorNome ? ` · ${String(r.autorNome).split(' ')[0]}` : ''}</span>
            </div>
            {r.descricao && <p style={{ margin: '6px 0 0' }}>{r.descricao}</p>}
            {(antes || depois) && (
              <div className="antes-depois-par ver">
                {antes && <button className="foto-ad-mini" onClick={() => setVendo(antes)}><img src={antes.dataUrl} alt="Antes" /><span>ANTES</span></button>}
                {depois && <button className="foto-ad-mini" onClick={() => setVendo(depois)}><img src={depois.dataUrl} alt="Depois" /><span>DEPOIS</span></button>}
              </div>
            )}
            {(r.dentes || []).length > 0 && <p className="obs" style={{ margin: '6px 0 0' }}>Dentes: {r.dentes.join(', ')}</p>}
          </div>
        );
      }) : <p className="dica">Ainda sem registro detalhado — os atendimentos abaixo vieram do cronômetro.</p>}

      {atendimentos.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 8px' }}>⏱ Atendimentos cronometrados</h3>
          {atendimentos.map(a => (
            <div className="cartao" key={a.id}>
              <div className="cartao-topo"><strong>{a.area || 'Atendimento'}</strong><strong>{dinheiro(custoAtendimento(a))}</strong></div>
              <p className="obs" style={{ margin: 0 }}>{dataBonita(isoDe(a.inicio))} · {a.profissionalNome}{a.duracaoMin ? ` · ${a.duracaoMin} min` : ''}</p>
            </div>
          ))}
        </>
      )}

      {agendamentos.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 8px' }}>📅 Agenda</h3>
          {agendamentos.map(g => (
            <div className="cartao" key={g.id}>
              <div className="cartao-topo"><strong>{g.area || g.titulo}</strong><span className="obs">{dataBonita(g.data)} às {g.hora}</span></div>
              <p className="obs" style={{ margin: 0 }}>{g.profissionalNome || 'sem dentista'}</p>
            </div>
          ))}
        </>
      )}

      {arquivos.length > 0 && (
        <>
          <h3 style={{ margin: '14px 0 8px' }}>📷 Todas as fotos ({arquivos.length})</h3>
          <div className="grade-fotos">
            {arquivos.map(a => (
              <button key={a.id} className="foto-mini" onClick={() => setVendo(a)}>
                <img src={a.dataUrl} alt={a.legenda || 'foto'} />
                {a.autorNome && <span className="foto-autor">{String(a.autorNome).split(' ')[0]}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {vendo && (
        <div className="foto-cheia" onClick={() => setVendo(null)}>
          <button className="foto-fechar">✕</button>
          <img src={vendo.dataUrl} alt={vendo.legenda || 'foto'} />
          {(vendo.legenda || vendo.autorNome) && (
            <div className="foto-info">
              {vendo.legenda && <strong>{vendo.legenda}</strong>}
              {vendo.autorNome && <span>por {vendo.autorNome}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── O voluntário aberto: editar, agenda, tempos, remover ───
function TelaVoluntario({ voluntario: v, agendamentos, tempos, todasAreas, atendimentos = [], procedimentos = [], pacientes = [], custoAtendimento, aoAbrirPaciente, aoSalvar, aoRemover, aoChamar, aoVoltar }) {
  const [f, setF] = useState({ nome: v.nome || '', telefone: v.telefone || '', ministerio: v.ministerio || '', email: v.email || '' });
  const [editando, setEditando] = useState(false);
  const procs = v.procedimentos || [];
  const alternaProc = (nome) => aoSalvar({ procedimentos: procs.includes(nome) ? procs.filter(x => x !== nome) : [...procs, nome] });
  const porData = {};
  for (const g of agendamentos) (porData[g.data] = porData[g.data] || []).push(g);
  const datas = Object.keys(porData).sort();

  // ── Os números e os pacientes deste voluntário ──
  const meusAtend = atendimentos.filter(a => a.profissionalUid === v.id && a.fim);
  const meusProcs = procedimentos.filter(r => r.autorUid === v.id);
  const valorProduzido = meusAtend.reduce((s2, a) => s2 + (custoAtendimento ? custoAtendimento(a) : 0), 0);
  const dentesTratados = meusProcs.reduce((s2, r) => s2 + (r.dentes || []).length, 0);
  const porArea = (() => {
    const m = {};
    for (const a of meusAtend) {
      const k = a.area || 'Outros';
      m[k] = m[k] || { quantos: 0, total: 0 };
      m[k].quantos++; m[k].total += custoAtendimento ? custoAtendimento(a) : 0;
    }
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  })();
  // Junta atendimentos e registros: uma linha por paciente
  const listaPacientes = (() => {
    const m = new Map();
    const poe = (id, nome, area, valor, dentes) => {
      const chave = id || nome;
      if (!chave) return;
      const atual = m.get(chave) || { id, nome, quantos: 0, valor: 0, dentes: 0, areas: [] };
      atual.quantos++; atual.valor += valor; atual.dentes += dentes;
      if (area && !atual.areas.includes(area)) atual.areas.push(area);
      if (!atual.id && id) atual.id = id;
      m.set(chave, atual);
    };
    for (const a of meusAtend) poe(a.pacienteId, a.pacienteNome, a.area, custoAtendimento ? custoAtendimento(a) : 0, 0);
    for (const r of meusProcs) {
      const chave = r.pacienteId || r.pacienteNome;
      if (m.has(chave)) {
        const atual = m.get(chave);
        atual.dentes += (r.dentes || []).length;
        if (r.area && !atual.areas.includes(r.area)) atual.areas.push(r.area);
      } else poe(r.pacienteId, r.pacienteNome, r.area, 0, (r.dentes || []).length);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  })();
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

      {/* Os números daquele voluntário: quanto ele já produziu para o
          projeto e quantas pessoas passaram pela cadeira dele */}
      <div className="grade-numeros">
        <div className="cartao-numero"><strong>{meusAtend.length}</strong><span>atendimentos</span></div>
        <div className="cartao-numero"><strong>{listaPacientes.length}</strong><span>pacientes atendidos</span></div>
        <div className="cartao-numero"><strong>{dentesTratados}</strong><span>dentes tratados</span></div>
        <div className="cartao-numero destaque"><strong>{dinheiro(valorProduzido)}</strong><span>valor produzido</span></div>
      </div>
      {porArea.length > 0 && (
        <div className="cartao">
          <strong style={{ display: 'block', marginBottom: 4 }}>Por especialidade</strong>
          {porArea.map(([area, x]) => (
            <p className="obs" key={area} style={{ margin: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: corDoNome(area), fontWeight: 700 }}>{area}</span>
              <span>{x.quantos} atend. · <b>{dinheiro(x.total)}</b></span>
            </p>
          ))}
        </div>
      )}

      <h3 style={{ margin: '14px 0 8px' }}>🧑‍🤝‍🧑 Pacientes que ele(a) atendeu ({listaPacientes.length})</h3>
      {listaPacientes.length ? (
        <>
          <p className="dica" style={{ margin: '0 0 8px' }}>Toque num paciente para abrir a ficha dele — o que foi feito, as fotos e tudo mais.</p>
          {listaPacientes.map(x => {
            const p = pacientes.find(y => y.id === x.id);
            const abrivel = !!p && !!aoAbrirPaciente;
            const Tag = abrivel ? 'button' : 'div';
            return (
              <Tag className="cartao" key={x.id || x.nome}
                onClick={abrivel ? () => aoAbrirPaciente(x.id) : undefined}
                style={abrivel ? { width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', font: 'inherit' } : undefined}>
                <div className="cartao-linha" style={{ alignItems: 'center' }}>
                  <Bolha nome={x.nome} foto={p?.foto} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{x.nome}</strong>
                    <p className="obs" style={{ margin: 0 }}>
                      {x.quantos} atendimento(s){x.areas.length ? ` · ${x.areas.join(', ')}` : ''}
                      {x.dentes ? ` · ${x.dentes} dente(s)` : ''}
                    </p>
                  </div>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>
                    <strong>{dinheiro(x.valor)}</strong>
                    {abrivel && <ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F' }} />}
                  </span>
                </div>
              </Tag>
            );
          })}
        </>
      ) : <p className="dica">Nenhum paciente atendido por este voluntário ainda.</p>}

      <h3 style={{ margin: '14px 0 8px' }}>Procedimentos que faz</h3>
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
      {/* Vai que a nota já foi fotografada antes e está na galeria */}
      <label className="btn-secundario" style={{ cursor: 'pointer', textAlign: 'center', display: 'block', marginBottom: 10 }}>
        🖼 Escolher da galeria
        <input type="file" accept="image/*" onChange={pegarFoto} style={{ display: 'none' }} />
      </label>
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
function FormItem({ item, aoCancelar, aoSalvar }) {
  const [f, setF] = useState({
    nome: item?.nome || '', quantidade: item ? qtdEstoque(item) : 0,
    unidade: item?.unidade || 'un', valor: Number(item?.valor || 0),
    minimo: Number(item?.minimo || 0), foto: item?.foto || '',
  });
  const muda = (k) => (v) => setF(x => ({ ...x, [k]: v }));

  async function pegarFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let d = await comprimirImagem(file, 0.7, 700);
      if (d.length > 700000) d = await comprimirImagem(file, 0.5, 500);
      setF(x => ({ ...x, foto: d }));
    } catch (err) { /* imagem ilegível */ }
  }

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>{item ? 'Editar material' : 'Novo material'}</h2>
      <Campo rotulo="Nome"><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Luvas de procedimento" /></Campo>
      <div className="linha-botoes">
        <Campo rotulo="Quantidade atual"><Contador valor={f.quantidade} aoMudar={muda('quantidade')} /></Campo>
        <Campo rotulo="Unidade"><SeletorUnidade valor={f.unidade} aoMudar={muda('unidade')} /></Campo>
      </div>
      <div className="linha-botoes">
        <Campo rotulo="Valor por unidade (R$)"><Contador valor={f.valor} aoMudar={muda('valor')} passo={0.5} decimal /></Campo>
        <Campo rotulo="Repor quando restar"><Contador valor={f.minimo} aoMudar={muda('minimo')} /></Campo>
      </div>
      <div className="campo">
        <span>Foto do material (opcional)</span>
        {f.foto ? (
          <div className="foto-item-tem">
            <img src={f.foto} alt="material" />
            <button type="button" className="btn-remover" onClick={() => setF({ ...f, foto: '' })}>✕</button>
          </div>
        ) : (
          <div className="foto-ad-vazia">
            <label className="foto-ad-botao">
              <Camera size={18} /><span>Tirar foto</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pegarFoto} />
            </label>
            <label className="foto-ad-botao secundario">
              <Images size={18} /><span>Da galeria</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pegarFoto} />
            </label>
          </div>
        )}
        <p className="dica" style={{ margin: '6px 0 0' }}>A foto aparece na lista, na retirada e na Colheita — quem apoia vê o que foi gasto.</p>
      </div>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>{item ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  );
}

function TelaItem({ item, acoes, movimentos, aoSalvar, aoMovimentar, aoExcluir, aoVoltar }) {
  const [mov, setMov] = useState({ qtd: 1, motivo: '', acaoId: '' });
  const falta = qtdEstoque(item) <= Number(item.minimo || 0);
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>{item.nome}</h2>
        <span className={'chip ' + (falta ? 'aguardando' : 'concluído')}>{qtdEstoque(item)} {item.unidade}{falta ? ' · FALTA' : ''}</span>
      </div>
      {item.foto && <img src={item.foto} alt={item.nome} style={{ width: '100%', maxWidth: 220, borderRadius: 16, display: 'block', marginBottom: 10 }} />}
      <p className="dica" style={{ marginTop: 0 }}>{dinheiro(item.valor)} por {item.unidade} · alerta abaixo de {item.minimo} {item.unidade}</p>

      <h3 style={{ margin: '10px 0 8px' }}>Movimentar</h3>
      <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Contador valor={mov.qtd} aoMudar={v => setMov({ ...mov, qtd: Math.max(1, Number(v || 1)) })} minimo={1} />
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
          <div className="cartao-topo"><strong>{deltaMov(m) > 0 ? '📥 Entrada' : '📤 Saída'}</strong><span className={'chip ' + (deltaMov(m) > 0 ? 'concluído' : 'em-atendimento')}>{deltaMov(m) > 0 ? '+' : ''}{deltaMov(m)}</span></div>
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
    // O lembrete deste aparelho só vale quando foi a INTERNET que falhou.
    // Se o banco RESPONDEU que a pessoa não tem mais acesso, o lembrete é
    // apagado — antes, quem perdia o acesso continuava entrando para sempre.
    const nega = (foiRede) => {
      if (cancelado) return;
      if (!foiRede) { try { localStorage.removeItem(lembrete); } catch (e) { /* nada */ } setAcesso('pedir'); return; }
      setAcesso(lerLocal(lembrete, false) ? 'liberado' : 'pedir');
    };
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
        nega(false);
      } catch (e) { nega(true); }
    })();
    return () => { cancelado = true; };
  }, [usuario]);

  async function resgatarCodigo(codigo) {
    const cod = codigo.trim().toUpperCase();
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = fb.fns;
    const ref = doc(fb.db, 'palmar-codigos', cod);
    const snap = await getDoc(ref).catch(() => null);
    if (!snap) return 'Sem internet para conferir o código. Tente de novo com conexão.';
    if (!snap.exists()) return 'Código não encontrado. Confira as letras.';
    if (snap.data().usadoPor) return 'Esse código já foi usado.';
    // Gastar o código PRIMEIRO, e esperar: é essa marca no banco que prova,
    // para as regras de segurança, que a pessoa tem direito de entrar.
    try {
      await updateDoc(ref, { usadoPor: usuario.uid, usadoPorNome: usuario.nome || '', usadoEm: serverTimestamp() });
    } catch (e) {
      return 'Não consegui usar o código agora. Confira a internet e tente outra vez.';
    }
    setDoc(doc(fb.db, 'palmar-usuarios', usuario.uid), { nome: usuario.nome || '', email: usuario.email || '', papel: 'gestor', codigo: cod, criadoEm: serverTimestamp() }).catch(() => {});
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

  // Apagar a conta: some o acesso de gestor e a conta de entrada
  const [apagandoConta, setApagandoConta] = useState(false);
  async function apagarMinhaConta(senha) {
    await apagarConta(CONFIGURADO ? fb : null, usuario,
      [{ colecao: 'palmar-usuarios', id: usuario.uid },
       { colecao: 'palmar-autorizados', id: String(usuario.email || '').trim().toLowerCase() },
       ...(window.__tokenPush ? [{ colecao: 'aparelhos', id: window.__tokenPush }] : [])],
      ['pm-usuario', 'pm-ja-entrou-' + usuario.uid], senha);
    if (window.__sairNativoGoogle) { try { await window.__sairNativoGoogle(); } catch (e) { /* segue */ } }
    setApagandoConta(false);
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
  else if (apagandoConta) conteudo = <TelaApagarConta usuario={usuario} aoApagar={apagarMinhaConta}
    oQueFica="As ações, o estoque, as notas e o histórico do projeto continuam — são registros do trabalho, não dados seus. Se você era o único gestor, gere um código de acesso para outra pessoa ANTES de apagar."
    aoVoltar={() => setApagandoConta(false)} />;
  else if (acesso === 'pedir') conteudo = <TelaCodigo usuario={usuario} aoResgatar={resgatarCodigo} aoSair={sair} aoApagarConta={() => setApagandoConta(true)} />;
  else conteudo = <TelaPrincipal usuario={usuario} aoSair={sair} aoApagarConta={() => setApagandoConta(true)} aoChamarStaff={chamarStaff} />;
  return <>{conteudo}{chamadaNaTela && <TelaChamada chamada={chamadaNaTela} aoAtender={c => encerrarChamada(c, true)} />}{abertura}</>;
}

if (!window.__appJaSubiu) {
  window.__appJaSubiu = true;
  ligarGestoVoltar();
  createRoot(document.getElementById('root')).render(<RedeDeSeguranca><App /></RedeDeSeguranca>);
}
