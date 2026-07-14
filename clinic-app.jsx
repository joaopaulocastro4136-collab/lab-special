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
  getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD8w3_SK27YHDFlsYpxAto3sNxCnh3tFcg',
  authDomain: 'laboratorio-special.firebaseapp.com',
  projectId: 'laboratorio-special',
  storageBucket: 'laboratorio-special.firebasestorage.app',
  messagingSenderId: '138572658603',
  appId: '1:138572658603:web:76e4649e21d8d16aa804ee',
};

const LAB = 'principal';
const TAM_CHUNK = 900000;
const INK = '#1C1B19';
const GOLD = '#B8935A';
const VERDE = '#16A34A';
const FONTE = "'Manrope', -apple-system, sans-serif";

const fbApp = initializeApp(firebaseConfig);
// No app do iPhone (esquema capacitor://) o getAuth padrão trava — usa a inicialização nativa
const ehIosNativo = typeof location !== 'undefined' && location.protocol === 'capacitor:';
const auth = ehIosNativo
  ? initializeAuth(fbApp, { persistence: indexedDBLocalPersistence })
  : getAuth(fbApp);
const db = initializeFirestore(fbApp, { localCache: persistentLocalCache() });

const docKV = (k) => doc(db, 'labs', LAB, 'kv', k);

function todayISO() { return new Date().toISOString().split('T')[0]; }
function formatDateBR(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function addDias(iso, dias) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}
function proximoDiaUtil(iso, diasTrabalho) {
  const dias = (diasTrabalho && diasTrabalho.length > 0) ? diasTrabalho : [1, 2, 3, 4, 5, 6];
  const d = new Date(iso + 'T00:00:00');
  let tentativas = 0;
  while (!dias.includes(d.getDay()) && tentativas < 7) { d.setDate(d.getDate() + 1); tentativas++; }
  return d.toISOString().split('T')[0];
}

async function lerAnexo(anexoId) {
  const snap = await getDoc(docKV('anexo-' + anexoId));
  if (!snap.exists()) return null;
  const d = snap.data();
  let bruto;
  if (d.chunks) {
    const partes = [];
    for (let i = 0; i < d.chunks; i++) {
      const p = await getDoc(docKV(`anexo-${anexoId}__c${i}`));
      partes.push(p.exists() ? p.data().v : '');
    }
    bruto = partes.join('');
  } else {
    bruto = d.v;
  }
  try { return JSON.parse(bruto); } catch (e) { return null; }
}

async function gravarAnexo(anexoId, payload) {
  const s = JSON.stringify(payload);
  if (s.length <= TAM_CHUNK) { await setDoc(docKV('anexo-' + anexoId), { v: s }); return; }
  const n = Math.ceil(s.length / TAM_CHUNK);
  for (let i = 0; i < n; i++) {
    await setDoc(docKV(`anexo-${anexoId}__c${i}`), { v: s.slice(i * TAM_CHUNK, (i + 1) * TAM_CHUNK) });
  }
  await setDoc(docKV('anexo-' + anexoId), { chunks: n });
}

const LIMITE_ARQUIVO_MB = 25;
function lerArquivoDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}
function categoriaDoArquivo(file) {
  if (file.name.toLowerCase().endsWith('.stl')) return 'stl';
  if ((file.type || '').startsWith('video')) return 'video';
  return 'documento';
}

function comprimirImagem(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagem inválida')); };
    img.src = url;
  });
}

// ─── Pix "copia e cola" (BR Code estático com valor) ───
function tlvPix(id, v) { return id + String(v.length).padStart(2, '0') + v; }
function crc16Pix(str) {
  let crc = 0xFFFF;
  for (let j = 0; j < str.length; j++) {
    crc ^= str.charCodeAt(j) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function gerarPixCopiaCola(chave, valor) {
  const conta = tlvPix('00', 'br.gov.bcb.pix') + tlvPix('01', chave);
  let p = tlvPix('00', '01') + tlvPix('26', conta) + tlvPix('52', '0000') + tlvPix('53', '986');
  if (valor > 0) p += tlvPix('54', valor.toFixed(2));
  p += tlvPix('58', 'BR') + tlvPix('59', 'LABORATORIO SPECIAL') + tlvPix('60', 'PETROLINA') + tlvPix('62', tlvPix('05', '***'));
  p += '6304';
  return p + crc16Pix(p);
}

function diasRestantes(prazo) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(prazo + 'T00:00:00') - hoje) / 86400000);
}

function Estrela({ size = 22, color = '#fff', style = {} }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="-50 -60 100 120" style={{ display: 'block', ...style }}>
      <path d="M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z" fill={color} />
    </svg>
  );
}

function Abertura({ visivel }) {
  if (!visivel) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', animation: 'abFundo 2.4s ease forwards', fontFamily: FONTE }}>
      <style>{`
        @keyframes abFundo { 0%, 78% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes abEstrela { 0% { transform: scale(0) rotate(-135deg); opacity: 0; } 55% { transform: scale(1.15) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes abLetra { 0% { opacity: 0; transform: translateY(14px); filter: blur(3px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
      `}</style>
      <div style={{ animation: 'abEstrela 1.3s cubic-bezier(0.2,0.85,0.3,1) both', marginBottom: 22 }}>
        <Estrela size={56} />
      </div>
      <div style={{ display: 'flex' }}>
        {'SPECIAL'.split('').map((l, i) => (
          <span key={i} style={{ color: '#fff', fontSize: 26, fontWeight: 300, letterSpacing: '0.3em', animation: `abLetra 0.5s ease ${0.7 + i * 0.06}s both` }}>{l}</span>
        ))}
      </div>
      <div style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: '0.5em', marginTop: 10, animation: 'abLetra 0.5s ease 1.3s both' }}>CLINIC</div>
    </div>
  );
}

function TelaBase({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F4F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: FONTE }}>
      <div style={{ background: '#000', borderRadius: 26, padding: '36px 28px 30px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 24px 60px -24px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
          <Estrela size={22} />
          <span style={{ color: '#fff', fontWeight: 300, fontSize: 23, letterSpacing: '0.28em', paddingLeft: '0.1em' }}>SPECIAL</span>
        </div>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, letterSpacing: '0.5em', marginBottom: 26 }}>CLINIC</div>
        {children}
      </div>
    </div>
  );
}

const STATUS_INFO = {
  'Em Produção': { cor: '#B54708', fundo: '#FDECD8', rotulo: 'Em produção' },
  'Acabamento': { cor: '#7C3AED', fundo: '#EDE9FE', rotulo: 'Acabamento' },
  'Pronto': { cor: '#166B3A', fundo: '#DCF3E4', rotulo: 'Pronto p/ entrega' },
  'Entregue': { cor: '#57534E', fundo: '#F0EFEC', rotulo: 'Entregue' },
};

