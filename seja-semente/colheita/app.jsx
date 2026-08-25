// ═══════════════════════════════════════════════════════════════════════════
//  COLHEITA — o aplicativo de quem INVESTIU no projeto Seja Semente.
//  É a prestação de contas em forma de sorrisos. Só LEITURA: o investidor
//  não muda nada, ele confere.
//    1. SORRISOS — quantas pessoas foram transformadas e a galeria do
//       antes/depois: toque num sorriso e veja a história inteira
//    2. AÇÕES — o relatório final de cada mutirão: pessoas atendidas,
//       valor produzido por especialidade, materiais e notas
//    3. CONTAS — as notas fiscais, o que foi comprado, com a prova do QR
//    4. PERFIL — quem está vendo e o que ele apoiou
//  Lê o mesmo banco dos outros apps — contrato em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal, corDoNome, Abertura, GoogleG, BrotoMini, ligarGestoVoltar, usarTemInternet } from '../logo.jsx';
import { Sparkles, Flag, Receipt, User, ChevronLeft, ChevronRight, Mail, Lock, Eye, EyeOff, Home } from 'lucide-react';
import { SobreOProjeto } from '../projeto.jsx';

// Logo da Colheita: a mão dourada com o coração — a mesma do ecossistema
function LogoApp({ tamanho = 120 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }}>
      <defs>
        <linearGradient id="ch-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2A6B45" /><stop offset="1" stopColor="#143D28" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#ch-fundo)" />
      <circle cx="50" cy="47" r="33" fill="#4F8C5C" stroke="#9FC7A4" strokeWidth="2" />
      <path d="M50 52 C45 47 36.5 42.5 36.5 36.8 C36.5 31.8 42.2 29.2 45.8 32.8 C47.4 34.4 49 35.9 50 37.4 C51 35.9 52.6 34.4 54.2 32.8 C57.8 29.2 63.5 31.8 63.5 36.8 C63.5 42.5 55 47 50 52 Z" fill="#E3B45A" />
      <path d="M33.5 55 C33.5 67 41.2 73.5 50 73.5 C58.8 73.5 66.5 67 66.5 55 L60.5 55 C60.5 63.4 56 68 50 68 C44 68 39.5 63.4 39.5 55 Z" fill="#E3B45A" />
      <path d="M34 55.6 C31.6 52.4 27.4 52.8 26.2 56.2 C25 59.8 27.4 62.8 30.8 63.4 L34.2 63.8 C33.4 61.2 33.2 58.4 33.5 55.6 Z" fill="#E3B45A" />
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

