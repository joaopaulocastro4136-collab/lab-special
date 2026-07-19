// ─── IA Special no Special Lab ───
// A mesma IA do Special Clinic (transformação de sorriso + chat de perguntas),
// agora na tela principal do laboratório. Fala com a nuvem pelas pontes
// window.iaNuvem (Cloud Functions/Firestore) e window.arquivos (Storage),
// instaladas pelo cloud-app.jsx — este módulo não importa Firebase.
import { useState, useEffect, useRef } from 'react';
import { Camera, Send, Sparkles, MessageCircle, Share2, Download, Maximize2 } from 'lucide-react';

const INK = '#1C1B19';
const GOLD = '#B8935A';
const FONTE = "'Manrope', -apple-system, sans-serif";

function Estrela({ size = 22, color = '#fff', style = {} }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="-50 -60 100 120" style={{ display: 'block', ...style }}>
      <path d="M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z" fill={color} />
    </svg>
  );
}

function todayISO() { return new Date().toISOString().split('T')[0]; }
function formatDateBR(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function dataURLparaBlob(dataURL, mime) {
  const b64 = dataURL.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function comprimirImagem(file, MAX = 1280, qualidade = 0.8) {
  return new Promise((res, rej) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagem inválida')); };
    img.src = url;
  });
}

// Toastzinho próprio dos overlays da IA (o Lab não tem sistema de toast global)
function useAviso() {
  const [aviso, setAviso] = useState(null);
  const ref = useRef(null);
  const mostrar = (t) => {
    setAviso(t);
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => setAviso(null), 2800);
  };
  const elemento = aviso ? (
    <div style={{ position: 'fixed', top: 'calc(14px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', zIndex: 9900, background: INK, color: '#fff', borderRadius: 14, padding: '12px 18px', fontSize: 13, fontWeight: 700, boxShadow: '0 14px 34px rgba(0,0,0,0.45)', maxWidth: '90%', fontFamily: FONTE }}>
      {aviso}
    </div>
  ) : null;
  return [mostrar, elemento];
}

const TONS_IA = [
  { rotulo: 'BL', valor: 'bl', cor: '#FDFDFC', desc: 'super branco — clareamento máximo (Hollywood)' },
  { rotulo: 'B1', valor: 'b1', cor: '#F5F0E2', desc: 'branco natural, luminoso e crível' },
  { rotulo: 'A1', valor: 'a1', cor: '#EFE3C9', desc: 'natural clássico, levemente quente' },
  { rotulo: 'A2', valor: 'a2', cor: '#E3D0A6', desc: 'mais amarelado — tom natural sem clareamento' },
];
function rotuloTom(v) {
  const t = TONS_IA.find(x => x.valor === v);
  if (t) return t.rotulo;
  return { claro: 'Mais claro', natural: 'Natural', escuro: 'Mais escuro' }[v] || v || 'A1';
}

function mensagemErroIA(e) {
  const codigo = String((e && e.code) || '');
  if (codigo.includes('resource-exhausted')) return 'A IA atingiu o limite de agora. Tente de novo em alguns minutos.';
  if (codigo.includes('unauthenticated')) return 'Entre na sua conta para usar a IA Special.';
  if (codigo.includes('not-found') || codigo.includes('unimplemented') || codigo.includes('failed-precondition')) return 'A IA Special está sendo ativada. Tente mais tarde.';
  if (codigo.includes('invalid-argument')) return 'Essa foto não serviu. Tente uma foto mais nítida do sorriso.';
  return 'Não consegui agora. Verifique a internet e tente de novo.';
}