function App({ dentista, email, prazoPagamento }) {
  const [casos, setCasos] = useState([]);
  const [totalPago, setTotalPago] = useState(0);
  const [info, setInfo] = useState({ tipos: [], diasTrabalho: [1, 2, 3, 4, 5, 6] });
  const [aba, setAba] = useState('trabalhos');
  const [detalhe, setDetalhe] = useState(null);
  const [toast, setToast] = useState(null);
  const statusAnterior = useRef({});
  const producaoAnterior = useRef({});
  // Modo computador: coluna larga e cartões em duas colunas
  const [desktop, setDesktop] = useState(typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const m = matchMedia('(min-width: 1024px)');
    const f = (e) => setDesktop(e.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);

  useEffect(() => {
    const q1 = query(collection(db, 'labs', LAB, 'casos'), where('dentista', '==', dentista));
    const un1 = onSnapshot(q1, snap => {
      const lista = [];
      snap.forEach(d => lista.push(d.data()));
      lista.sort((a, b) => (a.id < b.id ? 1 : -1));
      // Avisos ao vivo quando o laboratório muda o status
      snap.docChanges().forEach(ch => {
        if (ch.doc.metadata.hasPendingWrites) return;
        const c = ch.doc.data();
        const antes = statusAnterior.current[c.id];
        if (antes && antes !== c.status) {
          const info = STATUS_INFO[c.status];
          mostrarToast(`${c.paciente}: ${info ? info.rotulo : c.status} ${c.status === 'Pronto' ? '🎉' : ''}`);
        }
        statusAnterior.current[c.id] = c.status;
        // Aviso quando o laboratório coloca a mão na massa (inicia/conclui a 1ª etapa)
        const comecou = (c.etapas || []).some(e => e.concluida || e.inicioExec);
        if (producaoAnterior.current[c.id] === false && comecou) {
          mostrarToast(`🔨 ${c.paciente}: o laboratório começou a produção!`);
        }
        producaoAnterior.current[c.id] = comecou;
      });
      setCasos(lista);
    });
    const un2 = onSnapshot(doc(db, 'labs', LAB, 'financeiroClinica', dentista.replace(/\//g, '-')), s => {
      setTotalPago(s.exists() ? (s.data().totalPago || 0) : 0);
    }, () => {});
    getDoc(doc(db, 'labs', LAB, 'publicoClinica', 'info')).then(s => {
      if (s.exists()) {
        const d = s.data();
        // Compatibilidade: tipos podem estar como texto (formato antigo) ou objeto completo
        const tipos = (d.tipos || []).map(t => typeof t === 'string' ? { nome: t, prazoDias: 5, valor: 0, etapas: [] } : t);
        setInfo({ tipos, diasTrabalho: d.diasTrabalho || [1, 2, 3, 4, 5, 6], chavePix: d.chavePix || null });
      }
    }).catch(() => {});
    return () => { un1(); un2(); };
  }, [dentista]);

  const mostrarToast = (texto) => {
    setToast(texto);
    setTimeout(() => setToast(null), 4000);
  };

  const emAndamento = casos.filter(c => c.status === 'Em Produção' || c.status === 'Acabamento');
  const prontos = casos.filter(c => c.status === 'Pronto');
  const todasEntregas = casos.filter(c => c.status === 'Entregue');
  const entregues = todasEntregas.slice(0, 20);
  const totalEntregue = Math.round(todasEntregas.reduce((s, c) => s + (c.valor || 0), 0) * 100) / 100;
  const naoEntregues = casos.filter(c => c.status !== 'Entregue');
  const totalAndamento = Math.round(naoEntregues.reduce((s, c) => s + (c.valor || 0), 0) * 100) / 100;
  // O valor entra na conta assim que o trabalho é criado (andamento + entregues − pago)
  const saldo = Math.round((totalAndamento + totalEntregue - totalPago) * 100) / 100;
  const formatReais = (v) => 'R$ ' + (v || 0).toFixed(2).replace('.', ',');
  const copiar = async (texto, aviso) => {
    try { await navigator.clipboard.writeText(texto); mostrarToast(aviso); }
    catch (e) { mostrarToast('Não consegui copiar — copie manualmente.'); }
  };

  // Trabalhos que o dentista enviou HOJE — para avisar o laboratório pelo WhatsApp
  const enviadosHoje = casos.filter(c => c.origem === 'clinica' && c.dataEntrada === todayISO());
  const compartilharEnviados = async (baixarDireto) => {
    try {
      const img = desenharListaEnvios({ dentista, casos: enviadosHoje });
      const pdf = jpegParaPDF(img);
      const nomeArq = `trabalhos-enviados-${todayISO()}.pdf`;
      const file = new File([pdf], nomeArq, { type: 'application/pdf' });
      if (!baixarDireto && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Trabalhos enviados hoje' });
        return;
      }
      // Download direto do PDF
      const u = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = u; a.download = nomeArq;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 5000);
      if (baixarDireto) mostrarToast('PDF baixado ✓');
    } catch (e) {
      if (e && e.name === 'AbortError') return; // usuário fechou a janela de compartilhar
      console.error(e);
      mostrarToast('Não consegui gerar o PDF. Tente de novo.');
    }
  };

  const cartao = { background: '#fff', border: '1px solid #E7E5E4', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 10px 26px -20px rgba(28,27,25,0.15)' };

  const CasoCartao = ({ c }) => {
    const info = STATUS_INFO[c.status] || STATUS_INFO['Em Produção'];
    const feitas = (c.etapas || []).filter(e => e.concluida).length;
    const total = (c.etapas || []).length;
    return (
      <div style={{ ...cartao, cursor: 'pointer' }} onClick={() => setDetalhe(c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.paciente}</div>
            <div style={{ fontSize: 12, color: '#78716C', marginTop: 2 }}>{c.tipoTrabalho}{c.prazo ? ` • entrega ${formatDateBR(c.prazo)}` : ''}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: info.fundo, color: info.cor, whiteSpace: 'nowrap' }}>{info.rotulo}</span>
        </div>
        {total > 0 && c.status !== 'Entregue' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 5, borderRadius: 3, background: '#F0EFEC', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((feitas / total) * 100)}%`, background: GOLD, transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 4 }}>{feitas} de {total} etapas concluídas</div>
          </div>
        )}
      </div>
    );
  };

  const Secao = ({ titulo, cor, itens, vazio }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: cor || '#78716C', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 2px 8px' }}>{titulo}</div>
      {itens.length === 0
        ? <div style={{ fontSize: 12, color: '#A8A29E', padding: '4px 2px' }}>{vazio}</div>
        : <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: desktop ? 10 : 0 }}>{itens.map(c => <CasoCartao key={c.id} c={c} />)}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: desktop ? 'none' : 440, margin: '0 auto', minHeight: '100vh', background: '#F5F4F0', fontFamily: FONTE, paddingBottom: desktop ? 40 : 84 }}>
      {desktop ? (
        <div style={{ background: INK, height: 58, display: 'flex', alignItems: 'center', padding: '0 24px', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Estrela size={13} color={GOLD} />
            <span style={{ color: '#fff', fontWeight: 300, fontSize: 14, letterSpacing: '0.3em' }}>SPECIAL</span>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 10, letterSpacing: '0.3em' }}>CLINIC</span>
          </div>
          <div style={{ display: 'flex', height: '100%', margin: '0 auto' }}>
            {[['trabalhos', 'Meus Trabalhos'], ['novo', '＋ Novo Trabalho'], ['previsao', 'Previsão'], ['financeiro', 'Financeiro']].map(([id, rotulo]) => (
              <button key={id} onClick={() => setAba(id)}
                style={{ display: 'flex', alignItems: 'center', padding: '0 22px', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONTE, fontSize: 14, fontWeight: 700, color: aba === id ? GOLD : '#A8A29E', borderBottom: aba === id ? `2.5px solid ${GOLD}` : '2.5px solid transparent' }}>
                {rotulo}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#A8A29E', fontSize: 12, fontWeight: 700 }}>{dentista}</span>
            <button onClick={() => signOut(auth)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#A8A29E', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>sair</button>
          </div>
        </div>
      ) : (
      <div style={{ background: INK, padding: '22px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Estrela size={12} color={GOLD} />
          <span style={{ color: '#fff', fontWeight: 300, fontSize: 12, letterSpacing: '0.32em' }}>SPECIAL</span>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 10, letterSpacing: '0.3em' }}>CLINIC</span>
          <div style={{ flex: 1 }} />
          {!((typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) || (typeof navigator !== 'undefined' && navigator.standalone)) && (
            <a href="/instalar.html" title="Instalar o app" style={{ background: 'rgba(255,255,255,0.1)', color: GOLD, fontSize: 13, borderRadius: 999, padding: '6px 10px', textDecoration: 'none', marginRight: 8, lineHeight: 1 }}>⬇</a>
          )}
          <button onClick={() => signOut(auth)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#A8A29E', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 12px', cursor: 'pointer' }}>sair</button>
        </div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginTop: 10 }}>
          {aba === 'trabalhos' && 'Meus Trabalhos'}
          {aba === 'novo' && 'Novo Trabalho'}
          {aba === 'previsao' && 'Previsão de Entregas'}
          {aba === 'financeiro' && 'Financeiro'}
        </div>
        <div style={{ color: '#A8A29E', fontSize: 12, marginTop: 2 }}>{dentista}</div>
      </div>
      )}

      <div style={{ padding: desktop ? '24px 40px' : 16, maxWidth: desktop ? 1100 : 'none', margin: '0 auto' }}>
        {desktop && (
          <div style={{ fontSize: 24, fontWeight: 800, color: INK, marginBottom: 16 }}>
            {aba === 'trabalhos' && 'Meus Trabalhos'}
            {aba === 'novo' && 'Novo Trabalho'}
            {aba === 'previsao' && 'Previsão de Entregas'}
            {aba === 'financeiro' && 'Financeiro'}
          </div>
        )}
        {aba === 'trabalhos' && (
          <>
            {enviadosHoje.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => compartilharEnviados(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: INK, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONTE, boxShadow: '0 10px 24px -16px rgba(28,27,25,0.6)' }}>
                  📤 Compartilhar trabalhos de hoje ({enviadosHoje.length})
                </button>
                <button onClick={() => compartilharEnviados(true)} title="Baixar PDF"
                  style={{ width: 52, borderRadius: 14, border: '1px solid #E7E5E4', background: '#fff', color: INK, fontWeight: 800, fontSize: 20, cursor: 'pointer', fontFamily: FONTE }}>
                  ⬇
                </button>
              </div>
            )}
            <Secao titulo="Em produção" cor="#B54708" itens={emAndamento} vazio="Nenhum trabalho em produção no momento." />
            <Secao titulo="Prontos para entrega" cor="#166B3A" itens={prontos} vazio="Nada pronto aguardando entrega." />
            <Secao titulo="Entregues recentemente" itens={entregues} vazio="Nenhuma entrega registrada ainda." />
          </>
        )}
        {aba === 'novo' && (
          <NovoPedido dentista={dentista} info={info} aoEnviar={() => { setAba('trabalhos'); mostrarToast('Trabalho enviado — já está em produção! ✓'); }} />
        )}
        {aba === 'previsao' && (
          <>
            {naoEntregues.length === 0 && (
              <div style={{ ...cartao, textAlign: 'center', padding: 28 }}>
                <div style={{ fontSize: 30 }}>✨</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginTop: 6 }}>Nenhum trabalho na fila</div>
                <div style={{ fontSize: 12, color: '#A8A29E', marginTop: 2 }}>Tudo entregue! Envie um novo trabalho quando precisar.</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: desktop ? 10 : 0 }}>
            {[...naoEntregues].sort((a, b) => String(a.prazo).localeCompare(String(b.prazo))).map(c => {
              const dias = c.prazo ? diasRestantes(c.prazo) : null;
              const comecou = (c.etapas || []).some(e => e.concluida || e.inicioExec);
              let etiqueta, corE, fundoE;
              if (dias === null) { etiqueta = 'sem prazo'; corE = '#78716C'; fundoE = '#F0EFEC'; }
              else if (dias < 0) { etiqueta = `atrasado ${-dias}d`; corE = '#B42318'; fundoE = '#FCE4E4'; }
              else if (dias === 0) { etiqueta = 'sai HOJE'; corE = '#B54708'; fundoE = '#FDECD8'; }
              else if (dias === 1) { etiqueta = 'sai amanhã'; corE = '#B54708'; fundoE = '#FDECD8'; }
              else { etiqueta = `faltam ${dias} dias`; corE = '#166B3A'; fundoE = '#DCF3E4'; }
              const feitas = (c.etapas || []).filter(e => e.concluida).length;
              const total = (c.etapas || []).length;
              return (
                <div key={c.id} style={{ ...cartao, cursor: 'pointer' }} onClick={() => setDetalhe(c)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: INK }}>{c.paciente}</div>
                      <div style={{ fontSize: 12, color: '#78716C', marginTop: 2 }}>
                        {c.tipoTrabalho} • entrega prevista: <b style={{ color: INK }}>{formatDateBR(c.prazo)}</b>
                      </div>
                      <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 2 }}>
                        {c.status === 'Pronto' ? '✅ Pronto — aguardando entrega' : comecou ? `🔨 Em produção (${feitas}/${total} etapas)` : '⏳ Na fila para começar'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 999, background: fundoE, color: corE, whiteSpace: 'nowrap' }}>{etiqueta}</span>
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
        {aba === 'financeiro' && (
          <>
            <div style={{ ...cartao, background: INK, border: 'none', padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A8A29E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Saldo a pagar</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: saldo > 0 ? GOLD : '#86EFAC', marginTop: 4 }}>{formatReais(Math.max(0, saldo))}</div>
              {saldo < 0 && <div style={{ fontSize: 12, color: '#86EFAC', marginTop: 2 }}>Você tem {formatReais(-saldo)} de crédito 🎉</div>}
              {prazoPagamento && (
                <div style={{ marginTop: 12, background: 'rgba(184,147,90,0.15)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: GOLD, fontWeight: 700 }}>
                  📅 Combinado de pagamento: {prazoPagamento}
                </div>
              )}
            </div>

            {info.chavePix && saldo > 0 && (
              <div style={{ ...cartao, border: `2px solid ${VERDE}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 8 }}>💚 Pagar com Pix</div>
                <div style={{ fontSize: 12, color: '#57534E', marginBottom: 4 }}>Chave Pix do laboratório:</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: '#FAF9F7', border: '1px solid #E7E5E4', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.chavePix}</div>
                  <button onClick={() => copiar(info.chavePix, 'Chave Pix copiada ✓')} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: INK, color: GOLD, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: FONTE }}>Copiar</button>
                </div>
                <button onClick={() => copiar(gerarPixCopiaCola(info.chavePix, Math.max(0, saldo)), `Código Pix de ${formatReais(saldo)} copiado — cole no app do seu banco ✓`)}
                  style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: VERDE, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONTE }}>
                  Copiar código Pix de {formatReais(Math.max(0, saldo))} (copia e cola)
                </button>
                <div style={{ fontSize: 10.5, color: '#A8A29E', marginTop: 8, lineHeight: 1.5 }}>
                  Abra o app do seu banco → Pix → "Pix copia e cola" → cole o código — o valor já vai preenchido. Depois de pagar, o laboratório registra e seu saldo atualiza aqui.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ ...cartao, flex: 1, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#A8A29E', fontWeight: 700 }}>Em andamento</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#B54708', marginTop: 2 }}>{formatReais(totalAndamento)}</div>
              </div>
              <div style={{ ...cartao, flex: 1, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#A8A29E', fontWeight: 700 }}>Entregues</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginTop: 2 }}>{formatReais(totalEntregue)}</div>
              </div>
              <div style={{ ...cartao, flex: 1, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#A8A29E', fontWeight: 700 }}>Já pago</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: VERDE, marginTop: 2 }}>{formatReais(totalPago)}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#78716C', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '8px 2px 8px' }}>Entregas e valores</div>
            {todasEntregas.length === 0 && <div style={{ fontSize: 12, color: '#A8A29E' }}>Nenhum trabalho entregue ainda.</div>}
            {todasEntregas.slice(0, 30).map(c => (
              <div key={c.id} style={{ ...cartao, display: 'flex', alignItems: 'center', gap: 10, padding: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{c.paciente}</div>
                  <div style={{ fontSize: 11, color: '#A8A29E' }}>{c.tipoTrabalho}{c.dataSaida ? ` • ${formatDateBR(c.dataSaida)}` : ''}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c.valor > 0 ? '#166B3A' : '#A8A29E' }}>{c.valor > 0 ? formatReais(c.valor) : '—'}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 8, lineHeight: 1.5, textAlign: 'center' }}>
              Valores conforme registrado pelo Laboratório Special. Dúvidas? Fale com o laboratório.
            </div>
          </>
        )}
      </div>

      {detalhe && <DetalheCaso caso={casos.find(c => c.id === detalhe.id) || detalhe} infoLab={info} aoAvisar={mostrarToast} aoFechar={() => setDetalhe(null)} />}

      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 9000, background: INK, color: '#fff', borderRadius: 14, padding: '12px 18px', fontSize: 13, fontWeight: 700, boxShadow: '0 14px 34px rgba(0,0,0,0.35)', maxWidth: '90%', fontFamily: FONTE }}>
          {toast}
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E7E5E4', display: desktop ? 'none' : 'flex', justifyContent: 'center', gap: 8, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))' }}>
        {[['trabalhos', 'Trabalhos'], ['novo', '＋ Novo'], ['previsao', 'Previsão'], ['financeiro', 'Financeiro']].map(([id, rotulo]) => (
          <button key={id} onClick={() => setAba(id)} style={{ flex: 1, maxWidth: 150, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: FONTE, fontWeight: 800, fontSize: 13, background: aba === id ? INK : '#F0EFEC', color: aba === id ? GOLD : '#78716C' }}>
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetalheCaso({ caso, infoLab, aoAvisar, aoFechar }) {
  const [imagens, setImagens] = useState({});
  const [videoAberto, setVideoAberto] = useState(null);
  const [editando, setEditando] = useState(false);
  const semPrefixoQtd = (t) => String(t || '').replace(/^Quantidade: \d+ unidades?\. ?/, '');
  const [pacE, setPacE] = useState(caso.paciente);
  const [obsE, setObsE] = useState(semPrefixoQtd(caso.observacoes));
  // Itens do trabalho em edição (trabalhos antigos sem lista viram 1 item com o tipo atual)
  const itensDoCaso = () => ((caso.itens && caso.itens.length) ? caso.itens : [{ nome: caso.tipoTrabalho, quantidade: caso.quantidade || 1 }]).map(i => ({ nome: i.nome, quantidade: i.quantidade || 1 }));
  const [itensE, setItensE] = useState(itensDoCaso);
  const [tipoAdd, setTipoAdd] = useState('');
  const [qtdAdd, setQtdAdd] = useState(1);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fotoRef = useRef(null);
  const camRef2 = useRef(null);
  const arqRef2 = useRef(null);
  const info = STATUS_INFO[caso.status] || STATUS_INFO['Em Produção'];
  const refCaso = doc(db, 'labs', LAB, 'casos', caso.id);

  // Trocar o tipo ou excluir: só antes de o laboratório começar (senão apagaria trabalho feito)
  const producaoNaoComecou = caso.origem === 'clinica'
    && caso.status === 'Em Produção'
    && !(caso.etapas || []).some(e => e.concluida || e.inicioExec);
  // Trava de salvamento: alterou algo? Não sai sem decidir salvar ou descartar.
  const [avisoSalvar, setAvisoSalvar] = useState(false);
  const alterouAlgo = editando && (
    pacE !== caso.paciente
    || obsE !== semPrefixoQtd(caso.observacoes)
    || JSON.stringify(itensE) !== JSON.stringify(itensDoCaso())
  );
  const tentarFechar = () => {
    if (alterouAlgo) setAvisoSalvar(true);
    else aoFechar();
  };
  const tentarCancelarEdicao = () => {
    if (alterouAlgo) setAvisoSalvar(true);
    else setEditando(false);
  };

  const iniciarEdicao = () => {
    setPacE(caso.paciente);
    setObsE(semPrefixoQtd(caso.observacoes));
    setItensE(itensDoCaso());
    setTipoAdd('');
    setQtdAdd(1);
    setConfirmandoExclusao(false);
    setEditando(true);
  };

  const adicionarItemE = () => {
    if (!tipoAdd) return;
    setItensE(l => {
      const ja = l.find(i => i.nome === tipoAdd);
      if (ja) return l.map(i => i.nome === tipoAdd ? { ...i, quantidade: Math.min(32, i.quantidade + qtdAdd) } : i);
      return [...l, { nome: tipoAdd, quantidade: qtdAdd }];
    });
    setTipoAdd('');
    setQtdAdd(1);
  };

  // Valor unitário de um item: preço atual do lab ou, se o tipo sumiu dos Ajustes, o valor gravado no caso
  const unitDoItem = (nome) => {
    const t = ((infoLab && infoLab.tipos) || []).find(x => x.nome === nome);
    if (t) return t.valor || 0;
    return (((caso.itens || []).find(x => x.nome === nome)) || {}).valorUnit || 0;
  };

  const salvarEdicao = async () => {
    if (!pacE.trim()) return;
    if (itensE.length === 0) { aoAvisar && aoAvisar('O trabalho precisa de pelo menos um item.'); return; }
    setSalvando(true);
    try {
      const tipos = (infoLab && infoLab.tipos) || [];
      const itensFinal = itensE.map(i => {
        const unit = unitDoItem(i.nome);
        return { nome: i.nome, quantidade: i.quantidade, valorUnit: unit, subtotal: Math.round(unit * i.quantidade * 100) / 100 };
      });
      const umSo = itensFinal.length === 1;
      const mudouItens = JSON.stringify(itensE) !== JSON.stringify(itensDoCaso());
      const patch = {
        paciente: pacE.trim(),
        observacoes: (umSo && itensFinal[0].quantidade > 1 ? `Quantidade: ${itensFinal[0].quantidade} unidades. ` : '') + obsE.trim(),
        dataHora: new Date().toISOString(),
      };
      if (mudouItens) {
        patch.itens = itensFinal;
        patch.tipoTrabalho = umSo ? itensFinal[0].nome : rotuloItens(itensFinal);
        patch.quantidade = umSo ? itensFinal[0].quantidade : 1;
        const valorNovo = Math.round(itensFinal.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
        if (valorNovo > 0) patch.valor = valorNovo;
        // Etapas: preserva as já iniciadas/concluídas, adiciona as novas e tira as não iniciadas que sobraram
        // (cada etapa pertence a um item — casa por item + nome da etapa)
        const alvo = etapasDeItens(tipos, itensFinal.map(i => i.nome));
        const chave = (e) => `${e.item || ''}|${e.nome}`;
        const mantidas = (caso.etapas || [])
          .filter(e => e.concluida || e.inicioExec || alvo.some(a => chave(a) === chave(e)))
          .map(e => {
            const cfg = alvo.find(a => chave(a) === chave(e));
            return (cfg && !e.concluida && !e.inicioExec) ? { ...e, horas: cfg.horas, prova: cfg.prova } : e;
          });
        const novas = alvo
          .filter(a => !mantidas.some(m => chave(m) === chave(a)))
          .map(e => ({ ...e, concluida: false, dataConclusao: null, funcionario: null, duracaoMin: null, inicioExec: null }));
        patch.etapas = [...mantidas, ...novas];
        // Prazo só é recalculado enquanto a produção não começou (depois, quem ajusta é o laboratório)
        if (producaoNaoComecou) {
          const prazoDias = Math.max(...itensFinal.map(i => ((tipos.find(t => t.nome === i.nome) || {}).prazoDias) ?? 5));
          patch.prazo = proximoDiaUtil(addDias(todayISO(), prazoDias), infoLab.diasTrabalho);
        }
      }
      await updateDoc(refCaso, patch);
      setEditando(false);
      aoAvisar && aoAvisar('Alterações salvas — o laboratório já vê ✓');
    } catch (e) {
      console.error(e);
      aoAvisar && aoAvisar('Não foi possível salvar. Tente de novo.');
    }
    setSalvando(false);
  };

  const excluirTrabalho = async () => {
    setSalvando(true);
    try {
      await deleteDoc(refCaso);
      aoAvisar && aoAvisar('Trabalho excluído.');
      aoFechar();
    } catch (e) {
      console.error(e);
      aoAvisar && aoAvisar('Não foi possível excluir. Fale com o laboratório.');
      setSalvando(false);
    }
  };

  const adicionarFoto = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const dataURL = await comprimirImagem(file);
      const anexoId = novoId();
      const nome = file.name || `foto-${(caso.anexos || []).length + 1}.jpg`;
      await gravarAnexo(anexoId, { nome, mime: 'image/jpeg', dataURL });
      const novos = [...(caso.anexos || []), { id: anexoId, nome, mime: 'image/jpeg', categoria: 'foto', tamanho: Math.round(dataURL.length * 0.75) }];
      await updateDoc(refCaso, { anexos: novos, dataHora: new Date().toISOString() });
      aoAvisar && aoAvisar('Foto enviada ao laboratório ✓');
    } catch (e) {
      console.error(e);
      aoAvisar && aoAvisar('Não consegui enviar a foto. Tente de novo.');
    }
    setEnviandoFoto(false);
  };

  const adicionarArquivo = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > LIMITE_ARQUIVO_MB * 1024 * 1024) {
      aoAvisar && aoAvisar(`Arquivo muito grande (${Math.round(file.size / 1024 / 1024)} MB). Limite: ${LIMITE_ARQUIVO_MB} MB.`);
      return;
    }
    setEnviandoFoto(true);
    try {
      const dataURL = await lerArquivoDataURL(file);
      const anexoId = novoId();
      await gravarAnexo(anexoId, { nome: file.name, mime: file.type || 'application/octet-stream', dataURL });
      const novos = [...(caso.anexos || []), { id: anexoId, nome: file.name, mime: file.type || 'application/octet-stream', categoria: categoriaDoArquivo(file), tamanho: file.size }];
      await updateDoc(refCaso, { anexos: novos, dataHora: new Date().toISOString() });
      aoAvisar && aoAvisar('Arquivo enviado ao laboratório ✓');
    } catch (e) {
      console.error(e);
      aoAvisar && aoAvisar('Não consegui enviar o arquivo. Tente de novo.');
    }
    setEnviandoFoto(false);
  };

  const abrirAnexo = async (a) => {
    const ehVideo = String(a.mime || '').startsWith('video');
    if (ehVideo) {
      // Vídeo abre no reprodutor em tela cheia
      const dataURL = imagens[a.id] || (await lerAnexo(a.id) || {}).dataURL;
      if (dataURL) {
        setImagens(m => ({ ...m, [a.id]: dataURL }));
        setVideoAberto({ nome: a.nome, dataURL });
      }
      return;
    }
    if (imagens[a.id]) { setImagens(m => ({ ...m, [a.id]: null })); return; }
    const dados = await lerAnexo(a.id);
    if (dados && dados.dataURL) setImagens(m => ({ ...m, [a.id]: dados.dataURL }));
  };

  const marcos = [
    { rotulo: 'Recebido pelo laboratório', data: caso.dataEntrada, feito: true },
    { rotulo: 'Em produção', data: caso.dataProducao, feito: !!caso.dataProducao },
    { rotulo: 'Pronto para entrega', data: caso.dataFinalizado, feito: caso.status === 'Pronto' || caso.status === 'Entregue' },
    { rotulo: 'Entregue', data: caso.dataSaida, feito: caso.status === 'Entregue' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: (typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches) ? 'center' : 'flex-end', justifyContent: 'center', fontFamily: FONTE, padding: (typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches) ? 24 : 0 }} onClick={tentarFechar}>
      <div style={{ background: '#F5F4F0', borderRadius: (typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1024px)').matches) ? 22 : '22px 22px 0 0', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: '20px 18px 30px' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 44, height: 4, borderRadius: 2, background: '#D6D3D1', margin: '0 auto 16px' }} />
        {!editando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 19, color: INK }}>{caso.paciente}</div>
              <div style={{ fontSize: 13, color: '#78716C', marginTop: 2 }}>
                {caso.tipoTrabalho}{(caso.quantidade || 1) > 1 ? ` × ${caso.quantidade}` : ''}{caso.material ? ` • ${caso.material}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 999, background: info.fundo, color: info.cor }}>{info.rotulo}</span>
            <button onClick={iniciarEdicao} style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 800, color: INK, cursor: 'pointer', fontFamily: FONTE }}>✏️ Editar</button>
          </div>
        ) : (
          <div style={{ background: '#fff', border: `2px solid ${GOLD}`, borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#7A6234', marginBottom: 10 }}>✏️ EDITANDO ORDEM DE TRABALHO</div>
            <input value={pacE} onChange={e => setPacE(e.target.value)} placeholder="Nome do paciente"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid #E7E5E4', fontSize: 14, fontFamily: FONTE, outline: 'none', marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: '#A8A29E', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Itens do trabalho</div>
            {caso.origem === 'clinica' && caso.status === 'Em Produção' && (
              <select value={tipoAdd} onChange={e => setTipoAdd(e.target.value)}
                style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid #E7E5E4', fontSize: 13.5, fontFamily: FONTE, outline: 'none', marginBottom: 8, background: '#fff', color: tipoAdd ? INK : '#A8A29E' }}>
                <option value="">＋ Adicionar item...</option>
                {((infoLab && infoLab.tipos) || []).map(t => <option key={t.nome} value={t.nome}>{t.nome} ({t.prazoDias || 5} dias{t.valor > 0 ? ` • ${formatReaisG(t.valor)}` : ''})</option>)}
              </select>
            )}
            {tipoAdd && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, padding: '8px 12px', background: '#FAF9F7', borderRadius: 11 }}>
                <SeletorQtd qtd={qtdAdd} setQtd={setQtdAdd} />
                <button onClick={adicionarItemE} style={{ padding: '10px 16px', borderRadius: 11, border: 'none', background: INK, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: FONTE, flexShrink: 0 }}>＋ Adicionar</button>
              </div>
            )}
            <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 11, overflow: 'hidden', marginBottom: 8 }}>
              {itensE.map((it, idx) => {
                const unit = unitDoItem(it.nome);
                return (
                  <div key={it.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: idx > 0 ? '1px solid #F0EFEC' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{it.nome}{it.quantidade > 1 ? ` × ${it.quantidade}` : ''}</div>
                      {unit > 0 && <div style={{ fontSize: 11, color: '#A8A29E' }}>{formatReaisG(unit)} / un. • {formatReaisG(unit * it.quantidade)}</div>}
                    </div>
                    {producaoNaoComecou && (
                      <button onClick={() => setItensE(l => l.filter(x => x.nome !== it.nome))} style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid #E7E5E4', background: '#fff', color: '#A8A29E', fontWeight: 800, cursor: 'pointer', lineHeight: '24px', padding: 0 }}>×</button>
                    )}
                  </div>
                );
              })}
              {itensE.length === 0 && <div style={{ padding: '10px 12px', fontSize: 12, color: '#B42318', fontWeight: 700 }}>Adicione pelo menos um item.</div>}
            </div>
            {!producaoNaoComecou && (
              <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 8, lineHeight: 1.5 }}>A produção já começou: dá para <b>adicionar</b> itens, mas não remover. Precisa tirar algum item? Fale com o laboratório.</div>
            )}
            {(() => {
              const total = itensE.reduce((s, i) => s + unitDoItem(i.nome) * i.quantidade, 0);
              return total > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: INK, borderRadius: 11, padding: '11px 13px', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#A8A29E', fontWeight: 700 }}>VALOR TOTAL</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>{formatReaisG(total)}</span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#A8A29E', marginBottom: 10 }}>Valor a combinar com o laboratório.</div>
              );
            })()}
            <textarea value={obsE} onChange={e => setObsE(e.target.value)} placeholder="Observações..."
              style={{ width: '100%', minHeight: 70, padding: '11px 13px', borderRadius: 11, border: '1px solid #E7E5E4', fontSize: 14, fontFamily: FONTE, outline: 'none', resize: 'vertical', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={salvarEdicao} disabled={salvando} style={{ flex: 1, padding: 12, borderRadius: 11, border: 'none', background: VERDE, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: FONTE, opacity: salvando ? 0.6 : 1 }}>
                {salvando ? 'Salvando...' : '✓ Salvar alterações'}
              </button>
              <button onClick={tentarCancelarEdicao} style={{ padding: '12px 16px', borderRadius: 11, border: 'none', background: '#F0EFEC', color: '#78716C', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: FONTE }}>Cancelar</button>
            </div>
            {caso.origem === 'clinica' && caso.status === 'Em Produção' && (
              !confirmandoExclusao ? (
                <button onClick={() => setConfirmandoExclusao(true)} style={{ width: '100%', marginTop: 10, padding: 11, borderRadius: 11, border: '1px solid #FCA5A5', background: '#fff', color: '#B42318', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE }}>
                  🗑 Excluir este trabalho
                </button>
              ) : (
                <div style={{ marginTop: 10, background: '#FCE4E4', borderRadius: 11, padding: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#B42318', marginBottom: 8 }}>
                    {producaoNaoComecou
                      ? 'Tem certeza? O trabalho será removido da fila do laboratório.'
                      : '⚠️ ATENÇÃO: a produção JÁ COMEÇOU — excluir descarta o trabalho que a equipe já fez e não tem volta. Em dúvida, fale com o laboratório antes.'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={excluirTrabalho} disabled={salvando} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#B42318', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE }}>
                      Sim, excluir
                    </button>
                    <button onClick={() => setConfirmandoExclusao(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: '#fff', color: '#78716C', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE }}>
                      Não, manter
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, margin: '16px 0', border: '1px solid #E7E5E4' }}>
          {marcos.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: i < marcos.length - 1 ? 14 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: m.feito ? VERDE : '#E7E5E4', border: m.feito ? 'none' : '2px solid #D6D3D1' }} />
                {i < marcos.length - 1 && <div style={{ width: 2, height: 26, background: m.feito ? VERDE : '#E7E5E4' }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.feito ? INK : '#A8A29E' }}>{m.rotulo}</div>
                {m.data && m.feito && <div style={{ fontSize: 11, color: '#A8A29E' }}>{formatDateBR(m.data)}</div>}
              </div>
            </div>
          ))}
        </div>

        {(caso.etapas || []).length > 0 && caso.status !== 'Entregue' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #E7E5E4' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Andamento da produção</div>
            {caso.etapas.map((e, i) => {
              const mostrarItem = e.item && (caso.itens || []).length > 1 && (i === 0 || caso.etapas[i - 1].item !== e.item);
              return (
                <div key={i}>
                  {mostrarItem && (
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#7A6234', background: '#F6EEDD', borderRadius: 8, padding: '3px 8px', display: 'inline-block', margin: '6px 0 2px' }}>🦷 {e.item}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 10, background: e.concluida ? '#DCF3E4' : '#F0EFEC', color: e.concluida ? '#166B3A' : '#A8A29E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {e.concluida ? '✓' : i + 1}
                    </span>
                    <span style={{ color: e.concluida ? INK : '#78716C', fontWeight: e.concluida ? 700 : 500 }}>{e.nome}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(caso.anexos || []).length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #E7E5E4' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Arquivos e fotos</div>
            {caso.anexos.map(a => {
              const ehVideo = String(a.mime || '').startsWith('video');
              return (
                <div key={a.id} style={{ marginBottom: 8 }}>
                  <button onClick={() => abrirAnexo(a)} style={{ width: '100%', textAlign: 'left', background: '#FAF9F7', border: '1px solid #E7E5E4', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: FONTE }}>
                    {ehVideo ? '🎥' : '📎'} {a.nome} {ehVideo ? <span style={{ color: GOLD }}>▶ tocar</span> : (imagens[a.id] ? '▲' : '▼')}
                  </button>
                  {imagens[a.id] && String(a.mime || '').startsWith('image') && (
                    <img src={imagens[a.id]} alt={a.nome} style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />
                  )}
                  {imagens[a.id] && !String(a.mime || '').startsWith('image') && !ehVideo && (
                    <a href={imagens[a.id]} download={a.nome} style={{ display: 'block', marginTop: 8, fontSize: 13, color: GOLD, fontWeight: 700 }}>⬇ Baixar arquivo</a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {caso.observacoes && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #E7E5E4', fontSize: 13, color: '#57534E' }}>
            💬 {caso.observacoes}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => camRef2.current && camRef2.current.click()} disabled={enviandoFoto} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE, opacity: enviandoFoto ? 0.5 : 1 }}>
            {enviandoFoto ? 'Enviando...' : '📷 Foto'}
          </button>
          <button onClick={() => fotoRef.current && fotoRef.current.click()} disabled={enviandoFoto} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE, opacity: enviandoFoto ? 0.5 : 1 }}>
            🖼 Galeria
          </button>
          <button onClick={() => arqRef2.current && arqRef2.current.click()} disabled={enviandoFoto} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE, opacity: enviandoFoto ? 0.5 : 1 }}>
            📁 STL / Arquivo
          </button>
        </div>
        <input ref={camRef2} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={adicionarFoto} />
        <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={adicionarFoto} />
        <input ref={arqRef2} type="file" style={{ display: 'none' }} onChange={adicionarArquivo} />

        <button onClick={tentarFechar} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: INK, color: GOLD, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONTE }}>Fechar</button>

        {avisoSalvar && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 8500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#fff', borderRadius: 18, padding: 20, maxWidth: 340, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>⚠️ Você não salvou!</div>
              <div style={{ fontSize: 13, color: '#57534E', lineHeight: 1.5, marginBottom: 16 }}>
                Você fez alterações neste trabalho. Se sair agora, elas serão perdidas.
              </div>
              <button onClick={async () => { setAvisoSalvar(false); await salvarEdicao(); }} disabled={salvando}
                style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: VERDE, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONTE, marginBottom: 8 }}>
                💾 Salvar alterações
              </button>
              <button onClick={() => { setAvisoSalvar(false); setEditando(false); aoFechar(); }}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #E7E5E4', background: '#fff', color: '#B42318', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONTE, marginBottom: 8 }}>
                Sair sem salvar
              </button>
              <button onClick={() => setAvisoSalvar(false)}
                style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: '#F0EFEC', color: '#57534E', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONTE }}>
                Continuar editando
              </button>
            </div>
          </div>
        )}

        {videoAberto && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'black', display: 'flex', flexDirection: 'column' }} onClick={() => setVideoAberto(null)}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <video src={videoAberto.dataURL} controls autoPlay playsInline style={{ maxWidth: '100vw', maxHeight: '88vh' }} />
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(0,0,0,0.55)' }}>
              <span style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎥 {videoAberto.nome}</span>
              <button onClick={(e) => { e.stopPropagation(); setVideoAberto(null); }}
                style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#1C1B19', fontSize: 18, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>×</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SeletorQtd({ qtd, setQtd }) {
  const btn = { width: 40, height: 40, borderRadius: 10, border: '1px solid #E7E5E4', background: '#fff', fontSize: 19, fontWeight: 800, color: INK, cursor: 'pointer', fontFamily: FONTE };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={() => setQtd(q => Math.max(1, q - 1))} style={btn}>−</button>
      <div style={{ minWidth: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: INK }}>{qtd}</div>
        <div style={{ fontSize: 10, color: '#A8A29E', fontWeight: 700 }}>{qtd === 1 ? 'unidade' : 'unidades'}</div>
      </div>
      <button onClick={() => setQtd(q => Math.min(32, q + 1))} style={btn}>＋</button>
    </div>
  );
}

const formatReaisG = (v) => 'R$ ' + (v || 0).toFixed(2).replace('.', ',');

const etapasBaseDoTipo = (t) => (t && t.etapas && t.etapas.length > 0) ? t.etapas : [{ nome: 'Execução', horas: 2, prova: false }];
// Cada item leva as PRÓPRIAS etapas, marcadas com o nome do item (etapa.item) —
// assim o laboratório vê o tempo de cada item separado na agenda
function etapasDeItens(tipos, nomes) {
  const saida = [];
  (nomes || []).forEach(nome => {
    const t = tipos.find(t => t.nome === nome);
    etapasBaseDoTipo(t).forEach(e => saida.push({ ...e, item: nome }));
  });
  return saida;
}
const rotuloItens = (itens) => (itens || []).map(i => (i.quantidade || 1) > 1 ? `${i.nome} ×${i.quantidade}` : i.nome).join(' + ');

// ─── Compartilhar trabalhos enviados hoje (imagem → PDF → WhatsApp) ───
// Converte um JPEG (dataURL) num PDF de página única, sem bibliotecas externas
function jpegParaPDF(dataURL) {
  const base64 = dataURL.split(',')[1];
  const bin = atob(base64);
  const jpegBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) jpegBytes[i] = bin.charCodeAt(i);
  let w = 1080, h = 1400;
  for (let i = 2; i < jpegBytes.length - 9; i++) {
    if (jpegBytes[i] === 0xFF && jpegBytes[i + 1] >= 0xC0 && jpegBytes[i + 1] <= 0xC3) {
      h = (jpegBytes[i + 5] << 8) | jpegBytes[i + 6];
      w = (jpegBytes[i + 7] << 8) | jpegBytes[i + 8];
      break;
    }
  }
  const pw = 595;
  const ph = Math.round((h / w) * pw);
  const enc = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xFF; return u; };
  const contentStr = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const partes = [];
  const offsets = [];
  let pos = 0;
  const push = (dado) => { const u = typeof dado === 'string' ? enc(dado) : dado; partes.push(u); pos += u.length; };
  push('%PDF-1.4\n');
  offsets[1] = pos; push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n');
  offsets[2] = pos; push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n');
  offsets[3] = pos; push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >> endobj\n`);
  offsets[4] = pos;
  push(`4 0 obj << /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >> stream\n`);
  push(jpegBytes);
  push('\nendstream endobj\n');
  offsets[5] = pos; push(`5 0 obj << /Length ${contentStr.length} >> stream\n${contentStr}\nendstream endobj\n`);
  const xrefPos = pos;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return new Blob([out], { type: 'application/pdf' });
}

// Desenha a lista dos trabalhos enviados hoje (imagem para virar PDF)
function desenharListaEnvios({ dentista, casos }) {
  const W = 1080, PAD = 56, LINHA = 132;
  const H = 300 + casos.length * LINHA + 170;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const F = "-apple-system, 'Segoe UI', Roboto, sans-serif";
  const caber = (txt, max) => { let t = String(txt || ''); while (ctx.measureText(t).width > max && t.length > 3) t = t.slice(0, -2); return t.length === String(txt || '').length ? t : t + '…'; };
  const cartao = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  ctx.fillStyle = '#F5F4F0'; ctx.fillRect(0, 0, W, H);
  // Cabeçalho
  ctx.fillStyle = '#1C1B19'; ctx.fillRect(0, 0, W, 216);
  ctx.fillStyle = '#B8935A'; ctx.font = `800 28px ${F}`;
  ctx.fillText('SPECIAL CLINIC', PAD, 74);
  ctx.fillStyle = '#fff'; ctx.font = `800 46px ${F}`;
  ctx.fillText('Trabalhos enviados hoje', PAD, 136);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `600 26px ${F}`;
  ctx.fillText(caber(`${formatDateBR(todayISO())} • ${dentista}`, W - PAD * 2), PAD, 182);
  // Lista
  let y = 252;
  casos.forEach((c, i) => {
    ctx.fillStyle = '#fff';
    cartao(PAD, y, W - PAD * 2, LINHA - 16, 18); ctx.fill();
    ctx.strokeStyle = '#E7E5E4'; ctx.lineWidth = 2; cartao(PAD, y, W - PAD * 2, LINHA - 16, 18); ctx.stroke();
    ctx.fillStyle = '#1C1B19'; ctx.font = `800 32px ${F}`;
    ctx.fillText(caber(`${i + 1}. ${c.paciente}`, W - PAD * 4), PAD + 28, y + 48);
    ctx.fillStyle = '#78716C'; ctx.font = `600 26px ${F}`;
    ctx.fillText(caber(`${c.tipoTrabalho}${c.prazo ? ` • entrega prevista ${formatDateBR(c.prazo)}` : ''}`, W - PAD * 4), PAD + 28, y + 90);
    y += LINHA;
  });
  // Rodapé
  y += 8;
  ctx.fillStyle = '#DCF3E4';
  cartao(PAD, y, W - PAD * 2, 92, 18); ctx.fill();
  ctx.fillStyle = '#166B3A'; ctx.font = `800 28px ${F}`;
  ctx.fillText('✓ Já estão em produção — material disponível para retirada.', PAD + 28, y + 56);
  return cv.toDataURL('image/jpeg', 0.92);
}

function NovoPedido({ dentista, info, aoEnviar }) {
  const tipos = info.tipos;
  const [paciente, setPaciente] = useState('');
  const [tipo, setTipo] = useState('');
  const [qtd, setQtd] = useState(1);
  const [itens, setItens] = useState([]);
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const arqRef = useRef(null);
  const vidRef = useRef(null);

  const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E7E5E4', fontSize: 14, fontFamily: FONTE, outline: 'none', background: '#fff', boxSizing: 'border-box' };

  const addFoto = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const dataURL = await comprimirImagem(file);
      setFotos(f => [...f, { nome: file.name || `foto-${f.length + 1}.jpg`, dataURL, mime: 'image/jpeg', categoria: 'foto' }]);
    } catch (e) { setErro('Não consegui ler essa imagem. Tente outra.'); }
  };

  const addArquivo = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > LIMITE_ARQUIVO_MB * 1024 * 1024) {
      setErro(`Arquivo muito grande (${Math.round(file.size / 1024 / 1024)} MB). O limite é ${LIMITE_ARQUIVO_MB} MB.`);
      return;
    }
    try {
      const dataURL = await lerArquivoDataURL(file);
      setFotos(f => [...f, { nome: file.name, dataURL, mime: file.type || 'application/octet-stream', categoria: categoriaDoArquivo(file) }]);
    } catch (e) { setErro('Não consegui ler esse arquivo. Tente outro.'); }
  };

  const adicionarItem = () => {
    if (!tipo) return;
    setItens(lista => {
      const ja = lista.find(i => i.nome === tipo);
      if (ja) return lista.map(i => i.nome === tipo ? { ...i, quantidade: Math.min(32, i.quantidade + qtd) } : i);
      return [...lista, { nome: tipo, quantidade: qtd }];
    });
    setTipo(''); setQtd(1); setErro('');
  };
  const removerItem = (nome) => setItens(lista => lista.filter(i => i.nome !== nome));
  const valorTotal = itens.reduce((s, i) => s + ((tipos.find(t => t.nome === i.nome) || {}).valor || 0) * i.quantidade, 0);

  const enviar = async () => {
    if (!paciente.trim()) { setErro('Informe o nome do paciente.'); return; }
    if (itens.length === 0) { setErro('Adicione pelo menos um item: escolha o item e toque em "Adicionar item".'); return; }
    setEnviando(true);
    setErro('');
    try {
      const anexos = [];
      for (const f of fotos) {
        const anexoId = novoId();
        await gravarAnexo(anexoId, { nome: f.nome, mime: f.mime || 'image/jpeg', dataURL: f.dataURL });
        anexos.push({ id: anexoId, nome: f.nome, mime: f.mime || 'image/jpeg', categoria: f.categoria || 'foto', tamanho: Math.round(f.dataURL.length * 0.75) });
      }
      // Cria o caso DIRETO em produção — o laboratório já vê na fila, sem precisar aceitar
      const itensFinal = itens.map(i => {
        const t = tipos.find(t => t.nome === i.nome);
        const unit = t ? (t.valor || 0) : 0;
        return { nome: i.nome, quantidade: i.quantidade, valorUnit: unit, subtotal: Math.round(unit * i.quantidade * 100) / 100 };
      });
      const umSo = itensFinal.length === 1;
      const etapas = etapasDeItens(tipos, itensFinal.map(i => i.nome)).map(e => ({ ...e, concluida: false, dataConclusao: null, funcionario: null, duracaoMin: null, inicioExec: null }));
      const hoje = todayISO();
      // Prazo do trabalho = prazo do item mais demorado
      const prazoDias = Math.max(...itensFinal.map(i => ((tipos.find(t => t.nome === i.nome) || {}).prazoDias) ?? 5));
      const prazo = proximoDiaUtil(addDias(hoje, prazoDias), info.diasTrabalho);
      const id = novoId();
      const obsFinal = (umSo && itensFinal[0].quantidade > 1 ? `Quantidade: ${itensFinal[0].quantidade} unidades. ` : '') + obs.trim();
      await setDoc(doc(db, 'labs', LAB, 'casos', id), {
        id, paciente: paciente.trim(), dentista,
        tipoTrabalho: umSo ? itensFinal[0].nome : rotuloItens(itensFinal),
        itens: itensFinal,
        material: '', dataEntrada: hoje, prazo, observacoes: obsFinal,
        status: 'Em Produção', dataSaida: null, dataProducao: hoje, dataFinalizado: null,
        anexos, etapas, naClinica: false, provaPendente: false,
        quantidade: umSo ? itensFinal[0].quantidade : 1,
        valor: Math.round(itensFinal.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
        origem: 'clinica', dataHora: new Date().toISOString(),
      });
      setPaciente(''); setTipo(''); setQtd(1); setItens([]); setObs(''); setFotos([]);
      aoEnviar();
    } catch (e) {
      console.error(e);
      setErro('Não foi possível enviar. Verifique a internet e tente de novo.');
    }
    setEnviando(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input style={inputStyle} value={paciente} onChange={e => { setPaciente(e.target.value); setErro(''); }} placeholder="Nome do paciente *" />
        <select style={{ ...inputStyle, color: tipo ? INK : '#A8A29E' }} value={tipo} onChange={e => { setTipo(e.target.value); setErro(''); }}>
          <option value="">{itens.length > 0 ? 'Adicionar outro item...' : 'Escolha o item *'}</option>
          {tipos.map(t => <option key={t.nome} value={t.nome}>{t.nome} ({t.prazoDias || 5} dias{t.valor > 0 ? ` • ${formatReaisG(t.valor)}` : ''})</option>)}
        </select>
        {tipo && (
          <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#A8A29E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quantidade</div>
              {(() => {
                const t = tipos.find(x => x.nome === tipo);
                const unit = t ? (t.valor || 0) : 0;
                return unit > 0
                  ? <div style={{ fontSize: 12, color: '#78716C', marginTop: 3 }}>{formatReaisG(unit)} por unidade</div>
                  : <div style={{ fontSize: 12, color: '#A8A29E', marginTop: 3 }}>valor a combinar</div>;
              })()}
            </div>
            <SeletorQtd qtd={qtd} setQtd={setQtd} />
          </div>
        )}
        {tipo && (
          <button onClick={adicionarItem} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: INK, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: FONTE }}>＋ Adicionar item</button>
        )}
        {itens.length === 0 && !tipo && (
          <div style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5 }}>Escolha o item, ajuste a quantidade e toque em <b>Adicionar item</b>. Pode adicionar vários itens no mesmo trabalho (ex.: coroa unitária + provisório).</div>
        )}
        {itens.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E7E5E4', borderRadius: 12, overflow: 'hidden' }}>
            {itens.map((it, idx) => {
              const t = tipos.find(x => x.nome === it.nome);
              const unit = t ? (t.valor || 0) : 0;
              return (
                <div key={it.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderTop: idx > 0 ? '1px solid #F0EFEC' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{it.nome}{it.quantidade > 1 ? ` × ${it.quantidade}` : ''}</div>
                    <div style={{ fontSize: 11.5, color: '#A8A29E' }}>{t ? `${t.prazoDias || 5} dias` : ''}{unit > 0 ? ` • ${formatReaisG(unit)} / un.` : ' • valor a combinar'}</div>
                  </div>
                  {unit > 0 && <div style={{ fontSize: 13.5, fontWeight: 800, color: VERDE }}>{formatReaisG(unit * it.quantidade)}</div>}
                  <button onClick={() => removerItem(it.nome)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E7E5E4', background: '#fff', color: '#A8A29E', fontWeight: 800, cursor: 'pointer', lineHeight: '26px', padding: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
        {valorTotal > 0 && (
          <div style={{ background: INK, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#A8A29E', fontWeight: 700 }}>VALOR TOTAL DO SERVIÇO</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: GOLD }}>{formatReaisG(valorTotal)}</span>
          </div>
        )}
        <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações: cor, dente(s), instruções..." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <button onClick={() => camRef.current && camRef.current.click()} style={{ padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE }}>📷 Foto</button>
        <button onClick={() => vidRef.current && vidRef.current.click()} style={{ padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE }}>🎥 Gravar vídeo</button>
        <button onClick={() => fileRef.current && fileRef.current.click()} style={{ padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE }}>🖼 Galeria</button>
        <button onClick={() => arqRef.current && arqRef.current.click()} style={{ padding: 12, borderRadius: 12, border: '1.5px dashed #D6D3D1', background: '#fff', fontSize: 13, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE }}>📁 STL / Arquivo</button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={addFoto} />
      <input ref={vidRef} type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={addArquivo} />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={addFoto} />
      <input ref={arqRef} type="file" style={{ display: 'none' }} onChange={addArquivo} />

      {fotos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {fotos.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {String(f.mime || '').startsWith('image') ? (
                <img src={f.dataURL} alt={f.nome} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12, border: '1px solid #E7E5E4' }} />
              ) : (
                <div style={{ width: 84, height: 84, borderRadius: 12, border: '1px solid #E7E5E4', background: '#FAF9F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 }}>
                  <span style={{ fontSize: 22 }}>{f.categoria === 'video' ? '🎥' : f.categoria === 'stl' ? '🦷' : '📄'}</span>
                  <span style={{ fontSize: 9, color: '#78716C', fontWeight: 700, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>{f.nome}</span>
                </div>
              )}
              <button onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 'none', background: INK, color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: '22px', padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {erro && <div style={{ color: '#B42318', fontSize: 12, fontWeight: 700, marginTop: 12 }}>{erro}</div>}

      <button onClick={enviar} disabled={enviando} style={{ width: '100%', marginTop: 16, padding: 15, borderRadius: 14, border: 'none', background: enviando ? '#A8A29E' : VERDE, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: FONTE }}>
        {enviando ? 'Enviando...' : 'Enviar para produção'}
      </button>
      <div style={{ fontSize: 11, color: '#A8A29E', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>
        O trabalho entra direto na fila de produção do laboratório, com prazo calculado automaticamente — e você acompanha cada etapa por aqui.
      </div>
    </div>
  );
}

function ehMobile() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); }

function Raiz() {
  const [usuario, setUsuario] = useState(undefined);
  const [estado, setEstado] = useState('verificando'); // verificando | ok | negado
  const [nomeDentista, setNomeDentista] = useState('');
  const [prazoPag, setPrazoPag] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [abrindo, setAbrindo] = useState(true);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAbrindo(false), 2450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, u => setUsuario(u));
  }, []);

  useEffect(() => {
    if (!usuario || !usuario.email) return;
    let ativo = true;
    getDoc(doc(db, 'labs', LAB, 'dentistasAcesso', usuario.email.toLowerCase()))
      .then(s => {
        if (!ativo) return;
        if (s.exists()) { setNomeDentista(s.data().nome); setPrazoPag(s.data().prazoPagamento || ''); setEstado('ok'); }
        else setEstado('negado');
      })
      .catch(() => { if (ativo) setEstado('negado'); });
    return () => { ativo = false; };
  }, [usuario, tentativa]);

  useEffect(() => {
    if (estado !== 'negado') return;
    const i = setInterval(() => setTentativa(t => t + 1), 7000);
    return () => clearInterval(i);
  }, [estado]);

  const entrar = async () => {
    setEntrando(true);
    // No app nativo (iPhone), o login usa a tela de contas do próprio aparelho
    if (window.__entrarNativo) {
      try { await window.__entrarNativo(auth); } catch (e) { console.error(e); }
      setEntrando(false);
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || ehMobile()) {
        try { await signInWithRedirect(auth, provider); } catch (e2) { console.error(e2); }
      }
    }
    setEntrando(false);
  };

  const abertura = <Abertura visivel={abrindo} />;

  if (usuario === undefined) return <>{abertura}<TelaBase><div style={{ color: '#A8A29E', fontSize: 14 }}>Carregando...</div></TelaBase></>;

  if (!usuario) {
    return (
      <>{abertura}
      <TelaBase>
        <button onClick={entrar} disabled={entrando} style={{ width: '100%', background: '#fff', color: INK, border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: entrando ? 0.6 : 1, fontFamily: FONTE }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
          {entrando ? 'Entrando...' : 'Entrar com Google'}
        </button>
        <div style={{ color: '#78716C', fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
          Acompanhe seus trabalhos no Laboratório Special e faça pedidos direto do consultório.
        </div>
      </TelaBase>
      </>
    );
  }

  if (estado === 'verificando') return <>{abertura}<TelaBase><div style={{ color: '#A8A29E', fontSize: 14 }}>Verificando acesso...</div></TelaBase></>;

  if (estado === 'negado') {
    return (
      <TelaBase>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Acesso não liberado</div>
        <div style={{ color: '#A8A29E', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          A conta <b style={{ color: GOLD }}>{usuario.email}</b> ainda não foi cadastrada.
          Peça ao <b>Laboratório Special</b> para cadastrar este e-mail no seu registro de dentista.
        </div>
        <button onClick={() => setTentativa(t => t + 1)} style={{ display: 'block', width: '100%', background: GOLD, color: INK, border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 10, fontFamily: FONTE }}>
          Verificar novamente
        </button>
        <button onClick={() => signOut(auth)} style={{ background: 'transparent', color: GOLD, border: `1.5px solid ${GOLD}`, borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONTE }}>
          Entrar com outra conta
        </button>
      </TelaBase>
    );
  }

  return <>{abertura}<App dentista={nomeDentista} email={usuario.email} prazoPagamento={prazoPag} /></>;
}

document.title = 'Special Clinic';
createRoot(document.getElementById('root')).render(<Raiz />);
