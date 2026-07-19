import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, collection, doc,
  getDocs, getDoc, writeBatch, onSnapshot, deleteDoc, setDoc,
} from 'firebase/firestore';
import { getStorage, ref as refArquivo, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import App from './App.jsx';
import logoMarca from './logo-special.png';

// ─── Armazém de arquivos (Firebase Storage): anexos vão como binário puro ───
// Muito mais rápido que guardar no banco (sem limite de 1MB, sem inflar 33% em texto)
function instalarArquivos() {
  const st = getStorage();
  window.arquivos = {
    async subir(blob, nome, aoProgresso) {
      const caminho = `anexos/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}-${String(nome || 'arquivo').replace(/[^\w.\-]+/g, '_')}`;
      const tarefa = uploadBytesResumable(refArquivo(st, caminho), blob);
      await new Promise((res, rej) => {
        tarefa.on('state_changed',
          (s) => { if (aoProgresso && s.totalBytes > 0) aoProgresso(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
          rej, res);
      });
      const url = await getDownloadURL(refArquivo(st, caminho));
      return { url, caminho };
    },
    async apagar(caminho) {
      try { await deleteObject(refArquivo(st, caminho)); } catch (e) { /* já não existe */ }
    },
  };
}

const firebaseConfig = {
  apiKey: 'AIzaSyD8w3_SK27YHDFlsYpxAto3sNxCnh3tFcg',
  authDomain: 'laboratorio-special.firebaseapp.com',
  projectId: 'laboratorio-special',
  storageBucket: 'laboratorio-special.firebasestorage.app',
  messagingSenderId: '138572658603',
  appId: '1:138572658603:web:76e4649e21d8d16aa804ee',
};

const EMAIL_DONO = 'joaopaulocastro41@gmail.com';
const LAB = 'principal';
const TAM_CHUNK = 900000; // Firestore limita documentos a ~1MB

const fbApp = initializeApp(firebaseConfig);
// No app do iPhone (esquema capacitor://) o getAuth padrão trava e a tela fica em "Carregando..."
// — a inicialização nativa com indexedDB resolve
const ehIosNativo = typeof location !== 'undefined' && location.protocol === 'capacitor:';
const auth = ehIosNativo
  ? initializeAuth(fbApp, { persistence: indexedDBLocalPersistence })
  : getAuth(fbApp);
const db = initializeFirestore(fbApp, { localCache: persistentLocalCache() });

const colCasos = () => collection(db, 'labs', LAB, 'casos');
const docCaso = (id) => doc(db, 'labs', LAB, 'casos', id);
const docKV = (key) => doc(db, 'labs', LAB, 'kv', key);

// Espelho local dos casos para gravar no banco só o que mudou
let espelhoCasos = new Map();

function ordenarCasos(lista) {
  // ids começam com timestamp em base36 — mais novo primeiro, como o app espera
  return lista.sort((a, b) => (a.id < b.id ? 1 : -1));
}

async function lerCasos() {
  const snap = await getDocs(colCasos());
  const lista = [];
  espelhoCasos = new Map();
  snap.forEach(d => {
    const c = d.data();
    lista.push(c);
    espelhoCasos.set(d.id, JSON.stringify(c));
  });
  return ordenarCasos(lista);
}

async function gravarCasos(lista) {
  const batch = writeBatch(db);
  const idsNovos = new Set();
  let mudou = false;
  for (const c of lista) {
    idsNovos.add(c.id);
    const json = JSON.stringify(c);
    if (espelhoCasos.get(c.id) !== json) {
      batch.set(docCaso(c.id), c);
      espelhoCasos.set(c.id, json);
      mudou = true;
    }
  }
  for (const id of [...espelhoCasos.keys()]) {
    if (!idsNovos.has(id)) {
      batch.delete(docCaso(id));
      espelhoCasos.delete(id);
      mudou = true;
    }
  }
  if (mudou) await batch.commit();
}

async function lerKV(key) {
  const snap = await getDoc(docKV(key));
  if (!snap.exists()) return null;
  const d = snap.data();
  if (d.chunks) {
    const partes = [];
    for (let i = 0; i < d.chunks; i++) {
      const p = await getDoc(docKV(`${key}__c${i}`));
      partes.push(p.exists() ? p.data().v : '');
    }
    return partes.join('');
  }
  return d.v ?? null;
}

async function gravarKV(key, valor) {
  const s = String(valor);
  if (s.length <= TAM_CHUNK) {
    await setDoc(docKV(key), { v: s });
    return;
  }
  const n = Math.ceil(s.length / TAM_CHUNK);
  const batch = writeBatch(db);
  batch.set(docKV(key), { chunks: n });
  for (let i = 0; i < n; i++) {
    batch.set(docKV(`${key}__c${i}`), { v: s.slice(i * TAM_CHUNK, (i + 1) * TAM_CHUNK) });
  }
  await batch.commit();
}

async function apagarKV(key) {
  const snap = await getDoc(docKV(key));
  if (snap.exists() && snap.data().chunks) {
    const n = snap.data().chunks;
    const batch = writeBatch(db);
    for (let i = 0; i < n; i++) batch.delete(docKV(`${key}__c${i}`));
    batch.delete(docKV(key));
    await batch.commit();
    return;
  }
  await deleteDoc(docKV(key));
}

// Mantém a lista de e-mails autorizados em dia sempre que a equipe/dentistas mudam
async function sincronizarAcesso(configJson) {
  try {
    const cfg = JSON.parse(configJson);
    const emails = [EMAIL_DONO];
    for (const f of cfg.funcionarios || []) {
      if (f.email && !emails.includes(f.email)) emails.push(f.email);
    }
    await setDoc(docKV('acesso'), { emails });

    // Acesso dos dentistas ao Special Clinic (e-mail cadastrado em Dentistas)
    const colDentAcesso = collection(db, 'labs', LAB, 'dentistasAcesso');
    const atuais = await getDocs(colDentAcesso);
    const desejados = new Map();
    for (const d of cfg.dentistas || []) {
      if (d.email) desejados.set(String(d.email).toLowerCase(), d.nome);
    }
    const porEmail = new Map();
    for (const d of cfg.dentistas || []) {
      if (d.email) porEmail.set(String(d.email).toLowerCase(), d);
    }
    const batch = writeBatch(db);
    atuais.forEach(docAtual => { if (!porEmail.has(docAtual.id)) batch.delete(docAtual.ref); });
    for (const [email, d] of porEmail) {
      batch.set(doc(db, 'labs', LAB, 'dentistasAcesso', email), { nome: d.nome, prazoPagamento: d.prazoPagamento || null, diasPagamento: d.diasPagamento ?? null });
    }
    // Informações que a clínica usa: tipos completos (para criar o caso direto) e dias de trabalho (cálculo do prazo)
    batch.set(doc(db, 'labs', LAB, 'publicoClinica', 'info'), {
      tipos: (cfg.tiposTrabalho || []).map(t => ({
        nome: t.nome,
        prazoDias: t.prazoDias ?? 5,
        valor: t.valor ?? 0,
        etapas: (t.etapas || []).map(e => ({ nome: e.nome, horas: e.horas || 1, prova: !!e.prova })),
      })),
      diasTrabalho: cfg.diasTrabalho || [1, 2, 3, 4, 5, 6],
      chavePix: cfg.chavePix || null,
    });
    await batch.commit();
  } catch (e) { console.error('Erro ao sincronizar acessos', e); }
}

// ─── Notificações push (avisos com o celular bloqueado, estilo WhatsApp) ───
// Registra este aparelho: o token vai p/ o Firestore e o "carteiro" na nuvem
// (Cloud Function) envia os avisos pela Apple/Google quando algo acontece.
async function registrarPush(dados) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.addListener('registration', async (t) => {
      try {
        await setDoc(doc(db, 'labs', LAB, 'pushTokens', t.value), {
          token: t.value,
          plataforma: Capacitor.getPlatform(),
          ...dados,
          atualizadoEm: new Date().toISOString(),
        });
      } catch (e) { console.error('Erro ao salvar token push', e); }
    });
    // Tocar no aviso da barra → abre direto o trabalho (o carteiro manda o casoId junto)
    await PushNotifications.addListener('pushNotificationActionPerformed', (ev) => {
      const d = (ev && ev.notification && ev.notification.data) || {};
      const casoId = d.casoId || null;
      if (casoId) {
        window.__casoPushPendente = casoId;
        window.dispatchEvent(new CustomEvent('abrir-caso-push', { detail: casoId }));
      }
    });
    await PushNotifications.register();
  } catch (e) { console.error('Push indisponível', e); }
}

// Total pago por dentista → documento que o Special Clinic pode ler (só o próprio).
// Inclui a lista de pagamentos (data + valor) p/ o relatório mensal do dentista.
async function sincronizarFinanceiroClinica(pagamentosJson) {
  try {
    const pagamentos = JSON.parse(pagamentosJson);
    const totais = {};
    const listas = {};
    for (const p of pagamentos) {
      totais[p.dentista] = (totais[p.dentista] || 0) + (p.valor || 0);
      (listas[p.dentista] = listas[p.dentista] || []).push({ data: p.data || null, valor: p.valor || 0 });
    }
    const batch = writeBatch(db);
    for (const nome in totais) {
      const idSeguro = nome.replace(/\//g, '-');
      batch.set(doc(db, 'labs', LAB, 'financeiroClinica', idSeguro), {
        nome,
        totalPago: Math.round(totais[nome] * 100) / 100,
        pagamentos: (listas[nome] || []).slice(0, 400),
      });
    }
    await batch.commit();
  } catch (e) { console.error('Erro ao sincronizar financeiro da clínica', e); }
}

// ─── Pedidos da clínica (coleção solicitacoes) ───
let espelhoSolic = new Map();
const colSolic = () => collection(db, 'labs', LAB, 'solicitacoes');

async function lerSolicitacoes() {
  const snap = await getDocs(colSolic());
  const lista = [];
  espelhoSolic = new Map();
  snap.forEach(d => {
    const s = d.data();
    lista.push(s);
    espelhoSolic.set(d.id, JSON.stringify(s));
  });
  return lista.sort((a, b) => (a.id < b.id ? 1 : -1));
}

async function gravarSolicitacoes(lista) {
  const batch = writeBatch(db);
  const ids = new Set();
  let mudou = false;
  for (const s of lista) {
    ids.add(s.id);
    const json = JSON.stringify(s);
    if (espelhoSolic.get(s.id) !== json) { batch.set(doc(db, 'labs', LAB, 'solicitacoes', s.id), s); espelhoSolic.set(s.id, json); mudou = true; }
  }
  for (const id of [...espelhoSolic.keys()]) {
    if (!ids.has(id)) { batch.delete(doc(db, 'labs', LAB, 'solicitacoes', id)); espelhoSolic.delete(id); mudou = true; }
  }
  if (mudou) await batch.commit();
}

function instalarStorage() {
  window.storage = {
    async get(key) {
      if (key === 'usuario-ativo') {
        const v = localStorage.getItem('lab-usuario-ativo');
        return v == null ? null : { key, value: v };
      }
      if (key === 'casos-laboratorio') {
        const lista = await lerCasos();
        return { key, value: JSON.stringify(lista) };
      }
      if (key === 'solicitacoes-clinica') {
        const lista = await lerSolicitacoes();
        return { key, value: JSON.stringify(lista) };
      }
      const v = await lerKV(key);
      return v == null ? null : { key, value: v };
    },
    async set(key, value) {
      if (key === 'usuario-ativo') {
        localStorage.setItem('lab-usuario-ativo', String(value));
        return { key, value };
      }
      if (key === 'casos-laboratorio') {
        await gravarCasos(JSON.parse(value));
        return { key, value };
      }
      if (key === 'solicitacoes-clinica') {
        await gravarSolicitacoes(JSON.parse(value));
        return { key, value };
      }
      await gravarKV(key, value);
      if (key === 'config-laboratorio') sincronizarAcesso(value);
      if (key === 'pagamentos-registro') sincronizarFinanceiroClinica(value);
      return { key, value };
    },
    async delete(key) {
      if (key === 'usuario-ativo') {
        localStorage.removeItem('lab-usuario-ativo');
        return true;
      }
      await apagarKV(key);
      return true;
    },
  };
}

// ─── Telas de login / acesso (identidade visual da marca) ───
const INK = '#1C1B19';
const GOLD = '#B8935A';

function EstrelaMarca({ size = 26, color = 'white', style = {} }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="-50 -60 100 120" style={{ display: 'block', ...style }}>
      <path d="M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z" fill={color} />
    </svg>
  );
}

// Abertura = o ÍCONE do app ganhando vida: a estrela voa (estilo Disney), pousa no
// centro e cresce até virar a estrela grande do ícone; "LAB" surge embaixo. Preto + branco.
function Abertura({ visivel }) {
  if (!visivel) return null;
  const brilho = 'drop-shadow(0 0 8px rgba(255,255,255,0.7)) drop-shadow(0 0 22px rgba(255,244,220,0.5))';
  const faiscas = [
    { x: '38vw', y: '-26vh', delay: '0.28s', tam: 13 },
    { x: '22vw', y: '-20vh', delay: '0.62s', tam: 11 },
    { x: '9vw', y: '-9vh', delay: '0.96s', tam: 12 },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1C1B19', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', animation: 'abFundo 3.4s ease forwards', fontFamily: "'Manrope', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes abFundo { 0%, 85% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes abVoo {
          0% { transform: translate(calc(-50% + 62vw), calc(-50% - 20vh)) rotate(-150deg) scale(0.10); opacity: 0; }
          8% { opacity: 1; }
          30% { transform: translate(calc(-50% + 38vw), calc(-50% - 27vh)) rotate(-100deg) scale(0.2); }
          60% { transform: translate(calc(-50% + 14vw), calc(-50% - 14vh)) rotate(-45deg) scale(0.45); }
          85% { transform: translate(calc(-50% + 3vw), calc(-50% - 3vh)) rotate(-8deg) scale(0.85); }
          100% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes abPouso { 0%, 42% { opacity: 0; } 58% { opacity: 0.45; } 100% { opacity: 0; } }
        @keyframes abFaisca { 0%, 100% { opacity: 0; transform: scale(0.2) rotate(25deg); } 50% { opacity: 0.85; transform: scale(1) rotate(0deg); } }
        @keyframes abNome { 0% { opacity: 0; transform: translateY(16px); letter-spacing: 0.9em; filter: blur(5px); } 100% { opacity: 1; transform: translateY(0); letter-spacing: 0.32em; filter: blur(0); } }
      `}</style>
      {/* palco central: estrela pousa aqui e vira o ícone */}
      <div style={{ position: 'relative', width: 'min(52vw, 280px)', height: 'min(63vw, 340px)' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: '170%', aspectRatio: '1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,248,230,0.35), transparent 62%)', transform: 'translate(-50%, -50%)', animation: 'abPouso 2.6s ease both' }} />
        {faiscas.map((f, i) => (
          <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${f.x}), calc(-50% + ${f.y}))` }}>
            <div style={{ animation: `abFaisca 0.6s ease ${f.delay} both` }}>
              <EstrelaMarca size={f.tam} color="rgba(255,238,200,0.95)" />
            </div>
          </div>
        ))}
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: '100%', animation: 'abVoo 1.6s cubic-bezier(0.3, 0, 0.25, 1) both', filter: brilho }}>
          <EstrelaMarca size={26} color="#fff" style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>
      <div style={{ color: '#fff', fontSize: 'min(8vw, 42px)', fontWeight: 700, paddingLeft: '0.32em', marginTop: '10px', animation: 'abNome 0.9s ease 1.75s both' }}>LAB</div>
    </div>
  );
}