// Comparador antes/depois: arrasta o dedo (ou o mouse) em qualquer ponto da foto
function ComparadorImagens({ antes, depois, corte, setCorte }) {
  const mover = (clientX, el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) setCorte(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div style={{ position: 'relative', touchAction: 'none', cursor: 'ew-resize', userSelect: 'none' }}
      onTouchStart={e => mover(e.touches[0].clientX, e.currentTarget)}
      onTouchMove={e => mover(e.touches[0].clientX, e.currentTarget)}
      onMouseDown={e => mover(e.clientX, e.currentTarget)}
      onMouseMove={e => { if (e.buttons === 1) mover(e.clientX, e.currentTarget); }}>
      <img src={depois} alt="Depois" draggable={false} style={{ display: 'block', width: '100%', pointerEvents: 'none' }} />
      <img src={antes} alt="Antes" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 ${100 - corte}% 0 0)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${corte}%`, width: 2.5, background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.6)', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 34, height: 34, borderRadius: 17, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: INK, boxShadow: '0 6px 16px rgba(0,0,0,0.45)' }}>⇄</div>
      </div>
      <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: '4px 10px', pointerEvents: 'none' }}>ANTES</span>
      <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: INK, background: GOLD, borderRadius: 999, padding: '4px 10px', pointerEvents: 'none' }}>DEPOIS ✨</span>
    </div>
  );
}

// Comparador em TELA CHEIA: arrasta pra alternar, botões Antes | ⇄ | Depois, pinça pra zoom
function ComparadorTelaCheia({ antes, depois, nome, aoFechar }) {
  const [corte, setCorte] = useState(50);
  const [escala, setEscala] = useState(1);
  const [arrastando, setArrastando] = useState(false);
  const gesto = useRef({});
  const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const mover = (clientX, el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) setCorte(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const aoIniciar = (e) => {
    setArrastando(true);
    if (e.touches.length === 2) gesto.current = { modo: 'pinca', d0: dist(e.touches), esc0: escala };
    else { gesto.current = { modo: 'corte' }; mover(e.touches[0].clientX, e.currentTarget); }
  };
  const aoMover = (e) => {
    if (gesto.current.modo === 'pinca' && e.touches.length === 2) {
      setEscala(Math.max(1, Math.min(4, gesto.current.esc0 * (dist(e.touches) / gesto.current.d0))));
    } else if (gesto.current.modo === 'corte' && e.touches.length === 1) {
      mover(e.touches[0].clientX, e.currentTarget);
    }
  };
  const btnRodape = (ativo) => ({ flex: 1, maxWidth: 150, padding: '12px 0', borderRadius: 13, fontFamily: FONTE, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: ativo ? `1.5px solid ${GOLD}` : '1px solid rgba(255,255,255,0.18)', background: ativo ? 'rgba(184,147,90,0.2)' : 'rgba(255,255,255,0.07)', color: ativo ? GOLD : 'rgba(255,255,255,0.85)' });
  const trans = arrastando ? 'none' : 'clip-path 0.3s ease, left 0.3s ease';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9600, background: '#0D0C0B', display: 'flex', flexDirection: 'column', fontFamily: FONTE }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(10px + env(safe-area-inset-top)) 12px 10px' }}>
        <Estrela size={11} color={GOLD} />
        <span style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
        <button onClick={aoFechar} style={{ width: 38, height: 38, borderRadius: 19, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(30,28,25,0.85)', color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>×</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', cursor: 'ew-resize' }}
        onTouchStart={aoIniciar} onTouchMove={aoMover} onTouchEnd={() => { setArrastando(false); gesto.current = {}; }}
        onMouseDown={e => { setArrastando(true); mover(e.clientX, e.currentTarget); }}
        onMouseMove={e => { if (e.buttons === 1) mover(e.clientX, e.currentTarget); }}
        onMouseUp={() => setArrastando(false)}
        onWheel={e => setEscala(v => Math.max(1, Math.min(4, v - e.deltaY / 400)))}
        onDoubleClick={() => setEscala(1)}>
        <div style={{ position: 'relative', transform: `scale(${escala})`, transition: arrastando ? 'none' : 'transform 0.18s ease' }}>
          <img src={depois} alt="Depois" draggable={false} style={{ display: 'block', maxWidth: '100vw', maxHeight: 'calc(100vh - 190px)', pointerEvents: 'none', userSelect: 'none' }} />
          <img src={antes} alt="Antes" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', clipPath: `inset(0 ${100 - corte}% 0 0)`, transition: trans, pointerEvents: 'none', userSelect: 'none' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${corte}%`, width: 2.5, background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.7)', transform: 'translateX(-50%)', transition: trans, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 34, height: 34, borderRadius: 17, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: INK, boxShadow: '0 6px 16px rgba(0,0,0,0.5)' }}>⇄</div>
          </div>
          <span style={{ position: 'absolute', top: 10, left: 10, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: '#fff', background: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: '4px 10px', pointerEvents: 'none' }}>ANTES</span>
          <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: INK, background: GOLD, borderRadius: 999, padding: '4px 10px', pointerEvents: 'none' }}>DEPOIS ✨</span>
        </div>
      </div>
      <div style={{ padding: '10px 14px calc(14px + env(safe-area-inset-bottom))' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 9 }}>arraste sobre a foto • pinça para zoom • toque duplo volta o zoom</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => setCorte(100)} style={btnRodape(corte > 85)}>Antes</button>
          <button onClick={() => setCorte(50)} style={{ ...btnRodape(corte >= 15 && corte <= 85), maxWidth: 70 }}>⇄</button>
          <button onClick={() => setCorte(0)} style={btnRodape(corte < 15)}>Depois ✨</button>
        </div>
      </div>
    </div>
  );
}