// ─── Ajudinhas ───
function isoDe(v) {
  const d = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
  if (!d || isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-').map(Number);
  if (!a) return '';
  const dt = new Date(a, m - 1, d);
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return `${dias[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}
const dinheiro = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
// A privacidade do paciente vem primeiro: para quem investiu, o sorriso
// aparece pelo PRIMEIRO NOME — a identificação completa fica com a equipe
const primeiroNome = (n) => String(n || 'Paciente').trim().split(/\s+/)[0];

// ─── Modo demonstração ───
const fotoFalsa = (texto, cor) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${cor}"/><text x="150" y="165" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">${texto}</text></svg>`
);
const DEMO = {
  usuario: { uid: 'inv-demo', nome: 'Investidor de Teste', email: 'investidor@teste.com' },
  investidor: { id: 'i1', nome: 'Carlos Pereira', empresa: 'Dental Sul Materiais', email: 'investidor@teste.com', acaoId: 'ac1', acaoTitulo: 'Mutirão da Comunidade' },
  acoes: [
    { id: 'ac1', titulo: 'Mutirão da Comunidade', data: new Date().toISOString().slice(0, 10), local: 'Igreja Central', status: 'encerrada', registros: [] },
  ],
  sorrisos: [
    { id: 's1', pacienteId: 'p1', pacienteNome: 'José da Silva', area: 'Cirurgia', descricao: 'Extração dos dois sisos superiores, sem intercorrências.', dentes: [18, 28], autorNome: 'Maria Souza', criadoEm: new Date(), antes: fotoFalsa('ANTES', '#8B6B5C'), depois: fotoFalsa('DEPOIS', '#3F8C5F') },
    { id: 's2', pacienteId: 'p2', pacienteNome: 'Rita Nascimento', area: 'Prótese', descricao: 'Prótese superior instalada — voltou a sorrir sem cobrir a boca.', dentes: [11], autorNome: 'Pedro Lima', criadoEm: new Date(Date.now() - 864e5), antes: fotoFalsa('ANTES', '#8B6B5C'), depois: fotoFalsa('DEPOIS', '#3F8C5F') },
    { id: 's3', pacienteId: 'p3', pacienteNome: 'Ana Paula', area: 'Profilaxia', descricao: 'Limpeza completa e orientação de escovação.', dentes: [], autorNome: 'Maria Souza', criadoEm: new Date(Date.now() - 2 * 864e5), antes: fotoFalsa('ANTES', '#8B6B5C'), depois: fotoFalsa('DEPOIS', '#3F8C5F') },
  ],
  notas: [
    { id: 'n1', acaoId: 'ac1', acaoTitulo: 'Mutirão da Comunidade', valor: 148.9, descricao: 'Materiais descartáveis', chave: '35260812345678000199650010000012341000012349', origem: 'qr', criadaEm: new Date() },
    { id: 'n2', acaoId: 'ac1', acaoTitulo: 'Mutirão da Comunidade', valor: 320, descricao: 'Anestésicos e agulhas', origem: 'foto', criadaEm: new Date() },
  ],
  movimentos: [
    { id: 'm1', itemNome: 'Anestésico lidocaína', delta: -4, valorUnit: 4.5, acaoId: 'ac1', acaoTitulo: 'Mutirão da Comunidade', em: new Date() },
  ],
  config: { valores: { Cirurgia: 1000, 'Prótese': 900, Profilaxia: 500 }, porDente: { Cirurgia: true } },
};

// ─── Entrada ───
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
          if (cod === 'auth/popup-blocked') { window.location.href = 'https://seja-semente-app.firebaseapp.com'; return; }
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
      <h1>Colheita</h1>
      <p className="login-etiqueta">Para quem semeou junto</p>
      <div className="divisor-broto"><i /><BrotoMini tamanho={19} /><i /></div>
      <p className="missao">Veja em sorrisos o que a sua semente <em>colheu</em>.</p>
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

function TelaSemAcesso({ usuario, aoSair }) {
  return (
    <div className="tela-login">
      <LogoApp tamanho={104} />
      <h1>Quase lá</h1>
      <p className="missao">
        Olá, {usuario.nome?.split(' ')[0] || 'tudo bem'}! A Colheita é para quem apoia o projeto.
        Peça à coordenação para cadastrar o e-mail <b>{usuario.email}</b> na lista de investidores — aí o
        seu acesso abre sozinho, sem precisar de senha nova.
      </p>
      <button className="link-troca" onClick={aoSair}>Sair / entrar com outra conta</button>
    </div>
  );
}

function Vazio({ texto }) { return <div className="vazio">{texto}</div>; }

// ─── A tela principal ───
function TelaPrincipal({ usuario, investidor, ehGestor, aoSair }) {
  const [aba, setAba] = useState('inicio');
  const [tela, setTela] = useState(null);
  const [soMinhaAcao, setSoMinhaAcao] = useState(!!investidor?.acaoId);
  const temInternet = usarTemInternet();

  const [acoes, setAcoes] = useState(CONFIGURADO ? [] : DEMO.acoes);
  const [sorrisos, setSorrisos] = useState(CONFIGURADO ? [] : DEMO.sorrisos);
  const [notas, setNotas] = useState(CONFIGURADO ? [] : DEMO.notas);
  const [movimentos, setMovimentos] = useState(CONFIGURADO ? [] : DEMO.movimentos);
  const [configProc, setConfigProc] = useState(CONFIGURADO ? { valores: {}, porDente: {} } : DEMO.config);
  const [carregando, setCarregando] = useState(CONFIGURADO);

  // Escutas em tempo real (só leitura)
  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, collectionGroup, doc, onSnapshot, query, orderBy, getDoc } = fb.fns;
    const escuta = (col, ord, poe) => onSnapshot(query(collection(fb.db, col), orderBy(...ord)), s => poe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const soltar = [
      escuta('acoes', ['data', 'desc'], setAcoes),
      escuta('notas', ['criadaEm', 'desc'], setNotas),
      escuta('estoque-movimentos', ['em', 'desc'], setMovimentos),
      onSnapshot(doc(fb.db, 'config', 'procedimentos'), snap => {
        if (snap.exists()) setConfigProc({ valores: {}, porDente: {}, ...snap.data() });
      }),
      // Os sorrisos: todos os procedimentos registrados, de todos os
      // pacientes (as fotos são buscadas depois, sob demanda)
      onSnapshot(collectionGroup(fb.db, 'procedimentos'), snap => {
        const lista = snap.docs.map(d => ({
          id: d.id,
          pacienteId: d.ref.parent.parent?.id || '',
          ...d.data(),
        })).sort((a, b) => (isoDe(b.criadoEm) || '').localeCompare(isoDe(a.criadoEm) || ''));
        setSorrisos(lista);
        setCarregando(false);
      }, () => setCarregando(false)),
    ];
    return () => soltar.forEach(s => s());
  }, []);

  // Fotos do antes/depois: buscadas só quando o sorriso aparece na tela
  const [fotos, setFotos] = useState({}); // { arquivoId: dataUrl }
  const buscando = useRef(new Set());
  async function pegarFoto(pacienteId, arquivoId) {
    if (!CONFIGURADO || !pacienteId || !arquivoId) return;
    if (fotos[arquivoId] !== undefined || buscando.current.has(arquivoId)) return;
    buscando.current.add(arquivoId);
    try {
      const snap = await fb.fns.getDoc(fb.fns.doc(fb.db, 'pacientes', pacienteId, 'arquivos', arquivoId));
      setFotos(f => ({ ...f, [arquivoId]: snap.exists() ? (snap.data().dataUrl || '') : '' }));
    } catch (e) {
      setFotos(f => ({ ...f, [arquivoId]: '' }));
    }
  }
  const fotoDe = (s, qual) => {
    if (!CONFIGURADO) return s[qual];               // demonstração
    const id = qual === 'antes' ? s.fotoAntesId : s.fotoDepoisId;
    return id ? fotos[id] : '';
  };

  const valorDe = (nome) => Number(configProc.valores?.[nome] || 0);
  const ehPorDente = (nome) => !!configProc.porDente?.[nome];
  const valorDoSorriso = (s) => {
    const v = valorDe(s.area);
    if (!v) return 0;
    return ehPorDente(s.area) ? v * Math.max(1, (s.dentes || []).length) : v;
  };

  // Recorte: a ação que o investidor apoiou (pela data) ou o projeto todo
  const minhaAcao = investidor?.acaoId ? acoes.find(a => a.id === investidor.acaoId) : null;
  const filtrando = soMinhaAcao && !!minhaAcao;
  const sorrisosVisiveis = filtrando ? sorrisos.filter(s => isoDe(s.criadoEm) === minhaAcao.data) : sorrisos;
  const notasVisiveis = filtrando ? notas.filter(n => n.acaoId === minhaAcao.id) : notas;
  const acoesVisiveis = filtrando ? acoes.filter(a => a.id === minhaAcao.id) : acoes;
  const movimentosVisiveis = filtrando ? movimentos.filter(m => m.acaoId === minhaAcao.id) : movimentos;

  const pessoas = new Set(sorrisosVisiveis.map(s => s.pacienteId)).size;
  const produzido = sorrisosVisiveis.reduce((s, x) => s + valorDoSorriso(x), 0);
  const gastoNotas = notasVisiveis.reduce((s, n) => s + Number(n.valor || 0), 0);
  const gastoMateriais = movimentosVisiveis.filter(m => m.delta < 0).reduce((s, m) => s + Math.abs(m.delta) * Number(m.valorUnit || 0), 0);

  // Carrega as fotos dos sorrisos que estão à vista
  const [quantos, setQuantos] = useState(12);
  useEffect(() => {
    for (const s of sorrisosVisiveis.slice(0, quantos)) {
      if (s.fotoAntesId) pegarFoto(s.pacienteId, s.fotoAntesId);
      if (s.fotoDepoisId) pegarFoto(s.pacienteId, s.fotoDepoisId);
    }
  }, [sorrisosVisiveis.length, quantos, filtrando]);

  // ═══ TELAS CHEIAS ═══
  if (tela?.sorriso) {
    const s = sorrisos.find(x => x.id === tela.sorriso);
    if (s) {
      if (s.fotoAntesId) pegarFoto(s.pacienteId, s.fotoAntesId);
      if (s.fotoDepoisId) pegarFoto(s.pacienteId, s.fotoDepoisId);
      const antes = fotoDe(s, 'antes');
      const depois = fotoDe(s, 'depois');
      return (
        <div className="folha">
          <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
          <h2>😁 O sorriso de {primeiroNome(s.pacienteNome)}</h2>
          <p className="dica" style={{ marginTop: 0 }}>{dataBonita(isoDe(s.criadoEm))}{s.autorNome ? ` · por ${s.autorNome}` : ''}</p>
          <div className="antes-depois-par ver">
            {antes ? <span className="foto-ad-mini" style={{ cursor: 'default' }}><img src={antes} alt="Antes" /><span>ANTES</span></span> : null}
            {depois ? <span className="foto-ad-mini" style={{ cursor: 'default' }}><img src={depois} alt="Depois" /><span>DEPOIS</span></span> : null}
          </div>
          {!antes && !depois && <p className="dica">Este atendimento não teve fotos registradas.</p>}
          <div className="cartao" style={{ marginTop: 12 }}>
            <div className="cartao-topo"><strong style={{ color: corDoNome(s.area) }}>{s.area || 'Atendimento'}</strong><strong>{dinheiro(valorDoSorriso(s))}</strong></div>
            {s.descricao && <p style={{ margin: '6px 0 0' }}>{s.descricao}</p>}
            {(s.dentes || []).length > 0 && <p className="obs" style={{ margin: '6px 0 0' }}>🦷 Dentes tratados: {s.dentes.join(', ')}</p>}
          </div>
          <p className="dica" style={{ marginTop: 12 }}>O valor é quanto este atendimento custaria fora do projeto — foi isso que a sua doação entregou.</p>
        </div>
      );
    }
  }

  if (tela?.acao) {
    const a = acoes.find(x => x.id === tela.acao);
    if (a) {
      const daAcao = sorrisos.filter(s => isoDe(s.criadoEm) === a.data);
      const porArea = {};
      for (const s of daAcao) {
        const chave = s.area || 'Outros';
        porArea[chave] = porArea[chave] || { quantos: 0, total: 0 };
        porArea[chave].quantos++;
        porArea[chave].total += valorDoSorriso(s);
      }
      const notasDaAcao = notas.filter(n => n.acaoId === a.id);
      const materiaisDaAcao = movimentos.filter(m => m.acaoId === a.id && m.delta < 0);
      const totalProd = Object.values(porArea).reduce((s, v) => s + v.total, 0);
      const totalGasto = notasDaAcao.reduce((s, n) => s + Number(n.valor || 0), 0)
        + materiaisDaAcao.reduce((s, m) => s + Math.abs(m.delta) * Number(m.valorUnit || 0), 0);
      return (
        <div className="folha">
          <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
          <h2>🌱 {a.titulo}</h2>
          <p className="dica" style={{ marginTop: 0 }}>{dataBonita(a.data)}{a.local ? ` · ${a.local}` : ''}</p>
          <div className="grade-numeros">
            <div className="cartao-numero"><strong>{new Set(daAcao.map(s => s.pacienteId)).size}</strong><span>pessoas atendidas</span></div>
            <div className="cartao-numero"><strong>{daAcao.length}</strong><span>procedimentos</span></div>
            <div className="cartao-numero destaque"><strong>{dinheiro(totalProd)}</strong><span>valor entregue</span></div>
            <div className="cartao-numero"><strong>{dinheiro(totalGasto)}</strong><span>custo da ação</span></div>
          </div>
          {totalGasto > 0 && totalProd > 0 && (
            <div className="cartao" style={{ border: '1.5px solid #37935B' }}>
              <div className="cartao-topo"><strong>💚 Cada R$ 1,00 investido virou</strong><strong style={{ fontSize: 20 }}>{dinheiro(totalProd / totalGasto)}</strong></div>
              <p className="obs" style={{ margin: 0 }}>em tratamento entregue para quem precisava.</p>
            </div>
          )}
          <h3 style={{ margin: '16px 0 8px' }}>Por especialidade</h3>
          {Object.entries(porArea).length ? Object.entries(porArea).sort((x, y) => y[1].total - x[1].total).map(([area, v]) => (
            <div className="cartao" key={area}>
              <div className="cartao-topo"><strong style={{ color: corDoNome(area) }}>{area}</strong><strong>{dinheiro(v.total)}</strong></div>
              <p className="obs" style={{ margin: 0 }}>{v.quantos} procedimento(s)</p>
            </div>
          )) : <p className="dica">Nenhum procedimento registrado nesta ação.</p>}

          {notasDaAcao.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>📄 Notas fiscais da ação</h3>
              {notasDaAcao.map(n => (
                <div className="cartao" key={n.id}>
                  <div className="cartao-topo"><strong>{n.descricao || 'Nota fiscal'}</strong><strong>{dinheiro(n.valor)}</strong></div>
                  <p className="obs" style={{ margin: 0 }}>{n.chave ? '✓ nota verificada pelo QR · …' + String(n.chave).slice(-8) : '📷 foto da nota'}</p>
                </div>
              ))}
            </>
          )}
          {materiaisDaAcao.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>📦 Materiais usados</h3>
              {materiaisDaAcao.map(m => (
                <div className="cartao" key={m.id}>
                  <div className="cartao-topo"><strong>{m.itemNome}</strong><strong>{dinheiro(Math.abs(m.delta) * Number(m.valorUnit || 0))}</strong></div>
                  <p className="obs" style={{ margin: 0 }}>{Math.abs(m.delta)} unidade(s)</p>
                </div>
              ))}
            </>
          )}
          {daAcao.length > 0 && (
            <>
              <h3 style={{ margin: '16px 0 8px' }}>😁 Os sorrisos desta ação</h3>
              {daAcao.map(s => (
                <button className="cartao" key={s.id} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setTela({ sorriso: s.id })}>
                  <div className="cartao-topo"><strong>{primeiroNome(s.pacienteNome)}</strong><ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F' }} /></div>
                  <p className="obs" style={{ margin: 0 }}>{s.area}{s.descricao ? ` · ${String(s.descricao).slice(0, 60)}` : ''}</p>
                </button>
              ))}
            </>
          )}
        </div>
      );
    }
  }

  return (
    <div className="tela-principal">
      <header className="compacta">
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={30} /></div>
          <div>
            <strong>Colheita</strong>
            <div className="status online">{temInternet ? `● ${investidor?.nome?.split(' ')[0] || usuario.nome?.split(' ')[0] || 'Bem-vindo'}` : '📴 Sem internet'}</div>
          </div>
        </div>
      </header>

      <main>
        {minhaAcao && aba !== 'inicio' && (
          <div className="seletor" style={{ margin: '0 0 12px' }}>
            <button className={soMinhaAcao ? 'ativo' : ''} onClick={() => setSoMinhaAcao(true)}>O que eu apoiei</button>
            <button className={!soMinhaAcao ? 'ativo' : ''} onClick={() => setSoMinhaAcao(false)}>O projeto todo</button>
          </div>
        )}

        {aba === 'inicio' && <SobreOProjeto Logo={LogoApp} />}

        {aba === 'sorrisos' && (
          <>
            <h2>Os sorrisos</h2>
            {filtrando && <p className="dica" style={{ marginTop: 0 }}>Mostrando a ação que você apoiou: <b>{minhaAcao.titulo}</b>.</p>}
            <div className="grade-numeros">
              <div className="cartao-numero"><strong>{pessoas}</strong><span>vidas transformadas</span></div>
              <div className="cartao-numero"><strong>{sorrisosVisiveis.length}</strong><span>sorrisos devolvidos</span></div>
              <div className="cartao-numero destaque"><strong>{dinheiro(produzido)}</strong><span>em tratamento entregue</span></div>
              <div className="cartao-numero"><strong>{dinheiro(gastoNotas + gastoMateriais)}</strong><span>custo prestado em contas</span></div>
            </div>
            {carregando ? <p className="dica">Buscando os sorrisos…</p> : (
              sorrisosVisiveis.length ? (
                <>
                  <p className="dica">Toque num sorriso para ver a história inteira.</p>
                  {sorrisosVisiveis.slice(0, quantos).map(s => {
                    const antes = fotoDe(s, 'antes');
                    const depois = fotoDe(s, 'depois');
                    return (
                      <button className="cartao" key={s.id} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setTela({ sorriso: s.id })}>
                        <div className="cartao-topo">
                          <strong>{primeiroNome(s.pacienteNome)}</strong>
                          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="chip triado" style={{ background: corDoNome(s.area) + '1C', color: corDoNome(s.area) }}>{s.area}</span>
                            <ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F' }} />
                          </span>
                        </div>
                        {(antes || depois) && (
                          <div className="antes-depois-par ver" style={{ marginTop: 8 }}>
                            {antes && <span className="foto-ad-mini"><img src={antes} alt="Antes" /><span>ANTES</span></span>}
                            {depois && <span className="foto-ad-mini"><img src={depois} alt="Depois" /><span>DEPOIS</span></span>}
                          </div>
                        )}
                        <p className="obs" style={{ margin: '6px 0 0' }}>{dataBonita(isoDe(s.criadoEm))}{s.autorNome ? ` · ${s.autorNome}` : ''}</p>
                      </button>
                    );
                  })}
                  {sorrisosVisiveis.length > quantos && (
                    <button className="btn-principal" style={{ maxWidth: 'none' }} onClick={() => setQuantos(q => q + 12)}>
                      Ver mais sorrisos ({sorrisosVisiveis.length - quantos})
                    </button>
                  )}
                </>
              ) : <Vazio texto="Assim que a equipe registrar os atendimentos com as fotos do antes e depois, cada sorriso aparece aqui." />
            )}
          </>
        )}

        {aba === 'acoes' && (
          <>
            <h2>Ações</h2>
            <p className="dica" style={{ marginTop: 0 }}>Toque numa ação para ver o relatório completo — quem foi atendido, quanto foi entregue e quanto custou.</p>
            {acoesVisiveis.length ? acoesVisiveis.map(a => {
              const daAcao = sorrisos.filter(s => isoDe(s.criadoEm) === a.data);
              return (
                <button className="cartao" key={a.id} style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setTela({ acao: a.id })}>
                  <div className="cartao-topo">
                    <strong>🌱 {a.titulo}</strong>
                    <ChevronRight size={18} strokeWidth={2.6} style={{ color: '#9AA79F' }} />
                  </div>
                  <p className="obs" style={{ margin: 0 }}>{dataBonita(a.data)}{a.local ? ` · ${a.local}` : ''} · {new Set(daAcao.map(s => s.pacienteId)).size} pessoa(s) atendida(s)</p>
                </button>
              );
            }) : <Vazio texto="Nenhuma ação registrada ainda." />}
          </>
        )}

        {aba === 'contas' && (
          <>
            <h2>Prestação de contas</h2>
            <p className="dica" style={{ marginTop: 0 }}>Cada compra do projeto, com a nota. As marcadas com ✓ tiveram o QR da nota lido — é a nota oficial, conferida.</p>
            <div className="grade-numeros">
              <div className="cartao-numero"><strong>{dinheiro(gastoNotas)}</strong><span>em notas fiscais</span></div>
              <div className="cartao-numero"><strong>{dinheiro(gastoMateriais)}</strong><span>em materiais usados</span></div>
            </div>
            {notasVisiveis.length ? notasVisiveis.map(n => (
              <div className="cartao" key={n.id}>
                <div className="cartao-topo"><strong>{n.descricao || 'Nota fiscal'}</strong><strong>{dinheiro(n.valor)}</strong></div>
                <p className="obs" style={{ margin: 0 }}>
                  {n.chave ? `✓ nota verificada pelo QR · …${String(n.chave).slice(-8)}` : '📷 foto da nota'}
                  {n.acaoTitulo ? ` · ${n.acaoTitulo}` : ''}
                </p>
                {n.foto && <img src={n.foto} alt="nota" style={{ maxWidth: '100%', borderRadius: 10, marginTop: 8 }} />}
              </div>
            )) : <Vazio texto="Nenhuma nota registrada ainda." />}
            {movimentosVisiveis.filter(m => m.delta < 0).length > 0 && (
              <>
                <h3 style={{ margin: '16px 0 8px' }}>📦 Materiais usados</h3>
                {movimentosVisiveis.filter(m => m.delta < 0).map(m => (
                  <div className="cartao" key={m.id}>
                    <div className="cartao-topo"><strong>{m.itemNome}</strong><strong>{dinheiro(Math.abs(m.delta) * Number(m.valorUnit || 0))}</strong></div>
                    <p className="obs" style={{ margin: 0 }}>{Math.abs(m.delta)} unidade(s){m.acaoTitulo ? ` · ${m.acaoTitulo}` : ''}</p>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {aba === 'perfil' && (
          <>
            <h2>Meu perfil</h2>
            <div className="cartao">
              <div className="cartao-linha">
                <Bolha nome={investidor?.nome || usuario.nome} />
                <div>
                  <p style={{ marginTop: 0 }}><strong>{investidor?.nome || usuario.nome}</strong></p>
                  {investidor?.empresa && <p>{investidor.empresa}</p>}
                  {usuario.email && <p>{usuario.email}</p>}
                  <p className="obs">{ehGestor ? 'Gestão do projeto' : 'Investidor do projeto'}</p>
                </div>
              </div>
            </div>
            {minhaAcao && (
              <div className="cartao">
                <div className="cartao-topo"><strong>🌱 Você apoiou</strong></div>
                <p style={{ margin: '6px 0 0' }}>{minhaAcao.titulo} · {dataBonita(minhaAcao.data)}</p>
              </div>
            )}
            <div className="cartao">
              <strong style={{ display: 'block', marginBottom: 6 }}>💚 Obrigado</strong>
              <p className="obs" style={{ margin: 0 }}>
                Cada número aqui veio do trabalho real da equipe em campo — os atendimentos são
                registrados na hora, com foto do antes e do depois. O nome completo dos pacientes
                fica só com a equipe de saúde; aqui você vê o primeiro nome e o sorriso.
              </p>
            </div>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'inicio' ? 'ativo' : ''} onClick={() => setAba('inicio')}><Home size={22} /><span>Projeto</span></button>
        <button className={aba === 'sorrisos' ? 'ativo' : ''} onClick={() => setAba('sorrisos')}><Sparkles size={22} /><span>Sorrisos</span></button>
        <button className={aba === 'acoes' ? 'ativo' : ''} onClick={() => setAba('acoes')}><Flag size={22} /><span>Ações</span></button>
        <button className={aba === 'contas' ? 'ativo' : ''} onClick={() => setAba('contas')}><Receipt size={22} /><span>Contas</span></button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}><User size={22} /><span>Perfil</span></button>
      </nav>
    </div>
  );
}

// ─── O aplicativo ───
function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(CONFIGURADO ? null : lerLocal('ch-usuario', null));
  const [acesso, setAcesso] = useState(CONFIGURADO ? 'checando' : 'liberado');
  const [investidor, setInvestidor] = useState(CONFIGURADO ? null : DEMO.investidor);
  const [ehGestor, setEhGestor] = useState(false);
  const [erroInicial, setErroInicial] = useState('');
  const largou = useRef(false);

  useEffect(() => { if (!CONFIGURADO) gravarLocal('ch-usuario', usuario); }, [usuario]);

  // Quem entra: investidor cadastrado no Palmar (pelo e-mail) ou gestor
  useEffect(() => {
    if (!CONFIGURADO) { setAcesso('liberado'); return; }
    if (!usuario) { setAcesso('checando'); return; }
    let cancelado = false;
    const lembrete = 'ch-ja-entrou-' + usuario.uid;
    (async () => {
      try {
        const { collection, query, where, getDocs, doc, getDoc, limit } = fb.fns;
        const email = String(usuario.email || '').toLowerCase();
        if (email) {
          const achou = await getDocs(query(collection(fb.db, 'investidores'), where('email', '==', email), limit(1)));
          if (!achou.empty && !cancelado) {
            setInvestidor({ id: achou.docs[0].id, ...achou.docs[0].data() });
            gravarLocal(lembrete, true);
            setAcesso('liberado');
            return;
          }
        }
        const gestor = await getDoc(doc(fb.db, 'palmar-usuarios', usuario.uid));
        if (gestor.exists() && !cancelado) {
          setEhGestor(true);
          gravarLocal(lembrete, true);
          setAcesso('liberado');
          return;
        }
        if (!cancelado) setAcesso(lerLocal(lembrete, false) ? 'liberado' : 'sem-acesso');
      } catch (e) {
        if (!cancelado) setAcesso(lerLocal(lembrete, false) ? 'liberado' : 'sem-acesso');
      }
    })();
    return () => { cancelado = true; };
  }, [usuario]);

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
    setInvestidor(null);
    setEhGestor(false);
  }

  const [abrindo, setAbrindo] = useState(true);
  const abertura = abrindo ? <Abertura tema="dourado" nome="Colheita" frase="o que a semente virou" aoTerminar={() => setAbrindo(false)} /> : null;

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
  else if (acesso === 'sem-acesso') conteudo = <TelaSemAcesso usuario={usuario} aoSair={sair} />;
  else conteudo = <TelaPrincipal usuario={usuario} investidor={investidor} ehGestor={ehGestor} aoSair={sair} />;
  return <>{conteudo}{abertura}</>;
}

if (!window.__appJaSubiu) {
  window.__appJaSubiu = true;
  ligarGestoVoltar();
  createRoot(document.getElementById('root')).render(<App />);
}