function TelaBase({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F4F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Manrope', -apple-system, sans-serif" }}>
      <div style={{ background: '#000', borderRadius: '26px', padding: '38px 28px 32px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: '0 24px 60px -24px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '13px', marginBottom: '30px' }}>
          <EstrelaMarca size={24} color="#fff" />
          <span style={{ color: '#fff', fontWeight: 300, fontSize: '25px', letterSpacing: '0.3em', paddingLeft: '0.1em' }}>SPECIAL</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function BotaoGoogle({ onClick, carregando }) {
  return (
    <button onClick={onClick} disabled={carregando}
      style={{ width: '100%', background: 'white', color: INK, border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: carregando ? 0.6 : 1 }}>
      <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
      {carregando ? 'Entrando...' : 'Entrar com Google'}
    </button>
  );
}

function ehMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function CloudRoot({ entrarNativo }) {
  const [usuario, setUsuario] = useState(undefined); // undefined = carregando
  const [acesso, setAcesso] = useState('verificando'); // verificando | ok | negado | erro
  const [entrando, setEntrando] = useState(false);
  const [appKey, setAppKey] = useState(1);
  const [abrindo, setAbrindo] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [diagnostico, setDiagnostico] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setAbrindo(false), 3450);
    return () => clearTimeout(t);
  }, []);

  // Sem acesso? Reverifica sozinho a cada 7s e sempre que o app volta ao primeiro plano —
  // assim, quando o gestor liberar o e-mail, o técnico entra na hora (sem reinstalar/reabrir)
  useEffect(() => {
    if (acesso !== 'negado') return;
    const intervalo = setInterval(() => setTentativa(t => t + 1), 7000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') setTentativa(t => t + 1); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(intervalo); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [acesso]);
  const refreshPendente = useRef(false);
  const timerRef = useRef(null);
  const prontoRef = useRef(false);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, u => setUsuario(u));
  }, []);

  // Verifica se o e-mail logado tem permissão (as regras do banco barram quem não tem)
  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    if (tentativa === 0) setAcesso('verificando'); // nas reverificações silenciosas, mantém a tela atual
    getDoc(docKV('acesso'))
      .then(() => { if (ativo) { instalarStorage(); instalarArquivos(); setAcesso('ok'); } })
      .catch(e => {
        if (!ativo) return;
        setDiagnostico(`[${e.code || 'sem-codigo'}] conta: ${usuario.email || 'sem e-mail'} | ${String(e.message || e).slice(0, 120)}`);
        if (e.code === 'permission-denied') setAcesso('negado');
        else { instalarStorage(); instalarArquivos(); setAcesso('ok'); } // offline/erro transitório — deixa o app abrir do cache
      });
    return () => { ativo = false; };
  }, [usuario, tentativa]);

  // Sincronização em tempo real: mudanças de outros aparelhos recarregam o app
  useEffect(() => {
    if (acesso !== 'ok') return;
    prontoRef.current = false;
    const agendar = () => {
      if (!prontoRef.current) return; // ignora o snapshot inicial
      refreshPendente.current = true;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const el = document.activeElement;
        const editando = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
        if (editando) { timerRef.current = setTimeout(() => agendarAgora(), 5000); return; }
        agendarAgora();
      }, 1800);
    };
    const agendarAgora = () => {
      if (!refreshPendente.current) return;
      refreshPendente.current = false;
      setAppKey(k => k + 1);
    };
    const remoto = (snap) => {
      const mudancasRemotas = snap.docChanges().some(ch => !ch.doc.metadata.hasPendingWrites);
      if (mudancasRemotas) agendar();
    };
    const un1 = onSnapshot(colCasos(), remoto);
    const un2 = onSnapshot(collection(db, 'labs', LAB, 'kv'), remoto);
    const un3 = onSnapshot(colSolic(), remoto);
    const t = setTimeout(() => { prontoRef.current = true; }, 4000);
    return () => { un1(); un2(); un3(); clearTimeout(t); clearTimeout(timerRef.current); };
  }, [acesso]);

  // Registra este aparelho p/ receber avisos push (só no app nativo; na web não faz nada)
  useEffect(() => {
    if (acesso === 'ok' && usuario) registrarPush({ tipo: 'lab', email: usuario.email || '' });
  }, [acesso, usuario]);

  const entrar = async () => {
    setEntrando(true);
    if (entrarNativo) {
      try {
        await entrarNativo(auth);
      } catch (e) {
        console.error(e);
        if (String(e).indexOf('canceled') === -1 && String(e).indexOf('cancelled') === -1) {
          alert('Não foi possível entrar. Verifique a internet e tente de novo.');
        }
      }
      setEntrando(false);
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || ehMobile()) {
        try { await signInWithRedirect(auth, provider); } catch (e2) { console.error(e2); }
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        console.error(e);
        alert('Não foi possível entrar. Verifique a internet e tente de novo.');
      }
    }
    setEntrando(false);
  };

  const abertura = <Abertura visivel={abrindo} />;

  if (usuario === undefined) {
    return <>{abertura}<TelaBase><div style={{ color: '#A8A29E', fontSize: '14px' }}>Carregando...</div></TelaBase></>;
  }

  if (!usuario) {
    const jaInstalado = entrarNativo || (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && navigator.standalone);
    return (
      <>{abertura}
      <TelaBase>
        <BotaoGoogle onClick={entrar} carregando={entrando} />
        <div style={{ color: '#78716C', fontSize: '12px', marginTop: '16px', lineHeight: 1.5 }}>
          Entre com a conta Google autorizada pelo gestor do laboratório.
        </div>
        {!jaInstalado && (
          <a href="/instalar.html" style={{ display: 'block', marginTop: '18px', color: GOLD, fontSize: '13px', fontWeight: 700, textDecoration: 'none', border: `1.5px solid ${GOLD}`, borderRadius: '12px', padding: '11px' }}>
            📲 Instalar o app no celular
          </a>
        )}
      </TelaBase>
      </>
    );
  }

  if (acesso === 'verificando') {
    return <>{abertura}<TelaBase><div style={{ color: '#A8A29E', fontSize: '14px' }}>Verificando acesso...</div></TelaBase></>;
  }

  if (acesso === 'negado') {
    return (
      <TelaBase>
        <div style={{ color: 'white', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Acesso não liberado</div>
        <div style={{ color: '#A8A29E', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
          A conta <b style={{ color: GOLD }}>{usuario.email}</b> ainda não foi autorizada.
          Peça ao gestor para cadastrar este e-mail em <b>Ajustes → Equipe</b>.
        </div>
        <button onClick={() => setTentativa(t => t + 1)} style={{ display: 'block', width: '100%', background: GOLD, color: '#1C1B19', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', marginBottom: '10px' }}>
          Verificar liberação novamente
        </button>
        <div style={{ color: '#57534E', fontSize: '11px', marginBottom: '14px' }}>
          O app também verifica sozinho a cada poucos segundos.
        </div>
        {diagnostico && (
          <div style={{ color: '#78716C', fontSize: '10px', marginBottom: '12px', wordBreak: 'break-all', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px' }}>
            código: {diagnostico}
          </div>
        )}
        <button onClick={() => signOut(auth)} style={{ background: 'transparent', color: GOLD, border: `1.5px solid ${GOLD}`, borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          Entrar com outra conta
        </button>
      </TelaBase>
    );
  }

  return (
    <>
      {abertura}
      <App key={appKey} />
    </>
  );
}

// Faixa "instalar o app" — aparece no navegador comum; some no app instalado/nativo
function BannerInstalar({ entrarNativo }) {
  const [fechado, setFechado] = useState(() => localStorage.getItem('banner-instalar-fechado') === '1');
  const instalado = entrarNativo
    || (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches)
    || (typeof navigator !== 'undefined' && navigator.standalone);
  if (instalado || fechado) return null;
  return (
    <div style={{ background: INK, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', fontFamily: "'Manrope', -apple-system, sans-serif" }}>
      <a href="/instalar.html" style={{ flex: 1, color: GOLD, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
        📲 Instalar o app neste celular — toque aqui
      </a>
      <button onClick={() => { localStorage.setItem('banner-instalar-fechado', '1'); setFechado(true); }}
        style={{ background: 'transparent', border: 'none', color: '#78716C', fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}>
        ×
      </button>
    </div>
  );
}

export function montarCloud(entrarNativo) {
  document.title = 'Lab Special';
  createRoot(document.getElementById('root')).render(<CloudRoot entrarNativo={entrarNativo || null} />);
}