// Cartão "antes e depois" pro WhatsApp (mesma arte do Clinic)
function carregarImg(src) {
  return new Promise((res, rej) => {
    const im = new window.Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('não carregou a imagem'));
    im.src = src;
  });
}

async function gerarCartaoAntesDepois(antesSrc, depoisSrc, paciente) {
  const [a, d] = await Promise.all([carregarImg(antesSrc), carregarImg(depoisSrc)]);
  const W = 1080, HIMG = 850, RODAPE = 140, H = HIMG + RODAPE;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#141311'; x.fillRect(0, 0, W, H);
  const cover = (img, dx, dw) => {
    const r = Math.max(dw / img.width, HIMG / img.height);
    const sw = dw / r, sh = HIMG / r;
    x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, 0, dw, HIMG);
  };
  x.save(); x.beginPath(); x.rect(0, 0, W / 2, HIMG); x.clip(); cover(a, 0, W / 2); x.restore();
  x.save(); x.beginPath(); x.rect(W / 2, 0, W / 2, HIMG); x.clip(); cover(d, W / 2, W / 2); x.restore();
  const grad = x.createLinearGradient(0, 0, 0, HIMG);
  grad.addColorStop(0, '#E8C48A'); grad.addColorStop(1, '#B8935A');
  x.fillStyle = grad; x.fillRect(W / 2 - 3, 0, 6, HIMG);
  const etiqueta = (texto, cx, dourada) => {
    x.font = '800 34px Manrope, -apple-system, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const tw = x.measureText(texto).width;
    const pw = tw + 48, ph = 58, py = 26;
    x.fillStyle = dourada ? '#B8935A' : 'rgba(0,0,0,0.62)';
    x.beginPath();
    if (x.roundRect) x.roundRect(cx - pw / 2, py, pw, ph, 29); else x.rect(cx - pw / 2, py, pw, ph);
    x.fill();
    x.fillStyle = dourada ? '#1C1B19' : '#FFFFFF';
    x.fillText(texto, cx, py + ph / 2 + 2);
  };
  etiqueta('ANTES', W / 4, false);
  etiqueta('DEPOIS ✨', (3 * W) / 4, true);
  const yR = HIMG + RODAPE / 2;
  x.save();
  x.translate(64, yR);
  x.scale(0.62, 0.62);
  x.fillStyle = '#B8935A';
  const estrela = new Path2D('M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z');
  x.fill(estrela);
  x.restore();
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.font = '300 40px Manrope, -apple-system, sans-serif';
  x.fillStyle = '#FFFFFF';
  x.fillText('S P E C I A L', 108, yR - 16);
  x.font = '700 24px Manrope, -apple-system, sans-serif';
  x.fillStyle = '#B8935A';
  x.fillText('IA SPECIAL — simulação de sorriso', 108, yR + 26);
  if (paciente) {
    x.textAlign = 'right';
    x.font = '800 30px Manrope, -apple-system, sans-serif';
    x.fillStyle = '#FFFFFF';
    x.fillText(paciente, W - 44, yR - 14);
    x.font = '600 22px Manrope, -apple-system, sans-serif';
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fillText(formatDateBR(todayISO()), W - 44, yR + 22);
  }
  return c.toDataURL('image/jpeg', 0.92);
}

async function compartilharAntesDepois(antesSrc, depoisSrc, paciente, aoAvisar) {
  try {
    const dataURL = await gerarCartaoAntesDepois(antesSrc, depoisSrc, paciente);
    const blob = dataURLparaBlob(dataURL, 'image/jpeg');
    const nome = `antes-depois-${String(paciente || 'sorriso').replace(/\s+/g, '-').toLowerCase()}.jpg`;
    const file = new File([blob], nome, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Antes e depois — ${paciente}` });
      return;
    }
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob); el.download = nome;
    document.body.appendChild(el); el.click(); document.body.removeChild(el);
    if (aoAvisar) aoAvisar('Antes e depois salvo ✓');
  } catch (e) {
    console.error('cartão antes/depois', e);
    if (e && e.name !== 'AbortError' && aoAvisar) aoAvisar('Não consegui montar o antes e depois. Tente de novo.');
  }
}

// ─── IA Special (transformação de sorriso) — versão do laboratório ───
export function IASpecialLab({ aoFechar }) {
  const [foto, setFoto] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [tom, setTom] = useState('a1');
  const [corte, setCorte] = useState(50);
  const [paciente, setPaciente] = useState('');
  const [historico, setHistorico] = useState(null);
  const [verSim, setVerSim] = useState(null);
  const [compararCheia, setCompararCheia] = useState(null);
  const inputRef = useRef(null);
  const [aoAvisar, toastEl] = useAviso();

  // Histórico do laboratório: transformações feitas por aqui ficam salvas na nuvem
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await window.iaNuvem.listarSimulacoes();
        if (ativo) setHistorico(lista);
      } catch (e) { console.error('histórico IA', e); if (ativo) setHistorico([]); }
    })();
    return () => { ativo = false; };
  }, []);

  const salvarSimulacao = async (antesDataURL, depoisDataURL, tomUsado) => {
    try {
      const nome = paciente.trim() || 'Paciente';
      const [antesUp, depoisUp] = await Promise.all([
        window.arquivos.subir(dataURLparaBlob(antesDataURL, 'image/jpeg'), `ia-antes-${novoId()}.jpg`),
        window.arquivos.subir(dataURLparaBlob(depoisDataURL, depoisDataURL.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'), `ia-depois-${novoId()}.jpg`),
      ]);
      const sim = {
        id: novoId(), dentista: 'Laboratório Special', paciente: nome, tom: tomUsado, data: todayISO(),
        antesUrl: antesUp.url, antesCaminho: antesUp.caminho,
        depoisUrl: depoisUp.url, depoisCaminho: depoisUp.caminho,
      };
      await window.iaNuvem.salvarSimulacao(sim);
      setHistorico(h => [sim, ...(h || [])].slice(0, 40));
      aoAvisar('Transformação salva no histórico ✓');
    } catch (e) { console.error('salvar simulação', e); }
  };

  const escolherFoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataURL = await comprimirImagem(file);
      setVerSim(null);
      setFoto(dataURL);
      setResultado(null);
      setCorte(50);
    } catch (err) { aoAvisar('Não consegui ler essa foto. Tente outra.'); }
  };

  const gerar = async (tomNovo) => {
    if (!foto || processando) return;
    const alvo = tomNovo ?? tom;
    setTom(alvo);
    setProcessando(true);
    try {
      const out = await window.iaNuvem.transformar(foto, alvo);
      setResultado(out);
      setCorte(50);
      salvarSimulacao(foto, out, alvo);
    } catch (e) {
      console.error('IA Special', e);
      aoAvisar(mensagemErroIA(e));
    }
    setProcessando(false);
  };

  const compartilhar = () => compartilharAntesDepois(foto, resultado, paciente.trim() || 'Paciente', aoAvisar);
  const baixar = async () => {
    try {
      const dataURL = await gerarCartaoAntesDepois(foto, resultado, paciente.trim() || 'Paciente');
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `antes-depois-${todayISO()}.jpg`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      aoAvisar('Antes e depois salvo ✓');
    } catch (e) { aoAvisar('Não consegui montar o antes e depois.'); }
  };

  const btnDourado = { border: 'none', borderRadius: 14, background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, fontWeight: 800, fontFamily: FONTE, cursor: 'pointer', boxShadow: '0 12px 26px -14px rgba(184,147,90,0.9)' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8900, background: '#141311', overflowY: 'auto', fontFamily: FONTE }}>
      {toastEl}
      <style>{`
        @keyframes iaPulso { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.18); opacity: 1; } }
        @keyframes iaVarredura { 0% { top: -8%; } 50% { top: 100%; } 100% { top: -8%; } }
        @keyframes iaSurgir { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px calc(28px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top)) 0 14px' }}>
          <button onClick={aoFechar} style={{ width: 38, height: 38, borderRadius: 19, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 17, cursor: 'pointer', flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color={GOLD} />
              <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>IA Special</span>
              <span style={{ fontSize: 8.5, fontWeight: 800, color: INK, background: GOLD, borderRadius: 999, padding: '2.5px 7px', letterSpacing: '0.08em' }}>LAB</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>Transformação de sorriso com IA</div>
          </div>
        </div>

        {!foto && !verSim && (
          <div style={{ animation: 'iaSurgir 0.35s ease both' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '2px 2px 7px' }}>Nova transformação</div>
            <input value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nome do paciente"
              style={{ width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14.5, fontWeight: 700, fontFamily: FONTE, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <button onClick={() => inputRef.current && inputRef.current.click()}
              style={{ width: '100%', borderRadius: 20, border: '1.5px dashed rgba(184,147,90,0.6)', background: 'rgba(184,147,90,0.07)', padding: '28px 20px', cursor: 'pointer', fontFamily: FONTE, textAlign: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: 29, background: 'linear-gradient(135deg, #E8C48A, #B8935A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 14px 30px -12px rgba(184,147,90,0.8)' }}>
                <Camera size={25} color={INK} />
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', marginTop: 13 }}>Adicionar foto do sorriso</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 5, lineHeight: 1.5 }}>Tire uma foto ou escolha da galeria — quanto mais nítida, melhor.</div>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '20px 2px 9px' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Histórico</span>
              {historico && historico.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: GOLD, background: 'rgba(184,147,90,0.18)', borderRadius: 999, padding: '2px 8px' }}>{historico.length}</span>
              )}
            </div>
            {historico === null && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: '8px 2px' }}>Carregando histórico...</div>
            )}
            {historico && historico.length === 0 && (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 14px', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                As transformações feitas aqui no laboratório aparecem aqui. Coloque o nome do paciente, adicione a foto e transforme. ✨
              </div>
            )}
            {historico && historico.map(s => (
              <button key={s.id} onClick={() => { setCorte(50); setVerSim(s); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: 9, marginBottom: 8, cursor: 'pointer', fontFamily: FONTE, textAlign: 'left' }}>
                <img src={s.depoisUrl} alt={s.paciente} style={{ width: 52, height: 52, borderRadius: 11, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(184,147,90,0.4)' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.paciente}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {formatDateBR(s.data)} • cor {rotuloTom(s.tom)}
                  </span>
                </span>
                <span style={{ color: GOLD, fontSize: 18, flexShrink: 0, fontWeight: 300 }}>›</span>
              </button>
            ))}
          </div>
        )}

        {verSim && (
          <div style={{ animation: 'iaSurgir 0.35s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <button onClick={() => setVerSim(null)} style={{ width: 34, height: 34, borderRadius: 17, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 15, cursor: 'pointer', flexShrink: 0 }}>‹</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{verSim.paciente}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{formatDateBR(verSim.data)} • cor {rotuloTom(verSim.tom)}</div>
              </div>
            </div>
            <div style={{ borderRadius: 20, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 22px 50px -22px rgba(0,0,0,0.8)' }}>
              <ComparadorImagens antes={verSim.antesUrl} depois={verSim.depoisUrl} corte={corte} setCorte={setCorte} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 10 }}>Arraste sobre a foto para comparar o antes e depois</div>
            <button onClick={() => setCompararCheia({ antes: verSim.antesUrl, depois: verSim.depoisUrl, nome: verSim.paciente })}
              style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(184,147,90,0.5)', background: 'rgba(184,147,90,0.12)', color: GOLD, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Maximize2 size={14} color={GOLD} /> Ver em tela cheia
            </button>
            <button onClick={() => compartilharAntesDepois(verSim.antesUrl, verSim.depoisUrl, verSim.paciente, aoAvisar)}
              style={{ ...btnDourado, width: '100%', marginTop: 12, padding: 15, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Share2 size={16} /> Compartilhar antes e depois
            </button>
          </div>
        )}

        {foto && !verSim && (
          <div style={{ animation: 'iaSurgir 0.35s ease both' }}>
            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 22px 50px -22px rgba(0,0,0,0.8)' }}>
              {!resultado && <img src={foto} alt="Sorriso" style={{ display: 'block', width: '100%' }} />}
              {resultado && <ComparadorImagens antes={foto} depois={resultado} corte={corte} setCorte={setCorte} />}
              {processando && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,14,12,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, animation: 'iaVarredura 2.2s ease-in-out infinite', boxShadow: `0 0 18px ${GOLD}` }} />
                  <div style={{ animation: 'iaPulso 1.3s ease-in-out infinite' }}><Estrela size={30} color={GOLD} /></div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', marginTop: 14 }}>IA Special redesenhando o sorriso...</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>alinhando forma, simetria e cor — leva alguns segundos</div>
                </div>
              )}
            </div>

            {resultado && !processando && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 10 }}>Arraste sobre a foto para comparar o antes e depois</div>
                <button onClick={() => setCompararCheia({ antes: foto, depois: resultado, nome: paciente.trim() || 'Paciente' })}
                  style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(184,147,90,0.5)', background: 'rgba(184,147,90,0.12)', color: GOLD, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Maximize2 size={14} color={GOLD} /> Ver em tela cheia
                </button>
              </>
            )}

            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 2px 7px' }}>Cor dos dentes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TONS_IA.map(n => (
                <button key={n.valor} onClick={() => resultado ? gerar(n.valor) : setTom(n.valor)} disabled={processando}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, fontFamily: FONTE, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: tom === n.valor ? `1.5px solid ${GOLD}` : '1px solid rgba(255,255,255,0.14)', background: tom === n.valor ? 'rgba(184,147,90,0.18)' : 'rgba(255,255,255,0.06)', color: tom === n.valor ? GOLD : 'rgba(255,255,255,0.7)', opacity: processando ? 0.5 : 1 }}>
                  <span style={{ width: 13, height: 13, borderRadius: 7, background: n.cor, border: '1px solid rgba(0,0,0,0.25)', flexShrink: 0 }} />
                  {n.rotulo}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, textAlign: 'center', marginTop: 8 }}>
              {(TONS_IA.find(t => t.valor === tom) || {}).desc}
            </div>
            {resultado && !processando && (
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 4 }}>Toque em outra cor para gerar de novo com ela</div>
            )}

            {!resultado && (
              <button onClick={() => gerar()} disabled={processando}
                style={{ ...btnDourado, width: '100%', marginTop: 12, padding: 16, fontSize: 15, opacity: processando ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <Sparkles size={18} /> {processando ? 'Transformando...' : 'Transformar sorriso'}
              </button>
            )}

            {resultado && !processando && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={compartilhar} style={{ ...btnDourado, flex: 1, padding: 15, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Share2 size={16} /> Compartilhar antes e depois
                </button>
                <button onClick={baixar} title="Baixar"
                  style={{ width: 54, borderRadius: 14, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.07)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download size={18} />
                </button>
              </div>
            )}

            <button onClick={() => inputRef.current && inputRef.current.click()}
              style={{ width: '100%', marginTop: 10, padding: 13, borderRadius: 13, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE }}>
              Trocar foto
            </button>
          </div>
        )}

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.55, textAlign: 'center', marginTop: 18 }}>
          A foto é enviada com segurança para a IA do laboratório e usada apenas nesta simulação.
          O resultado é ilustrativo — o tratamento real depende do planejamento clínico.
        </div>
      </div>
      {compararCheia && <ComparadorTelaCheia antes={compararCheia.antes} depois={compararCheia.depois} nome={compararCheia.nome} aoFechar={() => setCompararCheia(null)} />}
      <input ref={inputRef} type="file" accept="image/*" onChange={escolherFoto} style={{ display: 'none' }} />
    </div>
  );
}

// ─── Perguntas à IA Special — versão do laboratório ───
// Dúvidas sobre próteses, implantes, componentes e técnicas, com foto.
function comprimirImagemChat(file) { return comprimirImagem(file, 900, 0.72); }

const SUGESTOES_IA = [
  '📷 Que implante é esse? (anexe a foto)',
  'Diferença entre pilar reto e angulado?',
  'Passo a passo: cimentação de coroa de zircônia',
];

export function PerguntasIALab({ aoFechar, nomeUsuario }) {
  const chaveLS = 'lab-perguntas-ia';
  const [mensagens, setMensagens] = useState(() => { try { return JSON.parse(localStorage.getItem(chaveLS) || '[]'); } catch (e) { return []; } });
  const [texto, setTexto] = useState('');
  const [fotoPend, setFotoPend] = useState(null);
  const [pensando, setPensando] = useState(false);
  const fimRef = useRef(null);
  const inputFotoRef = useRef(null);
  const [aoAvisar, toastEl] = useAviso();
  useEffect(() => { if (fimRef.current) fimRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensagens.length, pensando]);
  const persistir = (lista) => {
    setMensagens(lista);
    try { localStorage.setItem(chaveLS, JSON.stringify(lista.slice(-20))); } catch (e) { /* sem espaço: segue só em memória */ }
  };

  const anexarFoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { setFotoPend(await comprimirImagemChat(file)); } catch (err) { aoAvisar('Não consegui ler essa foto.'); }
  };

  const enviar = async (textoLivre) => {
    const t = String(textoLivre ?? texto).replace('📷 ', '').trim();
    const fotoEnv = fotoPend;
    if ((!t && !fotoEnv) || pensando) return;
    const minha = { de: 'eu', texto: t, foto: fotoEnv || null };
    const historico = mensagens.slice(-6).filter(m => m.texto).map(m => ({ de: m.de, texto: m.texto }));
    const base = [...mensagens, minha];
    persistir(base);
    setTexto(''); setFotoPend(null);
    setPensando(true);
    try {
      const resposta = await window.iaNuvem.perguntar({ pergunta: t, foto: fotoEnv ? fotoEnv.split(',')[1] : '', historico });
      persistir([...base, { de: 'ia', texto: resposta }]);
    } catch (e) {
      console.error('perguntarIA', e);
      aoAvisar(mensagemErroIA(e));
    }
    setPensando(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8900, background: '#141311', display: 'flex', flexDirection: 'column', fontFamily: FONTE }}>
      {toastEl}
      <style>{`@keyframes iaPonto { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(12px + env(safe-area-inset-top)) 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={aoFechar} style={{ width: 36, height: 36, borderRadius: 18, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>‹</button>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'linear-gradient(135deg, #E8C48A, #B8935A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MessageCircle size={17} color={INK} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: '#fff' }}>Perguntas</span>
            <span style={{ fontSize: 8.5, fontWeight: 800, color: INK, background: GOLD, borderRadius: 999, padding: '2.5px 7px', letterSpacing: '0.08em' }}>IA SPECIAL</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>próteses, implantes, componentes — envie foto e pergunte</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>
        {mensagens.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 14px', fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
              👋 Olá{nomeUsuario ? `, ${String(nomeUsuario).split(' ')[0]}` : ''}! Sou a <b style={{ color: GOLD }}>IA Special</b>. Me pergunte sobre próteses, implantes, componentes, materiais e técnicas — pode <b>anexar foto</b> que eu analiso (ex.: identificar um implante).
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 2px 8px' }}>Experimente</div>
            {SUGESTOES_IA.map(s => (
              <button key={s} onClick={() => (s.startsWith('📷') ? (inputFotoRef.current && inputFotoRef.current.click()) : enviar(s))}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'rgba(184,147,90,0.1)', border: '1px solid rgba(184,147,90,0.35)', borderRadius: 13, padding: '11px 13px', marginBottom: 8, fontSize: 12.5, fontWeight: 700, color: GOLD, cursor: 'pointer', fontFamily: FONTE }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {mensagens.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.de === 'eu' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '84%', borderRadius: m.de === 'eu' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 13px', background: m.de === 'eu' ? 'linear-gradient(135deg, #E8C48A, #B8935A)' : 'rgba(255,255,255,0.07)', border: m.de === 'eu' ? 'none' : '1px solid rgba(255,255,255,0.09)' }}>
              {m.de === 'ia' && <div style={{ fontSize: 8.5, fontWeight: 800, color: GOLD, letterSpacing: '0.1em', marginBottom: 4 }}>✨ IA SPECIAL</div>}
              {m.foto && <img src={m.foto} alt="foto" style={{ width: '100%', maxWidth: 220, borderRadius: 10, marginBottom: m.texto ? 7 : 0, display: 'block' }} />}
              {m.texto && <div style={{ fontSize: 13.5, lineHeight: 1.55, color: m.de === 'eu' ? INK : 'rgba(255,255,255,0.92)', fontWeight: m.de === 'eu' ? 700 : 500, whiteSpace: 'pre-wrap' }}>{m.texto}</div>}
            </div>
          </div>
        ))}
        {pensando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{ borderRadius: '16px 16px 16px 4px', padding: '13px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 4, background: GOLD, animation: `iaPonto 1.2s ease-in-out ${i * 0.18}s infinite` }} />)}
            </div>
          </div>
        )}
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', margin: '6px 0 4px', lineHeight: 1.5 }}>
          Respostas geradas por IA — confirme as condutas técnicas com a equipe.
        </div>
        <div ref={fimRef} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px calc(12px + env(safe-area-inset-bottom))' }}>
        {fotoPend && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <img src={fotoPend} alt="anexo" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', border: `1px solid ${GOLD}` }} />
            <span style={{ flex: 1, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Foto anexada — escreva a pergunta (ou só envie)</span>
            <button onClick={() => setFotoPend(null)} style={{ width: 26, height: 26, borderRadius: 13, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 800, cursor: 'pointer', lineHeight: '24px', padding: 0 }}>×</button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button onClick={() => inputFotoRef.current && inputFotoRef.current.click()}
            style={{ width: 42, height: 42, borderRadius: 21, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Camera size={18} color={GOLD} />
          </button>
          <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
            placeholder="Escreva sua pergunta..."
            style={{ flex: 1, padding: '12px 14px', borderRadius: 21, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, fontFamily: FONTE, outline: 'none', minWidth: 0 }} />
          <button onClick={() => enviar()} disabled={pensando || (!texto.trim() && !fotoPend)}
            style={{ width: 42, height: 42, borderRadius: 21, border: 'none', background: 'linear-gradient(135deg, #E8C48A, #B8935A)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: pensando || (!texto.trim() && !fotoPend) ? 0.45 : 1 }}>
            <Send size={17} color={INK} />
          </button>
        </div>
      </div>
      <input ref={inputFotoRef} type="file" accept="image/*" onChange={anexarFoto} style={{ display: 'none' }} />
    </div>
  );
}
