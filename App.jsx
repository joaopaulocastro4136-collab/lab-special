import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { imprimirDireto } from './impressora-niimbot.mjs';
import VisorSTL from './visor-stl.jsx';
import { Home, ClipboardList, Plus, Search, Clock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronDown, Trash2, Package, Settings, UserPlus, Timer, Paperclip, Camera, FileText, Box, Download, X, Pencil, Check, Bell, Hammer, Flag, CalendarClock, ArrowRight, Hourglass, Inbox, ThumbsUp, Send, Undo2, Stethoscope, ListChecks, Play, Square, User, Users, DollarSign, TrendingUp, BarChart3, Lock, MapPin, Share2, RotateCw, ZoomIn, ZoomOut, Sparkles, MessageCircle, LogOut } from 'lucide-react';
import { IASpecialLab, PerguntasIALab } from './ia-special-lab.jsx';

const INK = '#1C1B19';
const GOLD = '#B8935A';
const GOLD_SOFT = '#F3EBDA';
const ROXO = '#7C3AED';
const ROXO_SOFT = '#EDE9FE';
const VERDE = '#16A34A';

const STATUS_LIST = ['Em Produção', 'Acabamento', 'Pronto', 'Entregue'];
const MATERIAIS = ['Zircônia', 'E-max (Dissilicato)', 'PMMA', 'Metalocerâmica', 'Resina', 'Outro'];
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const LIMITE_ARQUIVO_MB = 100;
const HORAS_DIA_PADRAO = 8;

const TIPOS_PADRAO = [
  {
    nome: 'Coroa Unitária', prazoDias: 5, tempoHoras: 2, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Modelo e preparo/CAD', horas: 0.5, prova: false },
      { nome: 'Infraestrutura', horas: 0.5, prova: true },
      { nome: 'Aplicação de cerâmica', horas: 0.5, prova: false },
      { nome: 'Glaze e acabamento', horas: 0.5, prova: false },
    ],
  },
  {
    nome: 'Ponte Fixa', prazoDias: 7, tempoHoras: 4, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Modelo e preparo/CAD', horas: 1, prova: false },
      { nome: 'Infraestrutura', horas: 1, prova: true },
      { nome: 'Aplicação de cerâmica', horas: 1.5, prova: false },
      { nome: 'Glaze e acabamento', horas: 0.5, prova: false },
    ],
  },
  {
    nome: 'Prótese Total', prazoDias: 10, tempoHoras: 6, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Moldeira individual', horas: 1, prova: false },
      { nome: 'Plano de cera', horas: 1.5, prova: true },
      { nome: 'Montagem dos dentes', horas: 2, prova: true },
      { nome: 'Acrilização e acabamento', horas: 1.5, prova: false },
    ],
  },
  {
    nome: 'PPR', prazoDias: 10, tempoHoras: 5, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Grade metálica', horas: 2, prova: true },
      { nome: 'Montagem dos dentes', horas: 1.5, prova: true },
      { nome: 'Acrilização e acabamento', horas: 1.5, prova: false },
    ],
  },
  {
    nome: 'Protocolo/Implante', prazoDias: 12, tempoHoras: 8, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Guia e registro', horas: 1, prova: false },
      { nome: 'Estrutura/barra', horas: 3, prova: true },
      { nome: 'Montagem dos dentes', horas: 2, prova: true },
      { nome: 'Finalização', horas: 2, prova: false },
    ],
  },
  {
    nome: 'Faceta', prazoDias: 5, tempoHoras: 2, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Modelo e enceramento/CAD', horas: 1, prova: false },
      { nome: 'Confecção e acabamento', horas: 1, prova: false },
    ],
  },
  {
    nome: 'Provisório', prazoDias: 2, tempoHoras: 1, comissao: 0, valor: 0,
    etapas: [
      { nome: 'Confecção do provisório', horas: 1, prova: false },
    ],
  },
];

function todayISO() { return new Date().toISOString().split('T')[0]; }
function agoraISO() { return new Date().toISOString(); }
function mesAtualISO() { return todayISO().slice(0, 7); }
function addDias(iso, dias) {
  // Data vazia/inválida (ex.: campo de data apagado no formulário) não pode derrubar o app —
  // devolve '' porque proximoDiaUtil e as telas já sabem lidar com data vazia
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}
// Dias de trabalho padrão: segunda a sábado (0=dom ... 6=sáb)
const DIAS_TRABALHO_PADRAO = [1, 2, 3, 4, 5, 6];
// Prazo que cair em dia de folga pula para o próximo dia de trabalho configurado
function proximoDiaUtil(iso, diasTrabalho) {
  if (!iso) return iso;
  const dias = (diasTrabalho && diasTrabalho.length > 0) ? diasTrabalho : DIAS_TRABALHO_PADRAO;
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso; // data fora do formato (dado antigo/importado) não pode derrubar o app
  let tentativas = 0;
  while (!dias.includes(d.getDay()) && tentativas < 7) {
    d.setDate(d.getDate() + 1);
    tentativas++;
  }
  return d.toISOString().split('T')[0];
}
// ── Etiqueta térmica do trabalho (NIIMBOT B1, rótulo 50×30 mm) ──
// Gera a imagem no formato do rótulo; o QR guarda "LS-<id do caso>" e é lido
// pelo botão "Ler etiqueta" (abre a ficha do trabalho na hora).
async function gerarEtiquetaCanvas(caso) {
  const W = 800, H = 480; // 50×30 mm em dobro de definição — o app da NIIMBOT ajusta ao rótulo
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, 'LS-' + caso.id, { width: 300, margin: 1 });
  x.drawImage(qr, W - 322, (H - 300) / 2);
  x.fillStyle = '#000';
  const F = "-apple-system, 'Segoe UI', Arial, sans-serif";
  const LARG = W - 322 - 56; // área de texto à esquerda do QR
  x.font = `900 30px ${F}`; x.fillText('✦ SPECIAL LAB', 34, 56);
  const nome = String(caso.paciente || 'Trabalho').toUpperCase();
  let fs = 62; x.font = `900 ${fs}px ${F}`;
  while (x.measureText(nome).width > LARG && fs > 26) { fs -= 4; x.font = `900 ${fs}px ${F}`; }
  x.fillText(nome, 34, 148);
  const linha = (t, y, fonte) => {
    x.font = fonte;
    let s = String(t || '');
    while (x.measureText(s).width > LARG && s.length > 3) s = s.slice(0, -2);
    x.fillText(s, 34, y);
  };
  linha(caso.tipoTrabalho, 226, `700 42px ${F}`);
  linha(caso.dentista, 294, `400 38px ${F}`);
  const cod = 'Nº ' + String(caso.id).slice(-4).toUpperCase();
  x.font = `800 36px ${F}`;
  x.lineWidth = 5; x.strokeStyle = '#000';
  x.strokeRect(34, 376, x.measureText(cod).width + 44, 68);
  x.fillText(cod, 56, 424);
  return c;
}
async function compartilharEtiqueta(caso) {
  try {
    const dataURL = (await gerarEtiquetaCanvas(caso)).toDataURL('image/png');
    const blob = await (await fetch(dataURL)).blob();
    const nomeArq = 'etiqueta-' + String(caso.paciente || 'trabalho').trim().replace(/[^\w]+/g, '-').toLowerCase() + '.png';
    const arquivo = new File([blob], nomeArq, { type: 'image/png' });
    if (navigator.share) { await navigator.share({ files: [arquivo], title: 'Etiqueta do trabalho' }); return; }
    const a = document.createElement('a'); a.href = dataURL; a.download = nomeArq; a.click();
  } catch (e) {
    // cancelar o compartilhar não é erro
    if (String(e).toLowerCase().indexOf('abort') === -1) alert('Não consegui gerar a etiqueta: ' + ((e && e.message) || e));
  }
}
// Imprime a etiqueta: no app do celular tenta DIRETO pelo Bluetooth (NIIMBOT);
// se não der (sem Bluetooth, cancelou a escolha, máquina desligada), cai no compartilhar.
async function imprimirEtiqueta(caso) {
  const nativo = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if (nativo) {
    try {
      await imprimirDireto(await gerarEtiquetaCanvas(caso));
      return true;
    } catch (e) {
      console.error('impressão direta', e);
      const msg = String((e && e.message) || e);
      const cancelou = /cancel|requestDevice/i.test(msg);
      if (!cancelou && !confirm('Não consegui imprimir direto pelo Bluetooth.\n(' + msg.slice(0, 90) + ')\n\nQuer compartilhar a etiqueta pra imprimir pelo app da NIIMBOT?')) return false;
      if (cancelou) return false;
    }
  }
  await compartilharEtiqueta(caso);
  return false;
}

// Leitor do QR da etiqueta: câmera aberta em tela cheia até achar um código "LS-…"
function LeitorEtiqueta({ onAchar, onFechar }) {
  const videoRef = useRef(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true, stream = null, raf = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!ativo) { stream.getTracks().forEach(t => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const ler = () => {
          if (!ativo) return;
          const v = videoRef.current;
          if (v && v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const qr = jsQR(img.data, img.width, img.height);
            const m = qr && /^LS-(.+)$/.exec(qr.data || '');
            if (m) { ativo = false; stream.getTracks().forEach(t => t.stop()); onAchar(m[1]); return; }
          }
          raf = requestAnimationFrame(ler);
        };
        raf = requestAnimationFrame(ler);
      } catch (e) { setErro('Não consegui abrir a câmera. Confira a permissão de câmera nos Ajustes do aparelho.'); }
    })();
    return () => { ativo = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#000' }}>
      <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '58px 20px 16px', textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: 15, background: 'linear-gradient(rgba(0,0,0,.7), transparent)' }}>
        Aponte a câmera para o QR da etiqueta
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 230, height: 230, border: '3px solid rgba(255,255,255,.85)', borderRadius: 24 }} />
      {erro && <div style={{ position: 'absolute', top: '30%', left: 24, right: 24, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>{erro}</div>}
      <button onClick={onFechar} style={{ position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)', background: '#fff', color: '#1C1B19', border: 'none', borderRadius: 999, padding: '13px 34px', fontWeight: 800, fontSize: 15 }}>Fechar</button>
    </div>
  );
}

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatDataHoraBR(isoDatetime) {
  const d = new Date(isoDatetime);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatHoras(h) {
  if (h === Math.floor(h)) return `${h}h`;
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  return horas > 0 ? `${horas}h${String(min).padStart(2, '0')}` : `${min}min`;
}
function formatMinutos(min) {
  if (min == null) return '—';
  if (min < 60) return `${Math.round(min)}min`;
  return formatHoras(Math.round((min / 60) * 100) / 100);
}
function formatReais(v) {
  return 'R$ ' + (v || 0).toFixed(2).replace('.', ',');
}
function hojeExtenso() {
  const d = new Date();
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
function amanhaExtenso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
function diasRestantes(prazo) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(prazo + 'T00:00:00') - hoje) / 86400000);
}
function getUrgencia(caso) {
  if (caso.status === 'Entregue') return 'entregue';
  const dias = diasRestantes(caso.prazo);
  if (dias < 0) return 'atrasado';
  if (dias === 0) return 'hoje';
  if (dias <= 2) return 'proximo';
  return 'normal';
}
function emProducao(caso) {
  return caso.status === 'Em Produção' || caso.status === 'Acabamento';
}
// Trabalho travado esperando o dentista responder um pedido de aprovação de arquivo
function aguardandoDentista(caso) {
  return (caso.anexos || []).some(a => a.aprovacao && a.aprovacao.status === 'pendente');
}
// Trabalho postado pelo dentista que o laboratório ainda não foi buscar.
// Sai da lista quando: (1) alguém toca em "Foi pego ✓" (retiradoEm), OU
// (2) alguma etapa é iniciada/concluída — começou a produção, então já foi pego
function aguardandoRetirada(caso) {
  return caso.origem === 'clinica'
    && caso.status === 'Em Produção'
    && !caso.retiradoEm
    && !(caso.etapas || []).some(e => e.concluida || e.inicioExec);
}
function progressoPrazo(caso) {
  const inicio = new Date((caso.dataProducao || caso.dataEntrada) + 'T00:00:00');
  const fim = new Date(caso.prazo + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const total = fim - inicio;
  if (total <= 0) return hoje >= fim ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((hoje - inicio) / total) * 100)));
}
function tempoDoTipo(tiposTrabalho, nomeTipo) {
  const t = tiposTrabalho.find(t => t.nome === nomeTipo);
  if (t?.etapas?.length) return t.etapas.reduce((s, e) => s + (e.horas || 0), 0);
  return t?.tempoHoras ?? 2;
}
function tempoRestante(caso, tiposTrabalho) {
  if (caso.etapas?.length) {
    return caso.etapas.filter(e => !e.concluida).reduce((s, e) => s + (e.horas || 0), 0);
  }
  return tempoDoTipo(tiposTrabalho, caso.tipoTrabalho);
}
function etapaAtual(caso) {
  if (!caso.etapas?.length) return null;
  return caso.etapas.find(e => !e.concluida) || null;
}
function etapasDoTipo(tipo) {
  if (tipo?.etapas?.length) return tipo.etapas;
  return [{ nome: 'Execução', horas: tipo?.tempoHoras ?? 2, prova: false }];
}
// Cada item leva as PRÓPRIAS etapas, marcadas com o nome do item (etapa.item) —
// assim a agenda mostra o tempo de cada item separado e a carga do dia não é subestimada
function etapasDeItens(tiposTrabalho, nomes) {
  const saida = [];
  (nomes || []).forEach(nome => {
    const t = tiposTrabalho.find(t => t.nome === nome);
    etapasDoTipo(t).forEach(e => saida.push({ ...e, item: nome }));
  });
  return saida;
}
function rotuloItens(itens) {
  return (itens || []).map(i => (i.quantidade || 1) > 1 ? `${i.nome} ×${i.quantidade}` : i.nome).join(' + ');
}
// Divide um trabalho com vários itens em blocos separados para a agenda do dia:
// cada item vira uma entrada com suas próprias etapas e horas (o trabalho continua sendo um só)
function expandirPorItem(casos) {
  const saida = [];
  (casos || []).forEach(c => {
    const nomesTag = [...new Set((c.etapas || []).map(e => e.item).filter(Boolean))];
    if ((c.itens || []).length > 1 && nomesTag.length > 1) {
      const completo = etapasCompletas(c);
      nomesTag.forEach(nomeItem => {
        const it = (c.itens || []).find(x => x.nome === nomeItem);
        const rotulo = (it && (it.quantidade || 1) > 1) ? `${nomeItem} ×${it.quantidade}` : nomeItem;
        saida.push({ ...c, _bloco: rotulo, _casoCompleto: completo, tipoTrabalho: rotulo, etapas: c.etapas.filter(e => e.item === nomeItem) });
      });
      // Etapas antigas sem marcação de item continuam aparecendo (bloco com o rótulo original)
      const semTag = (c.etapas || []).filter(e => !e.item);
      if (semTag.length > 0) saida.push({ ...c, _bloco: 'geral', _casoCompleto: completo, etapas: semTag });
    } else {
      saida.push(c);
    }
  });
  return saida;
}
function etapasCompletas(caso) {
  if (!caso.etapas?.length) return true;
  return caso.etapas.every(e => e.concluida);
}
function enderecoDe(dentistas, nome) {
  const d = dentistas.find(d => d.nome === nome);
  return d?.endereco || '';
}
function mapsUrl(endereco) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco);
}
// Médias reais a partir do histórico: { 'Tipo|Etapa': {soma, n} }
function calcularMedias(historico) {
  const map = {};
  for (const h of historico) {
    const k = `${h.tipo}|${h.etapa}`;
    if (!map[k]) map[k] = { soma: 0, n: 0 };
    map[k].soma += h.minutos;
    map[k].n += 1;
  }
  const medias = {};
  for (const k in map) medias[k] = { media: map[k].soma / map[k].n, n: map[k].n };
  return medias;
}
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}
// Logo do laboratório: estrela de 4 pontas (vetor fiel à marca)
function EstrelaLogo({ size = 16, color = 'white', style = {} }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="-50 -60 100 120" style={{ display: 'block', ...style }}>
      <path d="M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z" fill={color} />
    </svg>
  );
}

// Campo numérico amigável: tocar seleciona tudo, aceita vírgula, permite apagar e abre o teclado numérico.
// Só grava o valor quando você sai do campo (ou aperta OK/Enter) — nada de "voltar sozinho" enquanto digita.
function InputNumero({ valor, onValor, min = 0, max = null, inteiro = false, className = '', style = {}, placeholder = '' }) {
  const paraTexto = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));
  const [texto, setTexto] = useState(paraTexto(valor));
  const focado = useRef(false);
  useEffect(() => { if (!focado.current) setTexto(paraTexto(valor)); }, [valor]);
  const confirmar = () => {
    focado.current = false;
    const v = inteiro ? parseInt(texto, 10) : parseFloat(texto.replace(',', '.'));
    if (!isNaN(v) && v >= min && (max == null || v <= max)) {
      setTexto(paraTexto(v));
      if (v !== valor) onValor(v);
    } else {
      setTexto(paraTexto(valor));
    }
  };
  return (
    <input type="text" inputMode={inteiro ? 'numeric' : 'decimal'} className={className} style={style} placeholder={placeholder}
      value={texto}
      onFocus={e => { focado.current = true; const el = e.target; requestAnimationFrame(() => el.select()); }}
      onChange={e => setTexto(e.target.value.replace(inteiro ? /[^\d]/g : /[^\d.,]/g, ''))}
      onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} />
  );
}

const URGENCIA_STYLES = {
  atrasado: { bg: '#FCE4E4', text: '#B42318', label: (d) => `Atrasado ${Math.abs(d)}d` },
  hoje: { bg: '#FDECD8', text: '#B54708', label: () => 'Hoje' },
  proximo: { bg: '#FEF3C7', text: '#92620A', label: (d) => `Faltam ${d}d` },
  normal: { bg: '#F0EFEC', text: '#57534E', label: (d) => `Faltam ${d}d` },
  entregue: { bg: '#DCF3E4', text: '#166B3A', label: () => 'Entregue' },
};

const FILTROS_RAPIDOS = {
  producao: { titulo: 'Em produção', teste: (c) => emProducao(c) },
  atrasado: { titulo: 'Atrasados', teste: (c) => getUrgencia(c) === 'atrasado' },
  pronto: { titulo: 'Prontos p/ entrega', teste: (c) => c.status === 'Pronto' },
  clinica: { titulo: 'Provas (levar + na clínica)', teste: (c) => (c.naClinica || c.provaPendente) && c.status !== 'Entregue' },
  retirada: { titulo: 'Para retirada na clínica', teste: (c) => aguardandoRetirada(c) || (c.naClinica && c.retornoSolicitado) },
};

// Converte um dataURL (base64) em Blob binário — usado p/ subir fotos comprimidas ao armazém
function dataURLparaBlob(dataURL, mime) {
  const b64 = dataURL.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('Falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

function compressImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      res(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Imagem inválida')); };
    img.src = url;
  });
}

// Prepara a imagem para anexo com 3 tentativas (cobre HEIC do iPhone e outros formatos)
async function prepararImagem(file) {
  const MAX = 1280;
  // 1ª tentativa: decodificador moderno (createImageBitmap lê mais formatos, incluindo HEIC em iPhones novos)
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX || height > MAX) {
      const ratio = Math.min(MAX / width, MAX / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return { dataURL: canvas.toDataURL('image/jpeg', 0.8), mime: 'image/jpeg' };
  } catch (e) { /* segue para a próxima tentativa */ }
  // 2ª tentativa: método clássico via <img>
  try {
    const dataURL = await compressImage(file);
    return { dataURL, mime: 'image/jpeg' };
  } catch (e) { /* segue */ }
  // 3ª tentativa: salva a foto original sem converter (se couber no limite)
  if (file.size <= LIMITE_ARQUIVO_MB * 1024 * 1024) {
    const dataURL = await readFileAsDataURL(file);
    return { dataURL, mime: file.type || 'image/heic' };
  }
  throw new Error('imagem-grande');
}

function baixarDataURL(dataURL, nome) {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Gera a imagem JPEG do relatório do dia (retrato p/ WhatsApp, paisagem p/ TV) ───
function desenharImagemDia({ titulo, dataExtenso, casos, tiposTrabalho, horasDia, orientacao = 'retrato' }) {
  const FONTE = "'Manrope', -apple-system, sans-serif";
  const paisagem = orientacao === 'paisagem';

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const fitText = (ctx, texto, maxW) => {
    let t = texto;
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  };

  const totalHoras = casos.reduce((s, c) => s + tempoRestante(c, tiposTrabalho), 0);
  const excedente = totalHoras - horasDia;
  const corCarga = excedente > 0 ? '#FCA5A5' : (totalHoras / horasDia >= 0.85 ? '#FDBA74' : '#86EFAC');
  const dataCap = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);
  const linhaCarga = `${casos.length} ${casos.length === 1 ? 'trabalho' : 'trabalhos'} • ≈ ${formatHoras(totalHoras)} de ${formatHoras(horasDia)}${excedente > 0 ? '  ⚠ ACIMA DA CAPACIDADE' : ''}`;

  const desenharCartao = (ctx, c, i, x, y, w, h, esc) => {
    ctx.fillStyle = 'white';
    roundRect(ctx, x, y, w, h, 22 * esc);
    ctx.fill();
    const atrasado = diasRestantes(c.prazo) < 0;
    ctx.strokeStyle = atrasado ? '#DC2626' : (emProducao(c) ? GOLD : '#E7E5E4');
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 22 * esc);
    ctx.stroke();

    ctx.fillStyle = GOLD_SOFT;
    ctx.beginPath();
    ctx.arc(x + 56 * esc, y + h / 2, 32 * esc, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7A6234';
    ctx.font = `800 ${32 * esc}px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x + 56 * esc, y + h / 2 - 16 * esc);
    ctx.textAlign = 'left';

    const tx = x + 110 * esc;
    const maxTexto = w - 110 * esc - 230 * esc;

    ctx.fillStyle = INK;
    ctx.font = `800 ${36 * esc}px ${FONTE}`;
    ctx.fillText(fitText(ctx, c.paciente, maxTexto), tx, y + 22 * esc);

    ctx.fillStyle = '#78716C';
    ctx.font = `600 ${26 * esc}px ${FONTE}`;
    ctx.fillText(fitText(ctx, `${c.dentista} • ${c.tipoTrabalho}`, maxTexto), tx, y + 70 * esc);

    const et = etapaAtual(c);
    const feitas = c.etapas?.filter(e => e.concluida).length || 0;
    const total = c.etapas?.length || 0;
    ctx.fillStyle = '#B8935A';
    ctx.font = `700 ${26 * esc}px ${FONTE}`;
    const linhaEtapa = c.status === 'Pronto' ? 'Finalizado — pronto para entrega' : (et ? `Próxima etapa: ${et.nome}  (${feitas}/${total})` : `Etapas: ${feitas}/${total}`);
    ctx.fillText(fitText(ctx, linhaEtapa, maxTexto), tx, y + 116 * esc);

    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = `800 ${36 * esc}px ${FONTE}`;
    ctx.fillText(formatHoras(tempoRestante(c, tiposTrabalho)), x + w - 30 * esc, y + 24 * esc);

    let badge = null, badgeCor = null, badgeBg = null;
    if (atrasado) { badge = `ATRASADO ${Math.abs(diasRestantes(c.prazo))}D`; badgeCor = '#B42318'; badgeBg = '#FCE4E4'; }
    else if (c.status === 'Pronto') { badge = 'PRONTO'; badgeCor = '#166B3A'; badgeBg = '#DCF3E4'; }
    else if (c.provaPendente && !c.naClinica) { badge = 'LEVAR À CLÍNICA'; badgeCor = '#B54708'; badgeBg = '#FDECD8'; }
    else if (c.naClinica) { badge = 'NA CLÍNICA'; badgeCor = ROXO; badgeBg = ROXO_SOFT; }
    if (badge) {
      ctx.font = `800 ${20 * esc}px ${FONTE}`;
      const bw = ctx.measureText(badge).width + 32 * esc;
      ctx.fillStyle = badgeBg;
      roundRect(ctx, x + w - 30 * esc - bw, y + h - 62 * esc, bw, 42 * esc, 21 * esc);
      ctx.fill();
      ctx.fillStyle = badgeCor;
      ctx.fillText(badge, x + w - 46 * esc, y + h - 53 * esc);
    }
    ctx.textAlign = 'left';
  };

  let canvas;
  if (paisagem) {
    // ── Formato TV / computador (16:9, duas colunas) ──
    const W = 1920;
    const PAD = 64;
    const COLS = 2;
    const CARD_W = (W - PAD * 2 - 32) / COLS;
    const CARD_H = 210;
    const GAP = 28;
    const HEADER_H = 250;
    const linhas = Math.ceil(Math.max(casos.length, 1) / COLS);
    const H = Math.max(1080, HEADER_H + linhas * (CARD_H + GAP) + 90);

    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#F5F4F0';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 190);
    ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.font = `700 28px ${FONTE}`;
    ctx.letterSpacing = '8px';
    ctx.fillText('LABORATÓRIO SPECIAL', PAD, 38);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = 'white';
    ctx.font = `800 62px ${FONTE}`;
    ctx.fillText(titulo, PAD, 84);
    // Data + carga à direita, dentro da faixa preta
    ctx.textAlign = 'right';
    ctx.fillStyle = '#D6D3D1';
    ctx.font = `600 32px ${FONTE}`;
    ctx.fillText(dataCap, W - PAD, 52);
    ctx.fillStyle = corCarga;
    ctx.font = `800 34px ${FONTE}`;
    ctx.fillText(linhaCarga, W - PAD, 104);
    ctx.textAlign = 'left';

    if (casos.length === 0) {
      ctx.fillStyle = '#A8A29E';
      ctx.font = `600 40px ${FONTE}`;
      ctx.fillText('Nenhum trabalho para este dia. ✓', PAD, HEADER_H + 40);
    }
    casos.forEach((c, i) => {
      const col = i % COLS;
      const linha = Math.floor(i / COLS);
      const x = PAD + col * (CARD_W + 32);
      const y = HEADER_H + linha * (CARD_H + GAP);
      desenharCartao(ctx, c, i, x, y, CARD_W, CARD_H, 1);
    });

    ctx.fillStyle = '#A8A29E';
    ctx.font = `600 24px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Laboratório Special • gerado em ${formatDateBR(todayISO())}`, W / 2, H - 52);
    ctx.textAlign = 'left';
  } else {
    // ── Formato retrato (WhatsApp / PDF) ──
    const W = 1080;
    const PAD = 56;
    const CARD_H = 190;
    const GAP = 26;
    const HEADER_H = 300;
    const FOOTER_H = 110;
    const H = HEADER_H + Math.max(casos.length, 1) * (CARD_H + GAP) + FOOTER_H;

    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#F5F4F0';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 180);
    ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.font = `700 26px ${FONTE}`;
    ctx.letterSpacing = '8px';
    ctx.fillText('LABORATÓRIO SPECIAL', PAD, 44);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = 'white';
    ctx.font = `800 58px ${FONTE}`;
    ctx.fillText(titulo, PAD, 88);

    ctx.fillStyle = '#57534E';
    ctx.font = `600 32px ${FONTE}`;
    ctx.fillText(dataCap, PAD, 208);
    ctx.fillStyle = excedente > 0 ? '#DC2626' : (totalHoras / horasDia >= 0.85 ? '#EA580C' : '#166B3A');
    ctx.font = `800 32px ${FONTE}`;
    ctx.fillText(linhaCarga, PAD, 250);

    if (casos.length === 0) {
      ctx.fillStyle = '#A8A29E';
      ctx.font = `600 34px ${FONTE}`;
      ctx.fillText('Nenhum trabalho para este dia. ✓', PAD, HEADER_H + 40);
    }
    casos.forEach((c, i) => {
      desenharCartao(ctx, c, i, PAD, HEADER_H + i * (CARD_H + GAP), W - PAD * 2, CARD_H, 1);
    });

    ctx.fillStyle = '#A8A29E';
    ctx.font = `600 24px ${FONTE}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Laboratório Special • gerado em ${formatDateBR(todayISO())}`, W / 2, H - 64);
    ctx.textAlign = 'left';
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

// Constrói um PDF real com a imagem JPEG embutida (sem bibliotecas)
function jpegParaPDF(dataURL) {
  const base64 = dataURL.split(',')[1];
  const bin = atob(base64);
  const jpegBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) jpegBytes[i] = bin.charCodeAt(i);

  // Dimensões do JPEG (procura o marcador SOF)
  let w = 1080, h = 1400;
  for (let i = 2; i < jpegBytes.length - 9; i++) {
    if (jpegBytes[i] === 0xFF && jpegBytes[i + 1] >= 0xC0 && jpegBytes[i + 1] <= 0xC3) {
      h = (jpegBytes[i + 5] << 8) | jpegBytes[i + 6];
      w = (jpegBytes[i + 7] << 8) | jpegBytes[i + 8];
      break;
    }
  }
  // Página em pontos (A4-like proporcional à imagem, largura 595pt)
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

// ─── Lista dos trabalhos adicionados hoje (imagem → PDF para WhatsApp) ───
function desenharTrabalhosDeHoje({ casos }) {
  const W = 1080, PAD = 56, LINHA = 132;
  const H = 300 + casos.length * LINHA + 170;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const F = "'Manrope', -apple-system, sans-serif";
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
  ctx.fillStyle = '#1C1B19'; ctx.fillRect(0, 0, W, 216);
  ctx.fillStyle = '#B8935A'; ctx.font = `800 28px ${F}`;
  ctx.fillText('LABORATÓRIO SPECIAL', PAD, 74);
  ctx.fillStyle = '#fff'; ctx.font = `800 46px ${F}`;
  ctx.fillText('Trabalhos adicionados hoje', PAD, 136);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `600 26px ${F}`;
  ctx.fillText(caber(`${formatDateBR(todayISO())} • ${casos.length} ${casos.length === 1 ? 'trabalho' : 'trabalhos'}`, W - PAD * 2), PAD, 182);
  let y = 252;
  casos.forEach((c, i) => {
    ctx.fillStyle = '#fff';
    cartao(PAD, y, W - PAD * 2, LINHA - 16, 18); ctx.fill();
    ctx.strokeStyle = '#E7E5E4'; ctx.lineWidth = 2; cartao(PAD, y, W - PAD * 2, LINHA - 16, 18); ctx.stroke();
    ctx.fillStyle = '#1C1B19'; ctx.font = `800 32px ${F}`;
    ctx.fillText(caber(`${i + 1}. ${c.paciente}`, W - PAD * 4), PAD + 28, y + 48);
    ctx.fillStyle = '#78716C'; ctx.font = `600 26px ${F}`;
    ctx.fillText(caber(`${c.dentista} • ${c.tipoTrabalho}${c.prazo ? ` • entrega ${formatDateBR(c.prazo)}` : ''}`, W - PAD * 4), PAD + 28, y + 90);
    y += LINHA;
  });
  y += 8;
  ctx.fillStyle = '#DCF3E4';
  cartao(PAD, y, W - PAD * 2, 92, 18); ctx.fill();
  ctx.fillStyle = '#166B3A'; ctx.font = `800 28px ${F}`;
  ctx.fillText('✓ Todos já entraram em produção no laboratório.', PAD + 28, y + 56);
  return cv.toDataURL('image/jpeg', 0.92);
}

// ─── Gera a imagem do extrato de serviços de um dentista (para PDF) ───
function desenharExtratoDentista({ dentistaNome, mesLabel, trabalhos, total }) {
  const FONTE = "'Manrope', -apple-system, sans-serif";
  const W = 1080;
  const PAD = 56;
  const ROW_H = 96;
  const HEADER_H = 320;
  const H = HEADER_H + Math.max(trabalhos.length, 1) * ROW_H + 240;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const fitText = (t, maxW) => {
    let s = t;
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  };

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  // Cabeçalho
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, 180);
  ctx.fillStyle = GOLD;
  ctx.font = `700 26px ${FONTE}`;
  ctx.letterSpacing = '8px';
  ctx.fillText('LABORATÓRIO SPECIAL', PAD, 44);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = 'white';
  ctx.font = `800 54px ${FONTE}`;
  ctx.fillText('Extrato de Serviços', PAD, 88);

  ctx.fillStyle = INK;
  ctx.font = `800 40px ${FONTE}`;
  ctx.fillText(fitText(dentistaNome, W - PAD * 2), PAD, 212);
  ctx.fillStyle = '#78716C';
  ctx.font = `600 30px ${FONTE}`;
  const mesCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);
  ctx.fillText(`${mesCap} • ${trabalhos.length} ${trabalhos.length === 1 ? 'trabalho entregue' : 'trabalhos entregues'}`, PAD, 262);

  // Linhas do extrato
  let y = HEADER_H;
  if (trabalhos.length === 0) {
    ctx.fillStyle = '#A8A29E';
    ctx.font = `600 30px ${FONTE}`;
    ctx.fillText('Nenhum trabalho entregue neste mês.', PAD, y + 20);
    y += ROW_H;
  }
  trabalhos.forEach((c, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = '#FAF9F7';
      ctx.fillRect(PAD - 16, y, W - PAD * 2 + 32, ROW_H);
    }
    ctx.fillStyle = INK;
    ctx.font = `700 30px ${FONTE}`;
    ctx.fillText(fitText(c.paciente, W - PAD * 2 - 260), PAD, y + 14);
    ctx.fillStyle = '#78716C';
    ctx.font = `600 24px ${FONTE}`;
    ctx.fillText(fitText(`${c.tipoTrabalho} • entregue em ${formatDateBR(c.dataSaida)}`, W - PAD * 2 - 260), PAD, y + 54);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.valor > 0 ? '#166B3A' : '#A8A29E';
    ctx.font = `800 32px ${FONTE}`;
    ctx.fillText(c.valor > 0 ? formatReais(c.valor) : 'sem valor', W - PAD, y + 28);
    ctx.textAlign = 'left';
    y += ROW_H;
  });

  // Total
  y += 24;
  ctx.fillStyle = GOLD_SOFT;
  ctx.fillRect(PAD - 16, y, W - PAD * 2 + 32, 92);
  ctx.fillStyle = '#7A6234';
  ctx.font = `800 32px ${FONTE}`;
  ctx.fillText('TOTAL DO MÊS', PAD, y + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = `800 42px ${FONTE}`;
  ctx.fillText(formatReais(total), W - PAD, y + 22);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#A8A29E';
  ctx.font = `600 24px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.fillText(`Laboratório Special • emitido em ${formatDateBR(todayISO())}`, W / 2, H - 70);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/jpeg', 0.92);
}

// ─── Gesto de voltar: deslizar da borda esquerda p/ a direita (padrão do iPhone) ───
// Cada tela/janela registra o próprio "voltar"; o gesto aciona o registro mais recente
// (o que estiver aberto por cima). Devolver false passa a vez pro registro de baixo.
const pilhaVoltar = [];
let gestoVoltarLigado = false;
function ligarGestoVoltar() {
  if (gestoVoltarLigado || typeof window === 'undefined') return;
  gestoVoltarLigado = true;
  let inicio = null;
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    inicio = (e.touches.length === 1 && t.clientX <= 30) ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!inicio) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.x;
    const dy = Math.abs(t.clientY - inicio.y);
    inicio = null;
    if (dx < 70 || dy > 60 || dx < dy * 1.5) return;
    for (let i = pilhaVoltar.length - 1; i >= 0; i--) {
      if (pilhaVoltar[i]() !== false) return;
    }
  }, { passive: true });
}
function useGestoVoltar(aoVoltar) {
  const ref = useRef(aoVoltar);
  ref.current = aoVoltar;
  useEffect(() => {
    ligarGestoVoltar();
    const entrada = () => ref.current();
    pilhaVoltar.push(entrada);
    return () => { const i = pilhaVoltar.indexOf(entrada); if (i >= 0) pilhaVoltar.splice(i, 1); };
  }, []);
}

// ─── Puxar para atualizar: no topo da página, arrasta p/ baixo e a estrela da marca
// desce girando; soltou → recarrega os dados no lugar, sem sair da tela ───
function PuxarAtualizar({ aoAtualizar }) {
  const caixaRef = useRef(null);
  const estrelaRef = useRef(null);
  const [atualizando, setAtualizando] = useState(false);
  const acaoRef = useRef(aoAtualizar);
  acaoRef.current = aoAtualizar;
  const estado = useRef({ y0: 0, x0: 0, puxando: false, dist: 0, ocupado: false });

  useEffect(() => {
    const GATILHO = 55; // distância (já amortecida) p/ disparar a atualização
    const aplicar = (dist) => {
      estado.current.dist = dist;
      const el = caixaRef.current;
      if (!el) return;
      el.style.transform = `translateX(-50%) translateY(${dist > 0 ? dist - 54 : -54}px)`;
      el.style.opacity = dist > 8 ? '1' : '0';
      const es = estrelaRef.current;
      if (es && !estado.current.ocupado) es.style.transform = `rotate(${dist * 3.2}deg) scale(${Math.min(1, 0.45 + (dist / GATILHO) * 0.55)})`;
    };
    // Só puxa quando a página (e nenhuma caixa rolável tocada) está no topo.
    // Ignora toques em vídeo, modelo 3D e áreas marcadas com data-sem-puxar.
    const podePuxar = (alvo) => {
      if (window.scrollY > 2) return false;
      if (alvo && alvo.closest && alvo.closest('canvas, video, [data-sem-puxar]')) return false;
      let el = alvo;
      while (el && el !== document.body) { if (el.scrollTop > 0) return false; el = el.parentElement; }
      return true;
    };
    const inicio = (e) => {
      if (e.touches.length !== 1 || estado.current.ocupado) return;
      estado.current.puxando = podePuxar(e.target);
      estado.current.y0 = e.touches[0].clientY;
      estado.current.x0 = e.touches[0].clientX;
    };
    const mover = (e) => {
      if (!estado.current.puxando || estado.current.ocupado) return;
      const dy = e.touches[0].clientY - estado.current.y0;
      const dx = Math.abs(e.touches[0].clientX - estado.current.x0);
      if (dy <= 0) { aplicar(0); return; }
      if (dx > dy) { estado.current.puxando = false; aplicar(0); return; }
      aplicar(Math.min(110, dy * 0.45));
    };
    const fim = async () => {
      if (!estado.current.puxando || estado.current.ocupado) return;
      estado.current.puxando = false;
      if (estado.current.dist < GATILHO) { aplicar(0); return; }
      estado.current.ocupado = true;
      setAtualizando(true);
      aplicar(62);
      try { await acaoRef.current(); } catch (e) { /* tenta de novo no próximo puxão */ }
      setTimeout(() => { setAtualizando(false); estado.current.ocupado = false; aplicar(0); }, 450);
    };
    window.addEventListener('touchstart', inicio, { passive: true });
    window.addEventListener('touchmove', mover, { passive: true });
    window.addEventListener('touchend', fim, { passive: true });
    return () => {
      window.removeEventListener('touchstart', inicio);
      window.removeEventListener('touchmove', mover);
      window.removeEventListener('touchend', fim);
    };
  }, []);

  return (
    <div ref={caixaRef} style={{ position: 'fixed', top: 'env(safe-area-inset-top)', left: '50%', transform: 'translateX(-50%) translateY(-54px)', opacity: 0, zIndex: 9998, pointerEvents: 'none', transition: 'transform 0.22s ease, opacity 0.18s ease' }}>
      <style>{`@keyframes puxarGira { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 46, height: 46, borderRadius: 23, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 26px -10px rgba(0,0,0,0.45)' }}>
        <div ref={estrelaRef} style={{ animation: atualizando ? 'puxarGira 0.75s linear infinite' : 'none' }}>
          <svg width={20} height={24} viewBox="-50 -60 100 120" style={{ display: 'block' }}>
            <path d="M0,-55 C4,-17 17,-4 46,0 C17,4 4,17 0,55 C-4,17 -17,4 -46,0 C-17,-4 -4,-17 0,-55 Z" fill={GOLD} />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [casos, setCasos] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [dentistas, setDentistas] = useState([]);
  const [tiposTrabalho, setTiposTrabalho] = useState(TIPOS_PADRAO);
  const [funcionarios, setFuncionarios] = useState([]);
  const [usuarioAtivoId, setUsuarioAtivoId] = useState(null);
  const [horasDia, setHorasDia] = useState(HORAS_DIA_PADRAO);
  const [diasTrabalho, setDiasTrabalho] = useState(DIAS_TRABALHO_PADRAO);
  const [horasPorDia, setHorasPorDia] = useState(DIAS_TRABALHO_PADRAO.reduce((a, d) => { a[d] = HORAS_DIA_PADRAO; return a; }, [0, 0, 0, 0, 0, 0, 0]));
  const [autoAjuste, setAutoAjuste] = useState(false);
  const [chavePix, setChavePix] = useState('');
  const [pessoas, setPessoas] = useState(1); // quantas pessoas produzem ao mesmo tempo (capacidade = horas × pessoas)
  const [ajustesDia, setAjustesDiaState] = useState({}); // capacidade sob medida de datas específicas: {'2026-07-17': {horas, pessoas}}
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoTempos, setHistoricoTempos] = useState([]);
  const [comissoes, setComissoes] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [diaSelecionado, setDiaSelecionado] = useState('hoje');
  const [selectedId, setSelectedId] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');
  const [filtroDentista, setFiltroDentista] = useState('Todos');
  const [filtroRapido, setFiltroRapido] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [toast, setToast] = useState(null);
  const [seletorUsuarioAberto, setSeletorUsuarioAberto] = useState(false);
  const [imprimindoCasoId, setImprimindoCasoId] = useState(null);
  const [lendoEtiqueta, setLendoEtiqueta] = useState(false);
  const [iaAberta, setIaAberta] = useState(false); // IA Special (transformação de sorriso)
  const [perguntasAbertas, setPerguntasAbertas] = useState(false); // chat de perguntas à IA
  const [origemDetalhe, setOrigemDetalhe] = useState('lista');

  const usuarioAtivo = funcionarios.find(f => f.id === usuarioAtivoId) || null;
  // Sem equipe cadastrada, ou equipe sem nenhum gestor definido → acesso liberado (evita ficar trancado pra fora)
  const existeGestor = funcionarios.some(f => f.gestor);
  const ehGestor = usuarioAtivo ? !!usuarioAtivo.gestor : (funcionarios.length === 0 || !existeGestor);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Carrega (ou recarrega) todos os dados salvos — usado na abertura e no gesto de puxar p/ atualizar
  const carregarDados = async () => {
      let tiposCarregados = TIPOS_PADRAO;
      let diasTrabalhoCarregados = DIAS_TRABALHO_PADRAO;
      try {
        const cfg = await window.storage.get('config-laboratorio');
        if (cfg && cfg.value) {
          const parsed = JSON.parse(cfg.value);
          if (parsed.dentistas) {
            // Migração: dentistas antigos ganham campos de endereço e telefone
            setDentistas(parsed.dentistas.map(d => typeof d === 'string' ? { nome: d, endereco: '', telefone: '' } : { telefone: '', ...d }));
          }
          if (parsed.tiposTrabalho?.length > 0) {
            tiposCarregados = parsed.tiposTrabalho.map(t => {
              const padrao = TIPOS_PADRAO.find(p => p.nome === t.nome);
              return {
                tempoHoras: 2, comissao: 0, valor: 0,
                ...t,
                etapas: t.etapas || padrao?.etapas || [{ nome: 'Execução', horas: t.tempoHoras ?? 2, prova: false }],
              };
            });
            setTiposTrabalho(tiposCarregados);
          }
          if (parsed.horasDia) setHorasDia(parsed.horasDia);
          if (parsed.funcionarios) setFuncionarios(parsed.funcionarios);
          if (typeof parsed.autoAjuste === 'boolean') setAutoAjuste(parsed.autoAjuste);
          if (parsed.pessoas >= 1) setPessoas(parsed.pessoas);
          if (parsed.ajustesDia) setAjustesDiaState(parsed.ajustesDia);
          if (parsed.chavePix) setChavePix(parsed.chavePix);
          if (parsed.diasTrabalho?.length > 0) { diasTrabalhoCarregados = parsed.diasTrabalho; setDiasTrabalho(parsed.diasTrabalho); }
          if (parsed.horasPorDia?.length === 7) {
            setHorasPorDia(parsed.horasPorDia);
          } else {
            // Migração: constrói horários por dia a partir da jornada única antiga
            const hd = parsed.horasDia || HORAS_DIA_PADRAO;
            const dias = parsed.diasTrabalho?.length > 0 ? parsed.diasTrabalho : DIAS_TRABALHO_PADRAO;
            setHorasPorDia([0, 1, 2, 3, 4, 5, 6].map(d => dias.includes(d) ? hd : 0));
          }
        }
      } catch (e) { /* sem config ainda */ }
      try {
        const result = await window.storage.get('casos-laboratorio');
        if (result && result.value) {
          const lista = JSON.parse(result.value);
          const migrada = lista.map(c0 => {
            let c = c0;
            // Migração: status "Recebido" deixou de existir — todo caso no laboratório já está em produção
            if (c.status === 'Recebido') c = { ...c, status: 'Em Produção', dataProducao: c.dataProducao || c.dataEntrada || todayISO() };
            // Prazo em dia de folga → próximo dia de trabalho configurado
            if (c.status !== 'Entregue' && c.prazo && proximoDiaUtil(c.prazo, diasTrabalhoCarregados) !== c.prazo) c = { ...c, prazo: proximoDiaUtil(c.prazo, diasTrabalhoCarregados) };
            const tipo = tiposCarregados.find(t => t.nome === c.tipoTrabalho);
            if (!c.etapas?.length) {
              const etapas = etapasDoTipo(tipo).map(e => ({ ...e, concluida: false, dataConclusao: null }));
              return { ...c, etapas, naClinica: c.naClinica || false, provaPendente: c.provaPendente || false };
            }
            // Trabalho com vários itens criado antes das etapas por item (ou enviado por app antigo da clínica):
            // reconstrói as etapas já separadas por serviço — só quando nada foi iniciado (não perde progresso)
            if ((c.itens || []).length > 1
              && !c.etapas.some(e => e.item)
              && !c.etapas.some(e => e.concluida || e.inicioExec)
              && c.status === 'Em Produção') {
              const novas = etapasDeItens(tiposCarregados, c.itens.map(i => i.nome))
                .map(e => ({ ...e, concluida: false, dataConclusao: null, funcionario: null, duracaoMin: null, inicioExec: null }));
              if (novas.length) c = { ...c, etapas: novas };
            }
            // Sincroniza marcação de prova/horas das etapas ainda não concluídas com a configuração atual
            // (quando a etapa pertence a um item, usa a configuração do tipo daquele item)
            if (c.status !== 'Entregue') {
              const etapasSync = c.etapas.map(e => {
                const tRef = tiposCarregados.find(x => x.nome === (e.item || c.tipoTrabalho));
                const cfg = tRef?.etapas?.find(te => te.nome === e.nome);
                if (!cfg) return e;
                return e.concluida ? { ...e, prova: cfg.prova } : { ...e, prova: cfg.prova, horas: cfg.horas };
              });
              c = { ...c, etapas: etapasSync };
            }
            return { ...c, provaPendente: c.provaPendente || false };
          });
          window.__casosVivos = migrada;
          setCasos(migrada);
          // Persiste as migrações (prazos ajustados, provas sincronizadas) para não repetir a cada abertura
          if (JSON.stringify(migrada) !== JSON.stringify(lista)) {
            try { await window.storage.set('casos-laboratorio', JSON.stringify(migrada)); } catch (e2) { /* salva na próxima ação */ }
          }
        }
      } catch (e) { /* sem dados ainda */ }
      try {
        const sol = await window.storage.get('solicitacoes-clinica');
        if (sol && sol.value) setSolicitacoes(JSON.parse(sol.value));
      } catch (e) { /* sem pedidos ainda */ }
      try {
        const notif = await window.storage.get('notificacoes-laboratorio');
        if (notif && notif.value) setNotificacoes(JSON.parse(notif.value));
      } catch (e) { /* sem notificações */ }
      try {
        const ht = await window.storage.get('historico-tempos');
        if (ht && ht.value) setHistoricoTempos(JSON.parse(ht.value));
      } catch (e) { /* sem histórico */ }
      try {
        const cm = await window.storage.get('comissoes-registro');
        if (cm && cm.value) setComissoes(JSON.parse(cm.value));
      } catch (e) { /* sem comissões */ }
      try {
        const pg = await window.storage.get('pagamentos-registro');
        if (pg && pg.value) setPagamentos(JSON.parse(pg.value));
      } catch (e) { /* sem pagamentos */ }
      try {
        const ua = await window.storage.get('usuario-ativo');
        if (ua && ua.value) setUsuarioAtivoId(JSON.parse(ua.value));
      } catch (e) { /* sem usuário ativo */ }
      setLoading(false);
  };
  useEffect(() => { carregarDados(); }, []);

  const flashSave = async (fn) => {
    setSaveStatus('saving');
    try {
      await fn();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      return true;
    } catch (e) {
      console.error('Erro ao salvar', e);
      setSaveStatus('idle');
      return false;
    }
  };

  const persistCasos = (newCasos) => {
    // Lista viva fora do React: ações demoradas (upload grande) terminam depois de
    // outras gravações/remontagens — regravar a lista do render antigo apagava casos novos
    window.__casosVivos = newCasos;
    setCasos(newCasos);
    return flashSave(async () => {
      try {
        await window.storage.set('casos-laboratorio', JSON.stringify(newCasos));
      } catch (e) {
        // Falha ao gravar os casos NUNCA pode ser muda: registra na nuvem e avisa na tela
        const versaoApp = typeof __VERSAO_APP__ !== 'undefined' ? __VERSAO_APP__ : 'dev';
        if (window.nuvemCasos && window.nuvemCasos.logar) window.nuvemCasos.logar({ acao: 'erro-gravar-casos', resultado: String((e && e.message) || e).slice(0, 180), versao: versaoApp });
        alert('Não consegui salvar na nuvem — confira a internet e tente de novo.');
        throw e;
      }
    });
  };
  // Toda ação que GRAVA parte da lista viva, nunca da lista do render em que o botão
  // foi tocado — entre o toque e a gravação podem ter entrado casos novos de outra tela
  const casosVivos = () => window.__casosVivos || casos;
  const persistConfig = (patch) => {
    const novo = {
      dentistas: patch.dentistas ?? dentistas,
      tiposTrabalho: patch.tiposTrabalho ?? tiposTrabalho,
      horasDia: patch.horasDia ?? horasDia,
      funcionarios: patch.funcionarios ?? funcionarios,
      autoAjuste: patch.autoAjuste ?? autoAjuste,
      chavePix: patch.chavePix ?? chavePix,
      diasTrabalho: patch.diasTrabalho ?? diasTrabalho,
      horasPorDia: patch.horasPorDia ?? horasPorDia,
      pessoas: patch.pessoas ?? pessoas,
      ajustesDia: patch.ajustesDia ?? ajustesDia,
    };
    setDentistas(novo.dentistas);
    setTiposTrabalho(novo.tiposTrabalho);
    setHorasDia(novo.horasDia);
    setFuncionarios(novo.funcionarios);
    setAutoAjuste(novo.autoAjuste);
    setChavePix(novo.chavePix);
    setDiasTrabalho(novo.diasTrabalho);
    setHorasPorDia(novo.horasPorDia);
    setPessoas(novo.pessoas);
    setAjustesDiaState(novo.ajustesDia);
    flashSave(() => window.storage.set('config-laboratorio', JSON.stringify(novo)));
  };
  const persistNotificacoes = (novas) => {
    setNotificacoes(novas);
    flashSave(() => window.storage.set('notificacoes-laboratorio', JSON.stringify(novas)));
  };
  const persistHistorico = (novo) => {
    setHistoricoTempos(novo);
    flashSave(() => window.storage.set('historico-tempos', JSON.stringify(novo)));
  };
  const persistComissoes = (novas) => {
    setComissoes(novas);
    flashSave(() => window.storage.set('comissoes-registro', JSON.stringify(novas)));
  };
  const persistPagamentos = (novos) => {
    setPagamentos(novos);
    flashSave(() => window.storage.set('pagamentos-registro', JSON.stringify(novos)));
  };
  const registrarPagamento = (dentista, valor) => {
    const novo = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), dentista, valor, data: todayISO() };
    const novos = [novo, ...pagamentos].slice(0, 800);
    persistPagamentos(novos);
    const totalEntregue = casos.filter(c => c.status === 'Entregue' && c.dentista === dentista).reduce((s, c) => s + (c.valor || 0), 0);
    const totalPago = novos.filter(p => p.dentista === dentista).reduce((s, p) => s + p.valor, 0);
    const saldo = Math.max(0, totalEntregue - totalPago);
    criarNotificacao('pagamento', `Pagamento de ${formatReais(valor)} recebido de ${dentista}. Saldo em aberto: ${formatReais(saldo)}.`, null);
  };
  const removerPagamento = (id) => {
    persistPagamentos(pagamentos.filter(p => p.id !== id));
  };
  const trocarUsuario = (id) => {
    setUsuarioAtivoId(id);
    flashSave(() => window.storage.set('usuario-ativo', JSON.stringify(id)));
    setSeletorUsuarioAberto(false);
  };

  const persistSolicitacoes = (novas) => {
    setSolicitacoes(novas);
    return flashSave(() => window.storage.set('solicitacoes-clinica', JSON.stringify(novas)));
  };
  // Aceita um pedido da clínica: vira caso em produção, com os anexos enviados pelo dentista
  const aceitarSolicitacao = (s) => {
    const tipo = tiposTrabalho.find(t => t.nome === s.tipoTrabalho);
    const etapas = etapasDoTipo(tipo).map(e => ({ ...e, concluida: false, dataConclusao: null, funcionario: null, duracaoMin: null, inicioExec: null }));
    const hoje = todayISO();
    const prazo = proximoDiaUtil(addDias(hoje, tipo?.prazoDias ?? 5), diasTrabalho);
    const novo = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      paciente: s.paciente, dentista: s.dentista, tipoTrabalho: s.tipoTrabalho,
      material: s.material || '', dataEntrada: hoje, prazo, observacoes: s.obs || '',
      status: 'Em Produção', dataSaida: null, dataProducao: hoje, dataFinalizado: null,
      anexos: s.anexos || [], etapas, naClinica: false, provaPendente: false,
    };
    persistCasos([novo, ...casosVivos()]);
    persistSolicitacoes(solicitacoes.map(x => x.id === s.id ? { ...x, status: 'aceita', casoId: novo.id } : x));
    criarNotificacao('novo', `Pedido de ${s.dentista} aceito: ${s.paciente} (${s.tipoTrabalho}) entrou em produção.`, novo.id);
  };
  const recusarSolicitacao = (s) => {
    persistSolicitacoes(solicitacoes.map(x => x.id === s.id ? { ...x, status: 'recusada' } : x));
    criarNotificacao('etapa', `Pedido de ${s.dentista} (${s.paciente}) foi recusado.`, null);
  };

  const criarNotificacao = (icone, texto, casoId, chave) => {
    const nova = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), icone, texto, casoId, chave: chave || null, data: agoraISO(), lida: false };
    persistNotificacoes([nova, ...notificacoes].slice(0, 50));
    setToast({ icone, texto });
    setTimeout(() => setToast(null), 3500);
  };

  // Avisos automáticos ao abrir/sincronizar: trabalho novo enviado pela clínica
  // e arquivos aprovados pelo dentista (a chave evita repetir o mesmo aviso)
  useEffect(() => {
    if (loading) return;
    const limite = addDias(todayISO(), -1);
    const novas = [];
    const jaExiste = (chave) => notificacoes.some(n => n.chave === chave) || novas.some(n => n.chave === chave);
    casos.forEach(c => {
      if (c.origem === 'clinica' && (c.dataEntrada || '') >= limite) {
        const chave = `novo-${c.id}`;
        if (!jaExiste(chave)) novas.push({ icone: 'clinica', texto: `🆕 ${c.dentista} enviou um trabalho novo: ${c.paciente} (${c.tipoTrabalho}).`, casoId: c.id, chave });
      }
      (c.anexos || []).forEach(a => {
        if (a.aprovacao && a.aprovacao.status === 'aprovado') {
          const chave = `aprovado-${c.id}-${a.id}`;
          if (!jaExiste(chave)) novas.push({ icone: 'aprovado', texto: `${c.dentista} aprovou "${a.nome}" (${c.paciente}). ✓`, casoId: c.id, chave });
        }
      });
    });
    if (novas.length > 0) {
      const criadas = novas.map(n => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), icone: n.icone, texto: n.texto, casoId: n.casoId, chave: n.chave, data: agoraISO(), lida: false }));
      persistNotificacoes([...criadas, ...notificacoes].slice(0, 50));
      setToast({ icone: criadas[0].icone, texto: criadas[0].texto });
      setTimeout(() => setToast(null), 3500);
    }
  }, [loading, casos]);

  const marcarNotificacoesLidas = () => {
    if (notificacoes.some(n => !n.lida)) {
      persistNotificacoes(notificacoes.map(n => ({ ...n, lida: true })));
    }
  };

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const addCaso = (dados) => {
    const nomesItens = (dados.itens && dados.itens.length) ? dados.itens.map(i => i.nome) : [dados.tipoTrabalho];
    const etapas = etapasDeItens(tiposTrabalho, nomesItens).map(e => ({ ...e, concluida: false, dataConclusao: null, funcionario: null, duracaoMin: null, inicioExec: null }));
    const novo = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ...dados, status: 'Em Produção', dataSaida: null, dataProducao: dados.dataEntrada || todayISO(), dataFinalizado: null, anexos: dados.anexos || [], etapas, naClinica: false, provaPendente: false };
    persistCasos([novo, ...casosVivos()]);
    setView('lista');
  };
  const updateCaso = (id, patch, listaBase) => {
    const base = listaBase || casosVivos();
    return persistCasos(base.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  // "Foi pego ✓": confirma a retirada na clínica — o trabalho sai da caixa de retirada.
  // Vale para trabalho novo postado pelo dentista E para prova devolvida pela clínica.
  const confirmarRetirada = (id) => {
    const caso = casos.find(c => c.id === id);
    if (caso && caso.naClinica) {
      updateCaso(id, { naClinica: false, provaPendente: false, retornoSolicitado: null });
      criarNotificacao('novo', `Retorno confirmado: ${caso.paciente} voltou da clínica para o laboratório. ✓`, id);
    } else {
      updateCaso(id, { retiradoEm: agoraISO() });
      criarNotificacao('novo', `Retirada confirmada: ${caso ? caso.paciente : 'trabalho'} já está com o laboratório. ✓`, id);
    }
  };
  // Edita os itens de um trabalho já criado: recalcula rótulo, valor e etapas,
  // SEM perder o progresso das etapas já iniciadas ou concluídas
  const salvarItensCaso = (id, novosItens) => {
    const caso = casosVivos().find(c => c.id === id);
    if (!caso || !novosItens || novosItens.length === 0) return;
    const itensFinal = novosItens.map(i => {
      const t = tiposTrabalho.find(t => t.nome === i.nome);
      const unit = t?.valor || 0;
      return { nome: i.nome, quantidade: i.quantidade || 1, valorUnit: unit, subtotal: Math.round(unit * (i.quantidade || 1) * 100) / 100 };
    });
    const umSo = itensFinal.length === 1;
    const alvo = etapasDeItens(tiposTrabalho, itensFinal.map(i => i.nome));
    // Cada etapa pertence a um item — casa por item + nome da etapa.
    // Etapa antiga sem a tag "item" (caso aceito da clínica / migração) casa pelo nome,
    // senão salvar itens duplicava as etapas do trabalho e zerava o progresso.
    // Cada alvo é CONSUMIDO ao casar: dois itens com etapa de mesmo nome continuam contando dois.
    const chave = (e) => `${e.item || ''}|${e.nome}`;
    const alvosLivres = [...alvo];
    const consome = (idx) => idx === -1 ? null : alvosLivres.splice(idx, 1)[0];
    // 1º passo: casamento exato item|nome; 2º passo: etapa antiga sem tag pega um alvo livre de mesmo nome
    const pares = (caso.etapas || []).map(e => ({ e, cfg: consome(alvosLivres.findIndex(a => chave(a) === chave(e))) }));
    for (const p of pares) {
      if (!p.cfg && !p.e.item) p.cfg = consome(alvosLivres.findIndex(a => a.nome === p.e.nome));
    }
    // Mantém etapas com progresso (mesmo que o item tenha saído); atualiza config das não iniciadas; remove as não iniciadas que sobraram
    const mantidas = pares
      .filter(p => p.e.concluida || p.e.inicioExec || p.cfg)
      .map(p => (p.cfg && !p.e.concluida && !p.e.inicioExec) ? { ...p.e, horas: p.cfg.horas, prova: p.cfg.prova } : p.e);
    const novas = alvosLivres
      .map(e => ({ ...e, concluida: false, dataConclusao: null, funcionario: null, duracaoMin: null, inicioExec: null }));
    updateCaso(id, {
      itens: itensFinal,
      tipoTrabalho: umSo ? itensFinal[0].nome : rotuloItens(itensFinal),
      quantidade: umSo ? itensFinal[0].quantidade : 1,
      valor: Math.round(itensFinal.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
      etapas: [...mantidas, ...novas],
    });
    mostrarAviso('Itens do trabalho atualizados.');
  };
  const mostrarAviso = (texto) => {
    setToast({ icone: 'etapa', texto });
    setTimeout(() => setToast(null), 3500);
  };

  // Divide a comissão do tipo proporcionalmente entre quem executou as etapas (peso = horas)
  const registrarComissoes = (caso, etapasFinais) => {
    // Com vários itens, a comissão do trabalho é a soma das comissões de cada item
    const nomesTipos = (caso.itens && caso.itens.length) ? caso.itens.map(i => i.nome) : [caso.tipoTrabalho];
    const valorComissao = nomesTipos.reduce((s, n) => s + (tiposTrabalho.find(t => t.nome === n)?.comissao || 0), 0);
    if (!(valorComissao > 0)) return '';
    // TRAVA: comissão é registrada UMA única vez por trabalho — refinalizar após desfazer não duplica
    if (comissoes.some(c => c.casoId === caso.id)) {
      return ' Comissão deste trabalho já foi registrada antes — não foi duplicada.';
    }
    const participantes = {};
    let totalHorasFeitas = 0;
    (etapasFinais || []).forEach(e => {
      if (e.concluida && e.funcionarioId) {
        const peso = e.horas || 1;
        totalHorasFeitas += peso;
        if (!participantes[e.funcionarioId]) participantes[e.funcionarioId] = { nome: e.funcionario, horas: 0 };
        participantes[e.funcionarioId].horas += peso;
      }
    });
    const ids = Object.keys(participantes);
    let partes = [];
    if (ids.length === 0) {
      if (usuarioAtivo) partes = [{ funcionarioId: usuarioAtivo.id, funcionario: usuarioAtivo.nome, valor: valorComissao, pct: 100 }];
    } else {
      let acumulado = 0;
      partes = ids.map((fid, idx) => {
        const fracao = participantes[fid].horas / totalHorasFeitas;
        const pct = Math.round(fracao * 100);
        let v = idx === ids.length - 1
          ? Math.round((valorComissao - acumulado) * 100) / 100
          : Math.round(valorComissao * fracao * 100) / 100;
        acumulado += v;
        return { funcionarioId: fid, funcionario: participantes[fid].nome, valor: v, pct };
      });
    }
    if (partes.length === 0) return '';
    const novosRegistros = partes.map((p, i) => ({
      id: Date.now().toString(36) + i, casoId: caso.id, paciente: caso.paciente, tipoTrabalho: caso.tipoTrabalho,
      valor: p.valor, participacao: p.pct, funcionarioId: p.funcionarioId, funcionario: p.funcionario, data: todayISO(),
    }));
    persistComissoes([...novosRegistros, ...comissoes].slice(0, 500));
    return partes.length === 1
      ? ` Comissão de ${formatReais(partes[0].valor)} para ${partes[0].funcionario}.`
      : ` Comissão de ${formatReais(valorComissao)} dividida: ${partes.map(p => `${p.funcionario} ${formatReais(p.valor)} (${p.pct}%)`).join(', ')}.`;
  };

  const updateStatus = (id, novoStatus) => {
    const caso = casosVivos().find(c => c.id === id);
    if (!caso || caso.status === novoStatus) return;
    // Trava: só finaliza com todas as etapas concluídas (vale também pro "Entregue" direto,
    // que pulava o "Pronto" e deixava o trabalho sem comissão e fora do fechamento do mês)
    const pulouPronto = novoStatus === 'Entregue' && caso.status !== 'Pronto';
    if ((novoStatus === 'Pronto' || pulouPronto) && !etapasCompletas(caso)) {
      const feitas = caso.etapas.filter(e => e.concluida).length;
      mostrarAviso(`Conclua todas as etapas antes de finalizar (${feitas}/${caso.etapas.length}).`);
      return;
    }
    const patch = { status: novoStatus };
    if (novoStatus === 'Em Produção' && !caso.dataProducao) patch.dataProducao = todayISO();
    if (novoStatus === 'Pronto' || pulouPronto) {
      // No Entregue direto preserva a data de finalização original (se houver); sempre limpa as bandeiras
      patch.dataFinalizado = novoStatus === 'Pronto' ? todayISO() : (caso.dataFinalizado || todayISO());
      patch.naClinica = false;
      patch.provaPendente = false;
    }
    patch.dataSaida = novoStatus === 'Entregue' ? todayISO() : null;
    updateCaso(id, patch);

    const nome = `${caso.paciente} (${caso.tipoTrabalho})`;
    if (novoStatus === 'Em Produção') {
      criarNotificacao('producao', `${nome} entrou em produção.`, id);
    } else if (novoStatus === 'Pronto') {
      const antesDoPrazo = diasRestantes(caso.prazo) > 0;
      const msgComissao = registrarComissoes(caso, caso.etapas || []);
      criarNotificacao('pronto', `${nome} foi finalizado${antesDoPrazo ? ' antes do prazo' : ''}!${msgComissao}`, id);
    } else if (novoStatus === 'Entregue') {
      const msgComissao = pulouPronto ? registrarComissoes(caso, caso.etapas || []) : '';
      criarNotificacao('entregue', `${nome} foi entregue.${msgComissao}`, id);
    }
  };

  // ── Cronômetro de etapas ──
  const iniciarEtapa = (casoId, indice) => {
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso?.etapas) return;
    const primeiraAtividade = !caso.etapas.some(e => e.concluida || e.inicioExec);
    const estavaFora = caso.naClinica || caso.provaPendente;
    const etapa = caso.etapas[indice];
    const novasEtapas = caso.etapas.map((e, i) => i === indice ? { ...e, inicioExec: agoraISO(), funcionario: usuarioAtivo?.nome || null, funcionarioId: usuarioAtivo?.id || null } : e);
    // Iniciar uma etapa = o trabalho está na bancada → retorno automático da clínica/fila de entrega
    updateCaso(casoId, { etapas: novasEtapas, naClinica: false, provaPendente: false });
    if (estavaFora) {
      criarNotificacao('retorno', `${caso.paciente} (${caso.tipoTrabalho}) retornou ao laboratório — "${etapa.nome}" iniciada${usuarioAtivo ? ` por ${usuarioAtivo.nome}` : ''}.`, casoId);
    } else if (primeiraAtividade) {
      // Primeiro "Iniciar" do trabalho → hora de avisar o dentista que a produção começou
      criarNotificacao('producao', `${caso.paciente} (${caso.tipoTrabalho}) iniciado${usuarioAtivo ? ` por ${usuarioAtivo.nome}` : ''} — avise o dentista ${caso.dentista}.`, casoId);
    }
  };
  const cancelarEtapa = (casoId, indice) => {
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso?.etapas) return;
    updateCaso(casoId, { etapas: caso.etapas.map((e, i) => i === indice ? { ...e, inicioExec: null } : e) });
  };
  const concluirEtapa = (casoId, indice) => {
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso?.etapas) return;
    const etapa = caso.etapas[indice];
    let duracaoMin = null;
    if (etapa.inicioExec) {
      duracaoMin = Math.max(1, Math.round((new Date() - new Date(etapa.inicioExec)) / 60000));
      // Alimenta o banco de tempos reais
      // Trabalho com vários itens: o tempo real conta para o TIPO do item da etapa, não para o rótulo do trabalho
      const tipoDaEtapa = etapa.item || caso.tipoTrabalho;
      const registro = { tipo: tipoDaEtapa, etapa: etapa.nome, minutos: duracaoMin, funcionario: etapa.funcionario || usuarioAtivo?.nome || null, data: todayISO() };
      const novoHistorico = [registro, ...historicoTempos].slice(0, 500);
      persistHistorico(novoHistorico);
      // Autorregulação: com o modo ligado e 3+ registros, a estimativa da etapa segue a média real
      if (autoAjuste) {
        const doMesmo = novoHistorico.filter(h => h.tipo === tipoDaEtapa && h.etapa === etapa.nome);
        if (doMesmo.length >= 3) {
          const mediaMin = doMesmo.reduce((s, h) => s + h.minutos, 0) / doMesmo.length;
          const mediaHoras = Math.max(0.25, Math.round((mediaMin / 60) * 4) / 4);
          const tipoCfg = tiposTrabalho.find(t => t.nome === tipoDaEtapa);
          const etapaCfg = tipoCfg?.etapas?.find(et => et.nome === etapa.nome);
          if (etapaCfg && Math.abs(etapaCfg.horas - mediaHoras) >= 0.25) {
            persistConfig({ tiposTrabalho: tiposTrabalho.map(t => t.nome !== tipoDaEtapa ? t : { ...t, etapas: t.etapas.map(et => et.nome === etapa.nome ? { ...et, horas: mediaHoras } : et) }) });
          }
        }
      }
    }
    const executor = etapa.funcionario || usuarioAtivo?.nome || null;
    const executorId = etapa.funcionarioId || usuarioAtivo?.id || null;
    const novasEtapas = caso.etapas.map((e, i) => i === indice ? { ...e, concluida: true, dataConclusao: todayISO(), inicioExec: null, duracaoMin, funcionario: executor, funcionarioId: executorId } : e);
    const todasConcluidas = novasEtapas.every(e => e.concluida);

    const patch = { etapas: novasEtapas };
    const nome = `${caso.paciente} (${caso.tipoTrabalho})`;
    const quemFez = executor ? ` por ${executor}` : '';
    const tempoTxt = duracaoMin ? ` em ${formatMinutos(duracaoMin)}` : '';

    if (todasConcluidas) {
      // Última etapa concluída → finaliza AUTOMATICAMENTE e vai para a ENTREGA FINAL
      patch.status = 'Pronto';
      patch.dataFinalizado = todayISO();
      patch.naClinica = false;
      patch.provaPendente = false;
      // Telemetria: registra a virada para Pronto ANTES de gravar (diagnóstico de longe)
      if (window.nuvemCasos && window.nuvemCasos.logar) {
        window.nuvemCasos.logar({ acao: 'virou-pronto', casoId, versao: typeof __VERSAO_APP__ !== 'undefined' ? __VERSAO_APP__ : 'dev' });
      }
      updateCaso(casoId, patch);
      const antesDoPrazo = diasRestantes(caso.prazo) > 0;
      const msgComissao = registrarComissoes(caso, novasEtapas);
      criarNotificacao('pronto', `Última etapa concluída${quemFez}${tempoTxt} — ${nome} FINALIZADO${antesDoPrazo ? ' antes do prazo' : ''} e pronto para ENTREGA!${msgComissao}`, casoId);
    } else {
      // QUALQUER etapa concluída → o trabalho vai AUTOMATICAMENTE para a fila de entrega (levar à clínica)
      patch.provaPendente = true;
      patch.naClinica = false;
      updateCaso(casoId, patch);
      criarNotificacao('clinica', `"${etapa.nome}" concluída${quemFez}${tempoTxt} — ${nome} aguardando ENTREGA na clínica de ${caso.dentista}. Veja em Entregas.`, casoId);
    }
  };
  const desfazerEtapa = (casoId, indice) => {
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso?.etapas) return;
    updateCaso(casoId, { etapas: caso.etapas.map((e, i) => i === indice ? { ...e, concluida: false, dataConclusao: null, duracaoMin: null } : e) });
  };

  const toggleClinica = (casoId) => {
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso) return;
    const indo = !caso.naClinica;
    updateCaso(casoId, { naClinica: indo, provaPendente: false, retornoSolicitado: null });
    const nome = `${caso.paciente} (${caso.tipoTrabalho})`;
    if (indo) {
      const et = etapaAtual(caso);
      criarNotificacao('clinica', `${nome} foi enviado para prova na clínica de ${caso.dentista}${et ? ` (${et.nome})` : ''}.`, casoId);
    } else {
      criarNotificacao('retorno', `${nome} retornou da clínica ao laboratório.`, casoId);
    }
  };
  // Confirma que a prova saiu do laboratório e foi entregue na clínica
  const entregarProva = (casoId) => {
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso) return;
    updateCaso(casoId, { provaPendente: false, naClinica: true });
    criarNotificacao('clinica', `${caso.paciente} (${caso.tipoTrabalho}) entregue na clínica de ${caso.dentista} para prova.`, casoId);
  };
  const adiarUmDia = (id) => {
    const caso = casosVivos().find(c => c.id === id);
    if (!caso) return;
    const baseData = diasRestantes(caso.prazo) < 0 ? todayISO() : caso.prazo;
    const novoPrazo = proximoDiaUtil(addDias(baseData, 1), diasTrabalho);
    updateCaso(id, { prazo: novoPrazo });
    criarNotificacao('reagendado', `${caso.paciente} (${caso.tipoTrabalho}) foi reagendado para ${formatDateBR(novoPrazo)}.`, id);
  };
  // Capacidade sob medida de um dia específico (horas/pessoas só daquela data);
  // patch null volta ao padrão. Datas com mais de 60 dias são limpas automaticamente.
  const setAjusteDoDia = (data, patch) => {
    const limite = addDias(todayISO(), -60);
    const novo = {};
    for (const [k, v] of Object.entries(ajustesDia || {})) if (k >= limite) novo[k] = v;
    if (patch === null) delete novo[data];
    else novo[data] = { ...(novo[data] || {}), ...patch };
    persistConfig({ ajustesDia: novo });
  };

  // Mover um trabalho para uma data escolhida no calendário (aba Datas)
  const mudarPrazoParaDia = (id, data) => {
    const caso = casosVivos().find(c => c.id === id);
    if (!caso || !data) return;
    const novoPrazo = proximoDiaUtil(data, diasTrabalho);
    updateCaso(id, { prazo: novoPrazo });
    criarNotificacao('reagendado', `${caso.paciente} (${caso.tipoTrabalho}) foi movido para ${formatDateBR(novoPrazo)}.`, id);
  };
  const deleteCaso = async (id) => {
    const versaoApp = typeof __VERSAO_APP__ !== 'undefined' ? __VERSAO_APP__ : 'dev';
    const caso = casosVivos().find(c => c.id === id);
    if (caso?.anexos?.length) {
      for (const a of caso.anexos) {
        // Formato novo (arquivo no Storage com caminho) e formato antigo (dataURL no banco)
        if (a.caminho && window.arquivos) { try { await window.arquivos.apagar(a.caminho); } catch (e) { /* já removido */ } }
        else { try { await window.storage.delete(`anexo-${a.id}`); } catch (e) { /* já removido */ } }
      }
    }
    const ok = await persistCasos(casosVivos().filter(c => c.id !== id));
    if (window.nuvemCasos && window.nuvemCasos.logar) {
      window.nuvemCasos.logar({ acao: 'excluir-caso', casoId: id, paciente: (caso && caso.paciente) || '', resultado: ok ? 'ok' : 'erro ao gravar', versao: versaoApp });
    }
    if (!ok) {
      // Antes a falha era muda: o trabalho sumia da tela e voltava depois. Agora avisa.
      alert('Não consegui excluir na nuvem — confira a internet e tente de novo.');
      carregarDados();
      return;
    }
    setSelectedId(null);
    setView(origemDetalhe && origemDetalhe !== 'detalhe' ? origemDetalhe : 'lista');
    setConfirmandoExclusao(false);
  };

  // Anexo novo vai pro armazém de arquivos (rápido, binário); o banco guarda só o link.
  // Sem armazém disponível, cai no formato antigo (dataURL no banco).
  const addAnexo = async (casoId, { nome, mime, categoria, blob, dataURL, tamanho, aoProgresso }) => {
    const anexoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    let meta = { id: anexoId, nome, mime, categoria, tamanho };
    if (window.arquivos && (blob || dataURL)) {
      const dados = blob || dataURLparaBlob(dataURL, mime);
      const { url, caminho } = await window.arquivos.subir(dados, nome, aoProgresso);
      meta = { ...meta, url, caminho };
    } else {
      await window.storage.set(`anexo-${anexoId}`, JSON.stringify({ nome, mime, dataURL }));
    }
    // Busca o caso na lista VIVA: o upload pode ter demorado minutos e a lista do render antigo está velha
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso) throw new Error('Falha ao salvar');
    const ok = await updateCaso(casoId, { anexos: [...(caso.anexos || []), meta] });
    if (!ok) throw new Error('Falha ao salvar');
  };
  // Aceita o OBJETO do anexo (novo formato, com url) ou o id (formato antigo no banco)
  const getAnexoData = async (anexo) => {
    if (anexo && anexo.url) return { nome: anexo.nome, mime: anexo.mime, url: anexo.url };
    const id = typeof anexo === 'string' ? anexo : anexo.id;
    const r = await window.storage.get(`anexo-${id}`);
    return r && r.value ? JSON.parse(r.value) : null;
  };
  const removeAnexo = async (casoId, anexoId) => {
    const caso = casosVivos().find(c => c.id === casoId);
    const anexo = (caso?.anexos || []).find(a => a.id === anexoId);
    if (anexo?.caminho && window.arquivos) window.arquivos.apagar(anexo.caminho);
    else { try { await window.storage.delete(`anexo-${anexoId}`); } catch (e) { /* já removido */ } }
    updateCaso(casoId, { anexos: (caso.anexos || []).filter(a => a.id !== anexoId) });
  };
  // Atualiza dados de um anexo (ex.: pedido/situação de aprovação do dentista).
  // Grava DIRETO o caso na nuvem e AVISA se falhar — o pedido de aprovação é o
  // que dispara a notificação no celular do dentista, não pode se perder calado.
  const atualizarAnexoMeta = async (casoId, anexoId, patch) => {
    const versaoApp = typeof __VERSAO_APP__ !== 'undefined' ? __VERSAO_APP__ : 'dev';
    const ehPedido = patch && patch.aprovacao && patch.aprovacao.status === 'pendente';
    // Registra o TOQUE antes de qualquer gravação: mesmo que tudo falhe depois,
    // a nuvem fica sabendo que o botão foi tocado e por qual versão do app
    if (ehPedido && window.nuvemCasos && window.nuvemCasos.logar) {
      window.nuvemCasos.logar({ acao: 'toque-pedir-aprovacao', casoId, anexoId, versao: versaoApp });
    }
    const caso = casosVivos().find(c => c.id === casoId);
    if (!caso) {
      if (window.nuvemCasos && window.nuvemCasos.logar) window.nuvemCasos.logar({ acao: 'pedir-aprovacao', casoId, resultado: 'erro: caso não encontrado', versao: versaoApp });
      return false;
    }
    const anexoAlvo = (caso.anexos || []).find(a => a.id === anexoId);
    if (!anexoAlvo) {
      if (window.nuvemCasos && window.nuvemCasos.logar) window.nuvemCasos.logar({ acao: 'pedir-aprovacao', casoId, anexoId, resultado: 'erro: anexo não encontrado no caso', versao: versaoApp });
      alert('Não encontrei este arquivo no trabalho. Feche e abra o trabalho de novo e tente outra vez.');
      return false;
    }
    const atualizado = { ...caso, anexos: (caso.anexos || []).map(a => a.id === anexoId ? { ...a, ...patch } : a) };
    const novaLista = casosVivos().map(c => c.id === casoId ? atualizado : c);
    window.__casosVivos = novaLista;
    setCasos(novaLista);
    setSaveStatus('saving');
    try {
      const anexoNome = anexoAlvo.nome || '';
      // Canal RESERVA PRIMEIRO: o carteiro na nuvem usa este doc pra deduplicar — se o caso
      // for gravado antes, a função do caso não encontra o aviso e o dentista recebe em dobro
      if (ehPedido && window.nuvemCasos && window.nuvemCasos.avisarAprovacao) {
        await window.nuvemCasos.avisarAprovacao({ casoId, dentista: caso.dentista, paciente: caso.paciente, anexoNome });
      }
      if (window.nuvemCasos && window.nuvemCasos.salvarCaso) await window.nuvemCasos.salvarCaso(atualizado);
      else await window.storage.set('casos-laboratorio', JSON.stringify(novaLista));
      if (window.nuvemCasos && window.nuvemCasos.logar) window.nuvemCasos.logar({ acao: ehPedido ? 'pedir-aprovacao' : 'anexo-meta', casoId, anexoNome, resultado: 'ok', versao: versaoApp });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      if (ehPedido) alert('Pedido de aprovação enviado ✓\nO dentista recebe o aviso no celular agora.');
      return true;
    } catch (e) {
      console.error('salvar anexo', e);
      if (window.nuvemCasos && window.nuvemCasos.logar) window.nuvemCasos.logar({ acao: 'pedir-aprovacao', casoId, resultado: 'erro: ' + String((e && e.message) || e).slice(0, 180), versao: versaoApp });
      setSaveStatus('idle');
      alert('Não consegui salvar na nuvem — confira a internet e toque de novo.');
      return false;
    }
  };

  // Tocar na notificação da barra → abre direto o trabalho (casoId vem no aviso).
  // Se o app estava fechado, o id fica guardado e abre assim que os casos carregarem.
  useEffect(() => {
    const abrirDoPush = (id) => {
      if (id && casos.some(c => c.id === id)) {
        window.__casoPushPendente = null;
        goToDetalhe(id);
      }
    };
    const ouvir = (e) => abrirDoPush(e.detail);
    window.addEventListener('abrir-caso-push', ouvir);
    if (window.__casoPushPendente) abrirDoPush(window.__casoPushPendente);
    return () => window.removeEventListener('abrir-caso-push', ouvir);
  }, [casos]);

  const goToDetalhe = (id) => {
    // Guarda de onde veio, para o "Voltar" retornar à mesma tela (Finanças, Equipe, Entregas, Dia...)
    if (view !== 'detalhe') setOrigemDetalhe(view);
    setSelectedId(id);
    setView('detalhe');
    setConfirmandoExclusao(false);
  };
  const abrirFiltroRapido = (chave) => {
    if (chave === 'hoje') { setDiaSelecionado('hoje'); setView('dia'); return; }
    if (chave === 'amanha') { setDiaSelecionado('amanha'); setView('dia'); return; }
    if (chave === 'pronto') { setView('entregas'); return; }
    setFiltroRapido(chave);
    setFiltroStatus('Todos');
    setFiltroDentista('Todos');
    setBusca('');
    setView('lista');
  };

  // Deslizar da borda esquerda: fecha o que estiver por cima ou volta uma tela
  useGestoVoltar(() => {
    if (iaAberta) { setIaAberta(false); return; }
    if (perguntasAbertas) { setPerguntasAbertas(false); return; }
    if (imprimindoCasoId) { setImprimindoCasoId(null); return; }
    if (seletorUsuarioAberto) { setSeletorUsuarioAberto(false); return; }
    if (view === 'detalhe') { setView(origemDetalhe && origemDetalhe !== 'detalhe' ? origemDetalhe : 'lista'); setConfirmandoExclusao(false); return; }
    if (view === 'novo') { setView('lista'); return; }
    if (view !== 'dashboard') { setView('dashboard'); return; }
    return false;
  });

  const selectedCaso = casos.find(c => c.id === selectedId);
  const casosFiltrados = casos
    .filter(c => (busca === '' || c.paciente.toLowerCase().includes(busca.toLowerCase()) || c.dentista.toLowerCase().includes(busca.toLowerCase()) || String(c.id).toLowerCase().includes(busca.trim().toLowerCase())))
    .filter(c => filtroStatus === 'Todos' || c.status === filtroStatus)
    .filter(c => filtroDentista === 'Todos' || c.dentista === filtroDentista)
    .filter(c => !filtroRapido || FILTROS_RAPIDOS[filtroRapido].teste(c))
    // Para retirada: ordem de CHEGADA (o que acabou de entrar vem primeiro); demais listas por prazo
    .sort((a, b) => filtroRapido === 'retirada'
      ? String(b.id).localeCompare(String(a.id))
      : a.prazo.localeCompare(b.prazo));

  const emAndamento = casos.filter(c => c.status !== 'Entregue');
  const producaoAtiva = emAndamento.filter(emProducao);
  const naClinicaLista = emAndamento.filter(c => c.naClinica);
  const provasPendentes = emAndamento.filter(c => c.provaPendente && !c.naClinica);
  const atrasados = emAndamento.filter(c => getUrgencia(c) === 'atrasado');
  const trabalhoHoje = emAndamento
    .filter(c => c.status !== 'Pronto' && !c.naClinica && !c.provaPendente && diasRestantes(c.prazo) <= 0)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  // Para retirada: trabalho novo postado pelo dentista OU prova que o dentista devolveu
  const paraRetirada = emAndamento.filter(c => aguardandoRetirada(c) || (c.naClinica && c.retornoSolicitado));
  const trabalhoAmanha = emAndamento
    .filter(c => c.status !== 'Pronto' && !c.naClinica && !c.provaPendente && diasRestantes(c.prazo) === 1)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const prontos = casos.filter(c => c.status === 'Pronto');
  const proximosPrazos = [...emAndamento].sort((a, b) => a.prazo.localeCompare(b.prazo)).slice(0, 5);
  const somaHorasRestantes = (lista) => lista.reduce((s, c) => s + tempoRestante(c, tiposTrabalho), 0);

  // Trabalhos que entraram HOJE — para compartilhar por WhatsApp ou baixar em PDF
  const adicionadosHoje = casos.filter(c => c.dataEntrada === todayISO());
  const compartilharAdicionadosHoje = async (baixarDireto) => {
    try {
      const img = desenharTrabalhosDeHoje({ casos: adicionadosHoje });
      const pdf = jpegParaPDF(img);
      const nomeArq = `trabalhos-adicionados-${todayISO()}.pdf`;
      const file = new File([pdf], nomeArq, { type: 'application/pdf' });
      if (!baixarDireto && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Trabalhos adicionados hoje' });
        return;
      }
      const u = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = u; a.download = nomeArq;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 5000);
      if (baixarDireto) mostrarAviso('PDF baixado ✓');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.error(e);
      mostrarAviso('Não consegui gerar o PDF. Tente de novo.');
    }
  };

  const fontStack = { fontFamily: "'Manrope', system-ui, sans-serif" };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-stone-50" style={{ minHeight: '600px', ...fontStack }}>
        <div className="text-stone-400 text-sm">Carregando...</div>
      </div>
    );
  }

  const tituloView =
    view === 'dashboard' ? 'Visão Geral'
    : view === 'lista' ? (filtroRapido ? FILTROS_RAPIDOS[filtroRapido].titulo : 'Casos')
    : view === 'dia' ? (diaSelecionado === 'hoje' ? 'Para Hoje' : diaSelecionado === 'amanha' ? 'Para Amanhã' : 'Agenda do Mês')
    : view === 'entregas' ? 'Prontos p/ Entrega'
    : view === 'novo' ? 'Novo Caso'
    : view === 'detalhe' ? 'Detalhes do Caso'
    : view === 'ajustes' ? 'Ajustes'
    : view === 'notificacoes' ? 'Notificações'
    : view === 'equipe' ? 'Relatório da Equipe'
    : view === 'meu' ? 'Meu Desempenho'
    : view === 'financas' ? 'Finanças'
    : '';

  return (
    <div className="flex flex-col mx-auto bg-stone-50 w-full max-w-[440px] lg:max-w-none" style={{ minHeight: '100vh', ...fontStack }}>
      <style>{`
        @keyframes pulseGold { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .pulse-gold { animation: pulseGold 1.6s ease-in-out infinite; }
        @keyframes slideDown { from { transform: translateY(-16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .toast-anim { animation: slideDown 0.25s ease-out; }
      `}</style>

      {/* ─── Barra superior (somente computador) ─── */}
      <div className="hidden lg:flex items-center px-6 no-print sticky top-0 z-40" style={{ background: INK, height: '58px' }}>
        <div className="flex items-center" style={{ gap: '9px' }}>
          <EstrelaLogo size={13} color={GOLD} />
          <span className="text-white" style={{ fontWeight: 300, fontSize: '15px', letterSpacing: '0.3em' }}>SPECIAL</span>
        </div>
        <div className="flex items-center h-full mx-auto">
          {[
            ['dashboard', 'Início', Home],
            ['lista', 'Casos', ClipboardList],
            ['novo', 'Novo', Plus],
            ['dia', 'Dia', CalendarClock],
            [ehGestor && funcionarios.length > 0 ? 'equipe' : 'meu', ehGestor && funcionarios.length > 0 ? 'Equipe' : 'Meu', BarChart3],
            ...(ehGestor ? [['financas', 'Finanças', TrendingUp]] : []),
            ['ajustes', 'Ajustes', Settings],
          ].map(([id, rotulo, Icone]) => {
            const ativo = view === id;
            return (
              <button key={id}
                onClick={() => { if (id === 'lista') { setFiltroRapido(null); setFiltroStatus('Todos'); setFiltroDentista('Todos'); setBusca(''); } setView(id); }}
                className="flex items-center gap-2 px-5 h-full text-sm font-bold"
                style={{ color: ativo ? GOLD : '#A8A29E', borderBottom: ativo ? `2.5px solid ${GOLD}` : '2.5px solid transparent', background: 'transparent' }}>
                <Icone size={16} /> {rotulo}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs" style={{ color: GOLD_SOFT }}>
            {saveStatus === 'saving' && 'salvando...'}
            {saveStatus === 'saved' && 'salvo ✓'}
          </div>
          <button onClick={() => setSeletorUsuarioAberto(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <User size={13} color={GOLD} />
            <span className="text-xs font-bold text-white max-w-24 truncate">{usuarioAtivo ? usuarioAtivo.nome.split(' ')[0] : 'Entrar'}</span>
          </button>
          <button onClick={() => setView('notificacoes')} className="relative p-1">
            <Bell size={19} color={view === 'notificacoes' ? GOLD : '#D6D3D1'} />
            {naoLidas > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-white flex items-center justify-center" style={{ background: '#DC2626', fontSize: '10px', fontWeight: 700 }}>
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-5 pt-6 pb-4 lg:hidden" style={{ background: INK }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center" style={{ gap: '7px' }}>
              <EstrelaLogo size={11} color={GOLD} />
              <span className="text-xs" style={{ color: 'white', fontWeight: 300, letterSpacing: '0.34em' }}>SPECIAL</span>
            </div>
            <h1 className="text-white text-xl font-bold mt-0.5">{tituloView}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-xs" style={{ color: GOLD_SOFT }}>
              {saveStatus === 'saving' && 'salvando...'}
              {saveStatus === 'saved' && 'salvo ✓'}
            </div>
            <button onClick={() => setSeletorUsuarioAberto(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <User size={13} color={GOLD} />
              <span className="text-xs font-bold text-white max-w-16 truncate">{usuarioAtivo ? usuarioAtivo.nome.split(' ')[0] : 'Entrar'}</span>
            </button>
            <button onClick={() => setView('notificacoes')} className="relative p-1">
              <Bell size={20} color={view === 'notificacoes' ? GOLD : '#D6D3D1'} />
              {naoLidas > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-white flex items-center justify-center" style={{ background: '#DC2626', fontSize: '10px', fontWeight: 700 }}>
                  {naoLidas > 9 ? '9+' : naoLidas}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast-anim fixed top-3 left-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg" style={{ transform: 'translateX(-50%)', background: INK, maxWidth: '400px', width: 'calc(100% - 32px)' }}>
          <NotifIcone tipo={toast.icone} size={16} />
          <span className="text-white text-xs font-medium flex-1">{toast.texto}</span>
        </div>
      )}

      {iaAberta && <IASpecialLab aoFechar={() => setIaAberta(false)} />}
      {perguntasAbertas && <PerguntasIALab aoFechar={() => setPerguntasAbertas(false)} nomeUsuario={typeof usuarioAtivo === 'string' ? usuarioAtivo : (usuarioAtivo && usuarioAtivo.nome) || ''} />}
      {seletorUsuarioAberto && (
        <SeletorUsuario funcionarios={funcionarios} usuarioAtivoId={usuarioAtivoId}
          onTrocar={trocarUsuario} onFechar={() => setSeletorUsuarioAberto(false)}
          onIrParaAjustes={() => { setSeletorUsuarioAberto(false); setView('ajustes'); }} />
      )}

      <div className="flex-1 px-5 pt-5 w-full lg:max-w-[1200px] lg:mx-auto lg:px-10 lg:pt-6" style={{ paddingBottom: '96px' }}>
        <div className="hidden lg:block pb-4">
          <h1 className="text-2xl font-extrabold" style={{ color: INK }}>{tituloView}</h1>
        </div>
        {view === 'dashboard' && (
          <>
          <PedidosClinica solicitacoes={solicitacoes} onAceitar={aceitarSolicitacao} onRecusar={recusarSolicitacao} />
          <DashboardView
            onAbrirIA={() => setIaAberta(true)}
            onAbrirPerguntas={() => setPerguntasAbertas(true)}
            producaoAtiva={producaoAtiva.length} prontos={prontos.length}
            naClinica={naClinicaLista.length} provasLevar={provasPendentes.length}
            atrasados={atrasados.length}
            paraHoje={trabalhoHoje.length} horasHoje={somaHorasRestantes(trabalhoHoje)}
            paraRetirada={paraRetirada.length} dentistasRetirada={[...new Set(paraRetirada.map(c => c.dentista))].length}
            proximosPrazos={proximosPrazos} onSelect={goToDetalhe} onNovo={() => setView('novo')}
            adicionadosHoje={adicionadosHoje.length}
            onCompartilharHoje={compartilharAdicionadosHoje}
            onFiltro={abrirFiltroRapido}
            ehGestor={ehGestor} temFuncionarios={funcionarios.length > 0}
            usuarioAtivo={usuarioAtivo}
            onAbrirEquipe={() => setView('equipe')}
            onAbrirMeu={() => setView('meu')}
            onAbrirFinancas={() => setView('financas')}
          />
          </>
        )}
        {view === 'lista' && (
          <ListaView casos={casosFiltrados} busca={busca} setBusca={setBusca}
            filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
            dentistas={dentistas} filtroDentista={filtroDentista} setFiltroDentista={setFiltroDentista}
            filtroRapido={filtroRapido} onLimparFiltroRapido={() => setFiltroRapido(null)}
            getEndereco={(nome) => enderecoDe(dentistas, nome)}
            onSelect={goToDetalhe}
            onConfirmarRetirada={confirmarRetirada}
            onLerEtiqueta={() => setLendoEtiqueta(true)} />
        )}
        {view === 'dia' && (
          <DiaView
            dia={diaSelecionado} setDia={setDiaSelecionado}
            casosHoje={trabalhoHoje} casosAmanha={trabalhoAmanha}
            casosAgenda={emAndamento}
            tiposTrabalho={tiposTrabalho} horasDia={horasDia} horasPorDia={horasPorDia} diasTrabalho={diasTrabalho} pessoas={pessoas}
            ajustesDia={ajustesDia} onSetAjusteDia={setAjusteDoDia}
            onMudarPrazo={mudarPrazoParaDia}
            onSelect={goToDetalhe}
            onFinalizar={(id) => updateStatus(id, 'Pronto')}
            onIniciarProducao={(id) => updateStatus(id, 'Em Produção')}
            onAdiar={adiarUmDia} />
        )}
        {view === 'entregas' && (
          <EntregasView casos={prontos} provasLevar={provasPendentes} provasNaClinica={naClinicaLista}
            getEndereco={(nome) => enderecoDe(dentistas, nome)}
            getTelefone={(nome) => dentistas.find(d => d.nome === nome)?.telefone || ''}
            onSelect={goToDetalhe}
            onEntregarProva={(id) => entregarProva(id)}
            onRetornou={(id) => toggleClinica(id)}
            onEntregar={(id) => updateStatus(id, 'Entregue')} />
        )}
        {view === 'novo' && (
          <NovoCasoForm onSalvar={addCaso} onCancelar={() => setView('lista')} dentistas={dentistas} tiposTrabalho={tiposTrabalho} ehGestor={ehGestor} diasTrabalho={diasTrabalho} onIrParaAjustes={() => setView('ajustes')} />
        )}
        {view === 'detalhe' && selectedCaso && (
          <DetalheView
            caso={selectedCaso}
            endereco={enderecoDe(dentistas, selectedCaso.dentista)}
            horasRestantes={tempoRestante(selectedCaso, tiposTrabalho)}
            usuarioAtivo={usuarioAtivo}
            onVoltar={() => { setView(origemDetalhe && origemDetalhe !== 'detalhe' ? origemDetalhe : 'lista'); setConfirmandoExclusao(false); }}
            onStatusChange={(s) => updateStatus(selectedCaso.id, s)}
            onIniciarEtapa={(i) => iniciarEtapa(selectedCaso.id, i)}
            onCancelarEtapa={(i) => cancelarEtapa(selectedCaso.id, i)}
            onConcluirEtapa={(i) => concluirEtapa(selectedCaso.id, i)}
            onDesfazerEtapa={(i) => desfazerEtapa(selectedCaso.id, i)}
            onToggleClinica={() => toggleClinica(selectedCaso.id)}
            onSalvarObs={(obs) => updateCaso(selectedCaso.id, { observacoes: obs })}
            onAddAnexo={(dados) => addAnexo(selectedCaso.id, dados)}
            getAnexoData={getAnexoData}
            onRemoveAnexo={(anexoId) => removeAnexo(selectedCaso.id, anexoId)}
            onAtualizarAnexo={(anexoId, patch) => atualizarAnexoMeta(selectedCaso.id, anexoId, patch)}
            onAbrirSeletorUsuario={() => setSeletorUsuarioAberto(true)}
            onEntregarProva={() => entregarProva(selectedCaso.id)}
            onConfirmarRetirada={() => confirmarRetirada(selectedCaso.id)}
            ehGestor={ehGestor}
            onSalvarValor={(v) => updateCaso(selectedCaso.id, { valor: v })}
            tiposTrabalho={tiposTrabalho}
            onSalvarItens={(novosItens) => salvarItensCaso(selectedCaso.id, novosItens)}
            onImprimir={() => setImprimindoCasoId(selectedCaso.id)}
            onEtiqueta={async () => {
              const nativo = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
              if (nativo) mostrarAviso('Procurando a impressora NIIMBOT...');
              if (await imprimirEtiqueta(selectedCaso)) mostrarAviso('Etiqueta impressa ✓');
            }}
            confirmandoExclusao={confirmandoExclusao}
            setConfirmandoExclusao={setConfirmandoExclusao}
            onExcluir={() => deleteCaso(selectedCaso.id)}
          />
        )}
        {view === 'ajustes' && (
          <AjustesView dentistas={dentistas} tiposTrabalho={tiposTrabalho} horasDia={horasDia}
            diasTrabalho={diasTrabalho}
            onSetDiasTrabalho={(dias) => persistConfig({ diasTrabalho: dias })}
            horasPorDia={horasPorDia}
            onSetHorasPorDia={(h) => persistConfig({ horasPorDia: h })}
            funcionarios={funcionarios} ehGestor={ehGestor}
            medias={calcularMedias(historicoTempos)}
            onAddDentista={(d) => persistConfig({ dentistas: [...dentistas, d] })}
            onUpdateDentista={(nome, patch) => persistConfig({ dentistas: dentistas.map(d => d.nome === nome ? { ...d, ...patch } : d) })}
            onRemoveDentista={(n) => persistConfig({ dentistas: dentistas.filter(d => d.nome !== n) })}
            onAddTipo={(nome, dias) => persistConfig({ tiposTrabalho: [...tiposTrabalho, { nome, prazoDias: dias, tempoHoras: 2, comissao: 0, valor: 0, etapas: [{ nome: 'Execução', horas: 2, prova: false }] }] })}
            onUpdateTipo={(nome, patch) => persistConfig({ tiposTrabalho: tiposTrabalho.map(t => t.nome === nome ? { ...t, ...patch } : t) })}
            onRemoveTipo={(nome) => persistConfig({ tiposTrabalho: tiposTrabalho.filter(t => t.nome !== nome) })}
            onSetHorasDia={(h) => persistConfig({ horasDia: h })}
            onAddFuncionario={(f) => persistConfig({ funcionarios: [...funcionarios, f] })}
            onUpdateFuncionario={(id, patch) => persistConfig({ funcionarios: funcionarios.map(f => f.id === id ? { ...f, ...patch } : f) })}
            onRemoveFuncionario={(id) => { persistConfig({ funcionarios: funcionarios.filter(f => f.id !== id) }); if (usuarioAtivoId === id) trocarUsuario(null); }}
            onAbrirEquipe={() => setView('equipe')}
            autoAjuste={autoAjuste}
            onSetAutoAjuste={(v) => persistConfig({ autoAjuste: v })}
            pessoas={pessoas}
            onSetPessoas={(n) => persistConfig({ pessoas: n })}
            chavePix={chavePix}
            onSetChavePix={(v) => persistConfig({ chavePix: v })}
          />
        )}
        {view === 'meu' && (
          <MeuView usuarioAtivo={usuarioAtivo} comissoes={comissoes} historicoTempos={historicoTempos}
            tiposTrabalho={tiposTrabalho}
            onVoltar={() => setView('dashboard')}
            onAbrirSeletorUsuario={() => setSeletorUsuarioAberto(true)} />
        )}
        {view === 'financas' && (
          <FinancasView casos={casos} comissoes={comissoes} ehGestor={ehGestor}
            pagamentos={pagamentos}
            dentistas={dentistas}
            onSetPrazoPagamento={(nome, texto) => persistConfig({ dentistas: dentistas.map(d => d.nome === nome ? { ...d, prazoPagamento: texto || null } : d) })}
            onSetDiasPagamento={(nome, dias) => persistConfig({ dentistas: dentistas.map(d => d.nome === nome ? { ...d, diasPagamento: dias ?? null, dataPagamento: null } : d) })}
            onSetDataPagamento={(nome, data) => persistConfig({ dentistas: dentistas.map(d => d.nome === nome ? { ...d, dataPagamento: data || null, diasPagamento: data ? null : (d.diasPagamento ?? null) } : d) })}
            onRegistrarPagamento={registrarPagamento}
            onRemoverPagamento={removerPagamento}
            onSelect={goToDetalhe}
            onVoltar={() => setView('dashboard')} />
        )}
        {view === 'equipe' && (
          <EquipeView funcionarios={funcionarios} comissoes={comissoes} historicoTempos={historicoTempos}
            tiposTrabalho={tiposTrabalho} ehGestor={ehGestor}
            medias={calcularMedias(historicoTempos)}
            onUpdateTipo={(nome, patch) => persistConfig({ tiposTrabalho: tiposTrabalho.map(t => t.nome === nome ? { ...t, ...patch } : t) })}
            onVoltar={() => setView('dashboard')}
            onAbrirMeu={usuarioAtivo ? () => setView('meu') : null} />
        )}
        {view === 'notificacoes' && (
          <NotificacoesView notificacoes={notificacoes} onAbrirCaso={(casoId) => { if (casoId && casos.some(c => c.id === casoId)) goToDetalhe(casoId); }} onMarcarLidas={marcarNotificacoesLidas} onLimpar={() => persistNotificacoes([])} />
        )}
      </div>

      {lendoEtiqueta && (
        <LeitorEtiqueta
          onFechar={() => setLendoEtiqueta(false)}
          onAchar={(id) => {
            setLendoEtiqueta(false);
            const achado = casosVivos().find(c => c.id === id);
            if (achado) goToDetalhe(id);
            else mostrarAviso('Não encontrei o trabalho desta etiqueta.');
          }}
        />
      )}
      {imprimindoCasoId && (() => {
        const casoImpressao = casos.find(c => c.id === imprimindoCasoId);
        if (!casoImpressao) return null;
        const dObj = dentistas.find(d => d.nome === casoImpressao.dentista);
        return <FichaImpressao caso={casoImpressao} dentistaInfo={dObj} ehGestor={ehGestor} onFechar={() => setImprimindoCasoId(null)} />;
      })()}

      <PuxarAtualizar aoAtualizar={carregarDados} />

      <div className="fixed bottom-0 left-0 right-0 mx-auto flex bg-white border-t border-stone-200 no-print w-full max-w-[440px] lg:hidden">
        <NavButton icon={Home} label="Início" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <NavButton icon={ClipboardList} label="Casos" active={view === 'lista'} onClick={() => { setFiltroRapido(null); setFiltroStatus('Todos'); setFiltroDentista('Todos'); setBusca(''); setView('lista'); }} />
        <NavButton icon={Plus} label="Novo" active={view === 'novo'} onClick={() => setView('novo')} />
        <NavButton icon={CalendarClock} label="Dia" active={view === 'dia'} onClick={() => setView('dia')} />
        <NavButton icon={ehGestor ? BarChart3 : DollarSign} label={ehGestor && funcionarios.length > 0 ? 'Equipe' : 'Meu'} active={view === 'meu' || view === 'equipe'} onClick={() => setView(ehGestor && funcionarios.length > 0 ? 'equipe' : 'meu')} />
        <NavButton icon={Settings} label="Ajustes" active={view === 'ajustes'} onClick={() => setView('ajustes')} />
      </div>
    </div>
  );
}

function NotifIcone({ tipo, size = 18 }) {
  if (tipo === 'producao') return <Hammer size={size} style={{ color: GOLD }} />;
  if (tipo === 'pronto') return <Flag size={size} style={{ color: VERDE }} />;
  if (tipo === 'entregue') return <CheckCircle2 size={size} style={{ color: VERDE }} />;
  if (tipo === 'reagendado') return <CalendarClock size={size} style={{ color: '#EA580C' }} />;
  if (tipo === 'clinica') return <Send size={size} style={{ color: ROXO }} />;
  if (tipo === 'retorno') return <Undo2 size={size} style={{ color: ROXO }} />;
  if (tipo === 'etapa') return <ListChecks size={size} style={{ color: GOLD }} />;
  if (tipo === 'pagamento') return <DollarSign size={size} style={{ color: VERDE }} />;
  if (tipo === 'aprovado') return <ThumbsUp size={size} style={{ color: VERDE }} />;
  return <Bell size={size} style={{ color: GOLD }} />;
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1 py-3">
      <Icon size={20} color={active ? INK : '#A8A29E'} strokeWidth={active ? 2.5 : 2} />
      <span className="text-xs" style={{ color: active ? INK : '#A8A29E', fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

// ─── Seletor de usuário (login simples da equipe) ───
function SeletorUsuario({ funcionarios, usuarioAtivoId, onTrocar, onFechar, onIrParaAjustes }) {
  const [pedindoPin, setPedindoPin] = useState(null);
  const [pin, setPin] = useState('');
  const [erroPin, setErroPin] = useState(false);

  const tentar = (f) => {
    if (f.pin) {
      setPedindoPin(f);
      setPin('');
      setErroPin(false);
    } else {
      onTrocar(f.id);
    }
  };
  const confirmarPin = () => {
    if (pin === pedindoPin.pin) {
      onTrocar(pedindoPin.id);
    } else {
      setErroPin(true);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onFechar}>
      <div className="w-full rounded-t-3xl bg-white p-5 pb-8" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-stone-200 mx-auto mb-4" />
        {!pedindoPin ? (
          <>
            <h2 className="text-base font-extrabold mb-1" style={{ color: INK }}>Quem está usando?</h2>
            <p className="text-xs text-stone-400 mb-4">As etapas concluídas e comissões serão registradas no nome do usuário ativo.</p>
            {funcionarios.length === 0 ? (
              <div className="text-center py-6">
                <Users size={26} className="text-stone-300 mx-auto mb-2" />
                <p className="text-sm text-stone-500 mb-3">Nenhum funcionário cadastrado ainda.</p>
                <button onClick={onIrParaAjustes} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: INK }}>Cadastrar equipe em Ajustes</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {funcionarios.map(f => (
                  <button key={f.id} onClick={() => tentar(f)}
                    className="flex items-center gap-3 p-3 rounded-2xl text-left"
                    style={{ border: f.id === usuarioAtivoId ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4', background: f.id === usuarioAtivoId ? GOLD_SOFT : 'white' }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>
                      {f.nome.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: INK }}>{f.nome}</div>
                      <div className="text-xs text-stone-400 flex items-center gap-1.5">
                        {f.gestor && <span className="font-semibold" style={{ color: GOLD }}>gestor</span>}
                        {f.pin && <span className="flex items-center gap-0.5"><Lock size={10} /> PIN</span>}
                      </div>
                    </div>
                    {f.id === usuarioAtivoId && <Check size={17} style={{ color: GOLD }} />}
                  </button>
                ))}
                {usuarioAtivoId && (
                  <button onClick={() => onTrocar(null)} className="text-xs text-stone-400 font-semibold py-2">Sair (sem usuário)</button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-base font-extrabold mb-1" style={{ color: INK }}>PIN de {pedindoPin.nome}</h2>
            <p className="text-xs text-stone-400 mb-4">Digite o PIN de 4 dígitos para entrar.</p>
            <input type="password" inputMode="numeric" maxLength={4} autoFocus
              className="w-full px-3 py-3 rounded-xl border text-center text-xl tracking-widest outline-none bg-white"
              style={{ borderColor: erroPin ? '#DC2626' : '#E7E5E4' }}
              value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setErroPin(false); }}
              onKeyDown={e => e.key === 'Enter' && pin.length === 4 && confirmarPin()} />
            {erroPin && <div className="text-xs text-red-600 font-medium mt-2 text-center">PIN incorreto. Tente novamente.</div>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setPedindoPin(null)} className="flex-1 py-3 rounded-xl font-semibold text-sm bg-stone-100 text-stone-600">Voltar</button>
              <button onClick={confirmarPin} disabled={pin.length !== 4} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40" style={{ background: INK }}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon, onClick, sub, destaque }) {
  return (
    <button onClick={onClick} className="rounded-2xl p-4 text-left active:bg-stone-50"
      style={{ position: 'relative', overflow: 'hidden', background: destaque && value > 0 ? GOLD_SOFT : '#fff', border: destaque && value > 0 ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.35)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 17, background: `${color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={color} strokeWidth={2.2} />
        </span>
        <ArrowRight size={14} style={{ color: '#D8CDB8' }} />
      </div>
      <div className="text-2xl font-extrabold" style={{ color: INK, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#8A8580', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{label}</div>
      {sub && <div className="text-xs mt-1 font-semibold" style={{ color }}>{sub}</div>}
    </button>
  );
}

function BarraProgresso({ caso, compacta }) {
  if (!emProducao(caso)) return null;
  const pct = progressoPrazo(caso);
  const atrasado = diasRestantes(caso.prazo) < 0;
  const cor = atrasado ? '#DC2626' : (pct >= 80 ? '#EA580C' : GOLD);
  const et = etapaAtual(caso);
  return (
    <div className={compacta ? 'mt-2' : 'mt-3'}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold min-w-0" style={{ color: cor }}>
          <span className="w-1.5 h-1.5 rounded-full pulse-gold flex-shrink-0" style={{ background: cor }} />
          <span className="truncate">{et ? `Etapa: ${et.nome}` : 'Em produção'}</span>
        </span>
        <span className="text-xs text-stone-400 flex-shrink-0">{pct}% do prazo</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function BadgeClinica() {
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: ROXO_SOFT, color: ROXO }}>
      <Stethoscope size={11} /> na clínica
    </span>
  );
}

function DashboardView({ producaoAtiva, prontos, naClinica, provasLevar, atrasados, paraHoje, horasHoje, paraRetirada, dentistasRetirada, proximosPrazos, onSelect, onNovo, onFiltro, ehGestor, temFuncionarios, usuarioAtivo, onAbrirEquipe, onAbrirMeu, onAbrirFinancas, adicionadosHoje, onCompartilharHoje, onAbrirIA, onAbrirPerguntas }) {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <div>
      {/* Cabeçalho-herói da marca: preto + dourado + estrela em marca d'água */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, marginBottom: 14, padding: '20px 18px 18px', background: 'linear-gradient(150deg, #24221E 0%, #1C1B19 55%, #2B2620 100%)', border: '1px solid rgba(184,147,90,0.35)', boxShadow: '0 18px 44px -22px rgba(28,27,25,0.55)' }}>
        <div style={{ position: 'absolute', top: -70, right: -70, width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,147,90,0.22), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 12, bottom: 0, opacity: 0.08, pointerEvents: 'none' }}><EstrelaLogo size={62} color={GOLD} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EstrelaLogo size={11} color={GOLD} />
          <span style={{ color: '#fff', fontWeight: 300, fontSize: 11.5, letterSpacing: '0.32em' }}>SPECIAL</span>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.3em' }}>LAB</span>
        </div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginTop: 14, lineHeight: 1.15 }}>
          {saudacao}{usuarioAtivo ? `, ${String(typeof usuarioAtivo === 'string' ? usuarioAtivo : usuarioAtivo.nome || '').split(' ')[0]}` : ''}!
        </div>
        <div style={{ color: GOLD, fontSize: 12.5, fontWeight: 700, marginTop: 4, textTransform: 'capitalize' }}>
          {hojeExtenso()}
          <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'none', marginLeft: 8 }}>
            v{typeof __VERSAO_APP__ !== 'undefined' ? __VERSAO_APP__ : 'dev'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
          {[
            ['Em produção', producaoAtiva, '#F5A54A'],
            ['Para hoje', paraHoje, '#E0BC85'],
            ['Atrasados', atrasados, atrasados > 0 ? '#F87171' : '#4ADE80'],
          ].map(([rot, val, cor]) => (
            <div key={rot} style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 13, padding: '9px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: cor, boxShadow: `0 0 6px ${cor}66`, flexShrink: 0 }} />
                <span style={{ fontSize: 8.5, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rot}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 3 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* IA Special no laboratório: transformação de sorriso + perguntas técnicas */}
      <div className="flex gap-2.5 mb-4">
        <button onClick={onAbrirIA}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left', border: '1px solid rgba(184,147,90,0.45)', borderRadius: 18, padding: '14px 14px', background: 'linear-gradient(135deg, #2B2620, #1C1B19)', cursor: 'pointer', boxShadow: '0 14px 30px -18px rgba(28,27,25,0.7)' }}>
          <div style={{ position: 'absolute', right: -10, top: -12, opacity: 0.12, pointerEvents: 'none' }}><EstrelaLogo size={44} color={GOLD} /></div>
          <Sparkles size={18} color={GOLD} />
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', marginTop: 8 }}>IA Special</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 2, lineHeight: 1.4 }}>Transformação de sorriso com IA</div>
        </button>
        <button onClick={onAbrirPerguntas}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left', border: '1px solid #E8D5B0', borderRadius: 18, padding: '14px 14px', background: '#fff', cursor: 'pointer', boxShadow: '0 14px 30px -20px rgba(122,98,52,0.45)' }}>
          <div style={{ position: 'absolute', right: -10, top: -12, opacity: 0.07, pointerEvents: 'none' }}><EstrelaLogo size={44} color={INK} /></div>
          <MessageCircle size={18} color={GOLD} />
          <div style={{ fontSize: 13.5, fontWeight: 800, color: INK, marginTop: 8 }}>Perguntas</div>
          <div style={{ fontSize: 10.5, color: '#78716C', marginTop: 2, lineHeight: 1.4 }}>Próteses, implantes e técnicas — com foto</div>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <StatCard label="Em produção" value={producaoAtiva} color={GOLD} icon={Hammer} onClick={() => onFiltro('producao')} />
        <StatCard label="Para hoje" value={paraHoje} color="#EA580C" icon={CalendarClock} sub={paraHoje > 0 ? `≈ ${formatHoras(horasHoje)} de serviço` : null} onClick={() => onFiltro('hoje')} />
        <StatCard label="Para retirada" value={paraRetirada} color="#2563EB" icon={Inbox} sub={paraRetirada > 0 ? `buscar em ${dentistasRetirada} clínica${dentistasRetirada > 1 ? 's' : ''}` : null} onClick={() => onFiltro('retirada')} />
        <StatCard label="Provas (levar + clínica)" value={naClinica + provasLevar} color={ROXO} icon={Stethoscope} sub={(naClinica + provasLevar) > 0 ? `${provasLevar} p/ levar • ${naClinica} na clínica` : null} onClick={() => onFiltro('clinica')} />
        <StatCard label="Atrasados" value={atrasados} color="#DC2626" icon={AlertTriangle} onClick={() => onFiltro('atrasado')} />
        <StatCard label="Entregas (finais + provas)" value={prontos + provasLevar} color={VERDE} icon={Flag} sub={provasLevar > 0 ? `${prontos} finais • ${provasLevar} provas p/ levar` : null} onClick={() => onFiltro('pronto')} />
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-5 lg:items-start">
      <div className="order-1 lg:order-2 lg:col-start-3 flex flex-col">
      {ehGestor && temFuncionarios && (
        <button onClick={onAbrirEquipe} className="w-full mb-3 p-4 rounded-2xl flex items-center gap-3 text-left"
          style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #2B2620, #1C1B19)', border: '1px solid rgba(184,147,90,0.45)', boxShadow: '0 14px 30px -18px rgba(28,27,25,0.7)' }}>
          <span style={{ position: 'absolute', right: -10, top: -12, opacity: 0.1, pointerEvents: 'none' }}><EstrelaLogo size={44} color={GOLD} /></span>
          <span style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(184,147,90,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={18} color={GOLD} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Relatório da equipe</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Produção, comissões e tempos médios</div>
          </div>
          <ArrowRight size={16} color={GOLD} />
        </button>
      )}
      {ehGestor && (
        <button onClick={onAbrirFinancas} className="w-full mb-3 p-4 rounded-2xl flex items-center gap-3 text-left"
          style={{ position: 'relative', overflow: 'hidden', background: '#fff', border: '1px solid #E8D5B0', boxShadow: '0 14px 30px -22px rgba(122,98,52,0.5)' }}>
          <span style={{ position: 'absolute', right: -10, top: -12, opacity: 0.06, pointerEvents: 'none' }}><EstrelaLogo size={44} color={INK} /></span>
          <span style={{ width: 38, height: 38, borderRadius: 19, background: '#DCF3E4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={18} color={VERDE} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: INK }}>Finanças</div>
            <div className="text-xs text-stone-400">Entradas, valores dos serviços e comissões</div>
          </div>
          <ArrowRight size={16} color={GOLD} />
        </button>
      )}
      {usuarioAtivo && (
        <button onClick={onAbrirMeu} className="w-full mb-6 p-4 rounded-2xl flex items-center gap-3 text-left"
          style={{ position: 'relative', overflow: 'hidden', background: '#fff', border: '1px solid #E8D5B0', boxShadow: '0 14px 30px -22px rgba(122,98,52,0.5)' }}>
          <span style={{ position: 'absolute', right: -10, top: -12, opacity: 0.06, pointerEvents: 'none' }}><EstrelaLogo size={44} color={INK} /></span>
          <span style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(184,147,90,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign size={18} color={'#7A6234'} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: INK }}>Meu desempenho</div>
            <div className="text-xs text-stone-400">Minhas comissões, finalizados e tempos</div>
          </div>
          <ArrowRight size={16} color={GOLD} />
        </button>
      )}
      <button onClick={onNovo} className="w-full mb-3 py-3.5 rounded-2xl text-white font-bold hidden lg:flex items-center justify-center gap-2" style={{ background: INK }}>
        <Plus size={18} /> Novo Caso
      </button>
      </div>

      <div className="order-2 lg:order-1 lg:col-span-2 lg:col-start-1 lg:row-start-1">
      {adicionadosHoje > 0 && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => onCompartilharHoje(false)}
            className="flex-1 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2" style={{ background: INK }}>
            <Share2 size={16} /> Compartilhar trabalhos de hoje ({adicionadosHoje})
          </button>
          <button onClick={() => onCompartilharHoje(true)} title="Baixar PDF"
            className="rounded-2xl border border-stone-200 bg-white flex items-center justify-center" style={{ width: 52, color: INK }}>
            <Download size={18} />
          </button>
        </div>
      )}
      <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Próximos prazos</h2>
      {proximosPrazos.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm">
          Nenhum caso cadastrado ainda.<br />Toque em "Novo" para começar.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {proximosPrazos.map(c => <CasoCard key={c.id} caso={c} onClick={() => onSelect(c.id)} />)}
        </div>
      )}

      <button onClick={onNovo} className="w-full mt-6 py-3.5 rounded-2xl text-white font-bold flex lg:hidden items-center justify-center gap-2" style={{ background: INK }}>
        <Plus size={18} /> Novo Caso
      </button>
      </div>
      </div>
    </div>
  );
}

function CasoCard({ caso, onClick, endereco, onConfirmarRetirada }) {
  const urg = getUrgencia(caso);
  const style = URGENCIA_STYLES[urg];
  const dias = diasRestantes(caso.prazo);
  const numAnexos = caso.anexos?.length || 0;
  const producao = emProducao(caso);
  const concluidas = caso.etapas?.filter(e => e.concluida).length || 0;
  const totalEtapas = caso.etapas?.length || 0;
  const esperandoDentista = aguardandoDentista(caso);
  const naRetirada = (aguardandoRetirada(caso) || (caso.naClinica && caso.retornoSolicitado)) && onConfirmarRetirada;
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl p-4 bg-white flex flex-col gap-0"
      style={{
        border: esperandoDentista ? '1.5px solid #DC2626' : (caso.naClinica ? `1.5px solid ${ROXO}` : (producao ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4')),
        borderLeft: `4px solid ${esperandoDentista ? '#DC2626' : caso.naClinica ? ROXO : caso.status === 'Pronto' ? VERDE : producao ? GOLD : '#D6D3D1'}`,
        boxShadow: '0 12px 28px -22px rgba(28,27,25,0.35)',
      }}>
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate" style={{ color: INK }}>{caso.paciente}</div>
          <div className="text-xs text-stone-500 truncate mt-0.5">{caso.dentista} • {caso.tipoTrabalho}</div>
          <div className="text-xs text-stone-400 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>Prazo: {formatDateBR(caso.prazo)}</span>
            {totalEtapas > 0 && <span className="flex items-center gap-0.5"><ListChecks size={11} />{concluidas}/{totalEtapas}</span>}
            {numAnexos > 0 && <span className="flex items-center gap-0.5"><Paperclip size={11} />{numAnexos}</span>}
            {esperandoDentista && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#FCE4E4', color: '#B42318' }}>
                ⏳ aguardando dentista
              </span>
            )}
            {caso.naClinica && <BadgeClinica />}
            {caso.provaPendente && !caso.naClinica && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#FDECD8', color: '#B54708' }}>
                <Package size={11} /> levar p/ prova
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: style.bg, color: style.text }}>{style.label(dias)}</span>
          <span className="text-xs" style={{ color: caso.status === 'Pronto' ? VERDE : '#A8A29E', fontWeight: caso.status === 'Pronto' ? 700 : 400 }}>{caso.status}</span>
        </div>
      </div>
      {/* Trabalho aguardando busca na clínica: botão confirma que já foi pego */}
      {naRetirada && (
        <span role="button" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onConfirmarRetirada(caso.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onConfirmarRetirada(caso.id); } }}
          className="flex items-center justify-center gap-1.5 mt-2.5 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          style={{ background: '#2563EB', color: '#fff', boxShadow: '0 10px 22px -14px rgba(37,99,235,0.8)' }}>
          <Inbox size={13} /> Foi pego ✓ — confirmar retirada
        </span>
      )}
      {!caso.naClinica && !caso.provaPendente && <BarraProgresso caso={caso} compacta />}
      {(caso.naClinica || caso.provaPendente) && endereco && (
        <a href={mapsUrl(endereco)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
          <MapPin size={12} className="flex-shrink-0" />
          <span className="flex-1 min-w-0 truncate">{endereco}</span>
          <span className="flex-shrink-0 font-bold">Maps →</span>
        </a>
      )}
    </button>
  );
}

function SeletorDia({ dia, setDia }) {
  const abas = [['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['datas', 'Datas']];
  return (
    <div className="flex rounded-2xl bg-stone-100 p-1 mb-4">
      {abas.map(([k, label]) => (
        <button key={k} onClick={() => setDia(k)} className="flex-1 py-2 rounded-xl text-sm font-bold" style={dia === k ? { background: 'white', color: INK, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: '#78716C' }}>{label}</button>
      ))}
    </div>
  );
}

function DiaView({ dia, setDia, casosHoje, casosAmanha, casosAgenda, tiposTrabalho, horasDia, horasPorDia, diasTrabalho, pessoas, ajustesDia, onSetAjusteDia, onSelect, onFinalizar, onIniciarProducao, onAdiar, onMudarPrazo }) {
  const [mesOffset, setMesOffset] = useState(0);
  const [dataSelecionada, setDataSelecionada] = useState(null);
  const [imagemDia, setImagemDia] = useState(null);
  const [adicionandoDia, setAdicionandoDia] = useState(false);
  const [editandoCarga, setEditandoCarga] = useState(false);

  // Horas-base (por pessoa) de um dia da semana (0=dom..6=sáb); cai na jornada padrão se não configurado
  const horasBase = (idxSemana) => {
    const v = horasPorDia?.[idxSemana];
    return (typeof v === 'number' && v > 0) ? v : horasDia;
  };
  // Capacidade total de uma DATA: ajuste sob medida do dia (se houver) ou padrão, × pessoas
  const capData = (dataStr) => {
    const aj = ajustesDia?.[dataStr] || {};
    const dow = new Date(dataStr + 'T00:00:00').getDay();
    const horas = (aj.horas > 0) ? aj.horas : horasBase(dow);
    const pess = (aj.pessoas >= 1) ? aj.pessoas : (pessoas >= 1 ? pessoas : 1);
    return horas * pess;
  };
  const dataAtualISO = dia === 'amanha' ? addDias(todayISO(), 1) : todayISO();
  const capacidadeAtual = capData(dataAtualISO);
  const ajusteAtual = ajustesDia?.[dataAtualISO] || {};
  const horasDoDia = (ajusteAtual.horas > 0) ? ajusteAtual.horas : horasBase(new Date(dataAtualISO + 'T00:00:00').getDay());
  const pessoasDoDia = (ajusteAtual.pessoas >= 1) ? ajusteAtual.pessoas : (pessoas >= 1 ? pessoas : 1);

  const gerarImagem = (titulo, dataExtenso, lista, capacidade) => {
    try {
      const cap = capacidade || capacidadeAtual;
      const urlRetrato = desenharImagemDia({ titulo, dataExtenso, casos: lista, tiposTrabalho, horasDia: cap, orientacao: 'retrato' });
      const urlTV = desenharImagemDia({ titulo, dataExtenso, casos: lista, tiposTrabalho, horasDia: cap, orientacao: 'paisagem' });
      const base = `trabalhos-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${todayISO()}`;
      setImagemDia({ url: urlRetrato, urlTV, nome: base, titulo });
    } catch (e) { console.error('Erro ao gerar imagem', e); }
  };

  // Compartilha como PDF (formato retrato, ideal p/ WhatsApp)
  const compartilharPDF = async () => {
    if (!imagemDia) return;
    try {
      const pdfBlob = jpegParaPDF(imagemDia.url);
      const file = new File([pdfBlob], `${imagemDia.nome}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: imagemDia.titulo });
        return;
      }
      // Sem compartilhamento nativo → baixa o PDF
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${imagemDia.nome}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('Erro ao gerar PDF', e);
      baixarDataURL(imagemDia.url, `${imagemDia.nome}.jpg`);
    }
  };

  const OverlayImagem = () => imagemDia ? (
    <div className="fixed inset-0 z-50 overflow-auto flex flex-col items-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setImagemDia(null)}>
      <div className="sticky top-0 z-10 flex items-center justify-center gap-2 mb-3 flex-wrap" onClick={e => e.stopPropagation()}>
        <button onClick={compartilharPDF} className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: '#25D366', color: 'white' }}>
          <Share2 size={16} /> Compartilhar PDF
        </button>
        <button onClick={() => baixarDataURL(imagemDia.urlTV, `${imagemDia.nome}-tv.jpg`)} className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: GOLD, color: INK }}>
          <Download size={16} /> Baixar JPG (TV)
        </button>
        <button onClick={() => setImagemDia(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <X size={16} /> Fechar
        </button>
      </div>
      <img src={imagemDia.url} alt="Relatório do dia" className="rounded-xl w-full" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()} />
      <div className="text-xs text-center mt-3 mb-2" style={{ color: 'rgba(255,255,255,0.9)', maxWidth: '400px' }}>
        📄 <b>Compartilhar PDF</b>: abre o WhatsApp com o relatório em PDF (formato acima). 📺 <b>Baixar JPG (TV)</b>: versão widescreen para telas grandes:
      </div>
      <img src={imagemDia.urlTV} alt="Versão TV" className="rounded-xl w-full" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()} />
    </div>
  ) : null;
  // Trabalhos com vários itens aparecem como blocos separados (um horário por item)
  const casos = expandirPorItem(dia === 'hoje' ? casosHoje : (dia === 'amanha' ? casosAmanha : []));
  const totalHoras = casos.reduce((s, c) => s + tempoRestante(c, tiposTrabalho), 0);
  const excedente = totalHoras - capacidadeAtual;
  const pctCarga = Math.min(100, Math.round((totalHoras / capacidadeAtual) * 100));
  const corCarga = excedente > 0 ? '#DC2626' : (pctCarga >= 85 ? '#EA580C' : VERDE);

  // ── Aba Datas: calendário do mês com carga por dia ──
  if (dia === 'datas') {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + mesOffset);
    const ano = base.getFullYear();
    const mesIdx = base.getMonth();
    const mesPrefixo = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`;
    const doMes = expandirPorItem(casosAgenda.filter(c => c.prazo.startsWith(mesPrefixo)));
    const porData = {};
    doMes.forEach(c => { (porData[c.prazo] = porData[c.prazo] || []).push(c); });
    const totalMesHoras = doMes.reduce((s, c) => s + tempoRestante(c, tiposTrabalho), 0);
    const hojeStr = todayISO();
    const diasNoMes = new Date(ano, mesIdx + 1, 0).getDate();

    // Monta as semanas completas (domingo a sábado); dias de folga aparecem apagados
    const diasAtivos = (diasTrabalho && diasTrabalho.length > 0) ? diasTrabalho : DIAS_TRABALHO_PADRAO;
    const semanas = [];
    let semanaAtual = new Array(7).fill(null);
    for (let d = 1; d <= diasNoMes; d++) {
      const data = `${mesPrefixo}-${String(d).padStart(2, '0')}`;
      const diaSemana = new Date(ano, mesIdx, d).getDay(); // 0=dom ... 6=sáb
      semanaAtual[diaSemana] = { dia: d, data, diaSemana };
      if (diaSemana === 6) { semanas.push(semanaAtual); semanaAtual = new Array(7).fill(null); }
    }
    if (semanaAtual.some(x => x !== null)) semanas.push(semanaAtual);

    const corDoDia = (data) => {
      const lista = porData[data];
      if (!lista) return { bg: 'white', border: '#E7E5E4', texto: '#A8A29E', horas: 0 };
      const horas = lista.reduce((s, c) => s + tempoRestante(c, tiposTrabalho), 0);
      const razao = horas / capData(data);
      if (razao > 1) return { bg: '#FCE4E4', border: '#DC2626', texto: '#B42318', horas };
      if (razao >= 0.6) return { bg: '#FDECD8', border: '#EA580C', texto: '#B54708', horas };
      return { bg: '#DCF3E4', border: VERDE, texto: '#166B3A', horas };
    };

    const listaDoDia = dataSelecionada ? (porData[dataSelecionada] || []) : [];
    const dSel = dataSelecionada ? new Date(dataSelecionada + 'T00:00:00') : null;

    const MiniCardCaso = ({ c }) => {
      const et = etapaAtual(c);
      return (
        <div key={c.id} onClick={() => onSelect(c.id)} className="w-full text-left rounded-xl px-3 py-2.5 bg-white border border-stone-200 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: INK }}>{c.paciente}</div>
              <div className="text-xs text-stone-400 truncate">{c.dentista} • {c.tipoTrabalho}</div>
              {et && !c.naClinica && !c.provaPendente && c.status !== 'Pronto' && <div className="text-xs truncate font-semibold" style={{ color: GOLD }}>{et.nome}</div>}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {c.status === 'Pronto' && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#DCF3E4', color: '#166B3A' }}>pronto</span>}
              {c.naClinica && <BadgeClinica />}
              {c.provaPendente && !c.naClinica && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#FDECD8', color: '#B54708' }}>levar</span>}
              <span className="text-xs text-stone-400">{formatHoras(tempoRestante(c, tiposTrabalho))}</span>
              {c.status !== 'Entregue' && (
                <button onClick={(e) => { e.stopPropagation(); onAdiar(c.id); }}
                  className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#F0EFEC', color: '#78716C' }}
                  title="Tirar deste dia (vai para o próximo dia de trabalho)">
                  Tirar do dia ▸
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div>
        <OverlayImagem />
        <SeletorDia dia={dia} setDia={setDia} />
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { setMesOffset(mesOffset - 1); setDataSelecionada(null); }} className="p-2 rounded-full bg-white" style={{ border: '1px solid #E8D5B0', color: '#7A6234', boxShadow: '0 6px 14px -10px rgba(122,98,52,0.5)' }}><ChevronLeft size={16} /></button>
          <div className="text-center">
            <div className="capitalize" style={{ color: INK, fontSize: 15, fontWeight: 800 }}>{MESES[mesIdx]} <span style={{ color: '#A8A29E', fontSize: 12, fontWeight: 700 }}>{ano}</span></div>
            <div className="text-xs" style={{ color: '#A8A29E' }}>{doMes.length} {doMes.length === 1 ? 'trabalho' : 'trabalhos'} • ≈ {formatHoras(totalMesHoras)} restantes</div>
          </div>
          <button onClick={() => { setMesOffset(mesOffset + 1); setDataSelecionada(null); }} className="p-2 rounded-full bg-white" style={{ border: '1px solid #E8D5B0', color: '#7A6234', transform: 'rotate(180deg)', boxShadow: '0 6px 14px -10px rgba(122,98,52,0.5)' }}><ChevronLeft size={16} /></button>
        </div>

        {/* Cabeçalho da semana completa */}
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, idx) => (
            <div key={d} className="text-center font-bold" style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: diasAtivos.includes(idx) ? '#B8935A' : '#D6D3D1' }}>{d}</div>
          ))}
        </div>

        {/* Grade do calendário */}
        <div className="flex flex-col gap-1 mb-3">
          {semanas.map((semana, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {semana.map((cel, ci) => {
                if (!cel) return <div key={ci} />;
                const ehDiaTrabalho = diasAtivos.includes(cel.diaSemana);
                const cor = corDoDia(cel.data);
                const ehHoje = cel.data === hojeStr;
                const temTrabalho = !!porData[cel.data];
                const selecionado = dataSelecionada === cel.data;
                // Dia de folga sem trabalho: apagado, sem clique
                if (!ehDiaTrabalho && !temTrabalho) {
                  return (
                    <div key={ci} className="rounded-lg flex items-center justify-center"
                      style={{ background: '#EBEAE7', minHeight: '50px', border: ehHoje ? `2px solid ${GOLD}` : '1px solid #E7E5E4', opacity: 0.55 }}>
                      <span className="text-sm font-bold" style={{ color: '#B9B5AE' }}>{cel.dia}</span>
                    </div>
                  );
                }
                return (
                  <button key={ci} onClick={() => { if (temTrabalho || ehDiaTrabalho) { setDataSelecionada(selecionado ? null : cel.data); setAdicionandoDia(false); } }}
                    className="rounded-lg flex flex-col items-center justify-center py-1.5"
                    style={{
                      background: cor.bg,
                      border: selecionado ? `2px solid ${INK}` : (ehHoje ? `2px solid ${GOLD}` : `1px solid ${cor.border}`),
                      minHeight: '50px',
                      opacity: temTrabalho ? 1 : 0.6,
                    }}>
                    <span className="text-sm font-extrabold" style={{ color: temTrabalho ? cor.texto : '#A8A29E' }}>{cel.dia}</span>
                    {temTrabalho && (
                      <>
                        <span className="font-bold leading-tight" style={{ color: cor.texto, fontSize: '10px' }}>{porData[cel.data].length}×</span>
                        <span className="leading-tight" style={{ color: cor.texto, fontSize: '9px' }}>{formatHoras(cor.horas)}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-3 mb-4 text-xs text-stone-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: '#DCF3E4', border: `1px solid ${VERDE}` }} /> com folga</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: '#FDECD8', border: '1px solid #EA580C' }} /> cheio</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: '#FCE4E4', border: '1px solid #DC2626' }} /> acima da capacidade do dia</span>
        </div>

        {/* Dia selecionado */}
        {dataSelecionada && dSel && (
          <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-extrabold capitalize" style={{ color: INK }}>{DIAS_SEMANA[dSel.getDay()]}, {dSel.getDate()} de {MESES[dSel.getMonth()]}</div>
                <div className="text-xs text-stone-400">{listaDoDia.length} {listaDoDia.length === 1 ? 'trabalho' : 'trabalhos'} • ≈ {formatHoras(listaDoDia.reduce((s, c) => s + tempoRestante(c, tiposTrabalho), 0))} de {formatHoras(capData(dataSelecionada))}</div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => gerarImagem(`Trabalhos — ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`, `${DIAS_SEMANA[dSel.getDay()]}, ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`, listaDoDia, capData(dataSelecionada))}
                  className="p-1.5 rounded-lg text-white" style={{ background: INK }} title="Gerar imagem para compartilhar">
                  <Share2 size={14} />
                </button>
                <button onClick={() => setDataSelecionada(null)} className="p-1.5 rounded-lg bg-stone-100"><X size={14} className="text-stone-500" /></button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {listaDoDia.map(c => <MiniCardCaso key={c.id + (c._bloco || '')} c={c} />)}
              {listaDoDia.length === 0 && (
                <div className="text-xs text-stone-400 text-center py-2">Nenhum trabalho neste dia — adicione um abaixo.</div>
              )}
            </div>

            {/* Trazer um trabalho de outra data para este dia */}
            {!adicionandoDia ? (
              <button onClick={() => setAdicionandoDia(true)}
                className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-dashed" style={{ borderColor: GOLD, color: '#7A6234', background: GOLD_SOFT }}>
                <Plus size={14} /> Adicionar trabalho a este dia
              </button>
            ) : (
              <div className="mt-2 rounded-xl border border-stone-200 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2" style={{ background: '#F5F4F0' }}>
                  <span className="text-xs font-bold" style={{ color: INK }}>Escolha o trabalho que vem para este dia:</span>
                  <button onClick={() => setAdicionandoDia(false)} className="p-1"><X size={13} className="text-stone-400" /></button>
                </div>
                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {casosAgenda.filter(c => c.prazo !== dataSelecionada).sort((a, b) => a.prazo.localeCompare(b.prazo)).map((c, i) => (
                    <button key={c.id} onClick={() => { onMudarPrazo(c.id, dataSelecionada); setAdicionandoDia(false); }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i > 0 ? '1px solid #F5F5F4' : 'none' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate" style={{ color: INK }}>{c.paciente}</div>
                        <div className="text-xs text-stone-400 truncate">{c.dentista} • {c.tipoTrabalho}</div>
                      </div>
                      <span className="text-xs text-stone-400 flex-shrink-0">{formatDateBR(c.prazo)} →</span>
                    </button>
                  ))}
                  {casosAgenda.filter(c => c.prazo !== dataSelecionada).length === 0 && (
                    <div className="text-xs text-stone-400 text-center py-4">Nenhum outro trabalho em andamento para trazer.</div>
                  )}
                </div>
              </div>
            )}

            <button onClick={() => gerarImagem(`Trabalhos — ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`, `${DIAS_SEMANA[dSel.getDay()]}, ${dSel.getDate()} de ${MESES[dSel.getMonth()]}`, listaDoDia, capData(dataSelecionada))}
              className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: INK }}>
              <Share2 size={14} /> Gerar imagem deste dia (WhatsApp / TV)
            </button>
          </div>
        )}
        {!dataSelecionada && doMes.length > 0 && (
          <div className="text-center text-xs text-stone-400 mb-4">Toque num dia colorido para ver os trabalhos dele.</div>
        )}
        {doMes.length === 0 && (
          <div className="text-center py-8 px-4 rounded-2xl bg-white border border-stone-200">
            <CalendarClock size={26} className="text-stone-300 mx-auto mb-2" />
            <div className="text-stone-500 text-sm font-medium">Nenhum trabalho com prazo neste mês.</div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div>
      <OverlayImagem />
      <SeletorDia dia={dia} setDia={setDia} />

      <div className="text-sm text-stone-400 mb-4 capitalize">{dia === 'hoje' ? hojeExtenso() : amanhaExtenso()}</div>

      <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Hourglass size={16} color={GOLD} />
          <h2 className="text-sm font-bold flex-1" style={{ color: INK }}>{dia === 'hoje' ? 'Carga do dia' : 'Previsão de amanhã'}</h2>
          <span className="text-xs text-stone-400">{casos.length} {casos.length === 1 ? 'trabalho' : 'trabalhos'}</span>
          <button onClick={() => setEditandoCarga(!editandoCarga)} className="p-1.5 rounded-lg" title="Ajustar horas e pessoas deste dia"
            style={editandoCarga ? { background: GOLD_SOFT } : { background: '#F0EFEC' }}>
            <Pencil size={13} style={{ color: editandoCarga ? '#7A6234' : '#78716C' }} />
          </button>
        </div>
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="text-2xl font-extrabold" style={{ color: corCarga }}>{formatHoras(totalHoras)}</span>
            <span className="text-sm text-stone-400"> de {formatHoras(capacidadeAtual)} disponíveis</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: corCarga }}>{pctCarga}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pctCarga}%`, background: corCarga, transition: 'width 0.4s' }} />
        </div>
        <p className="text-xs text-stone-400 mt-2">As horas consideram só as etapas que ainda faltam em cada trabalho.</p>

        {/* Ajuste rápido: horas e pessoas SÓ deste dia (toque no lápis) */}
        {editandoCarga && (
          <div className="mt-3 rounded-xl p-3" style={{ background: '#F5F4F0' }}>
            <div className="text-xs font-bold mb-1" style={{ color: INK }}>Capacidade só {dia === 'hoje' ? 'de hoje' : 'de amanhã'} ({formatDateBR(dataAtualISO)})</div>
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-xs font-medium flex-1" style={{ color: INK }}>Horas de trabalho (por pessoa)</span>
              <InputNumero min={0.5} max={24}
                className="px-2 py-1.5 rounded-lg border border-stone-200 text-sm outline-none bg-white text-center" style={{ width: '64px' }}
                valor={horasDoDia}
                onValor={v => onSetAjusteDia(dataAtualISO, { horas: v })} />
              <span className="text-xs text-stone-400">horas</span>
            </div>
            <div className="flex items-center gap-2 py-1.5">
              <span className="text-xs font-medium flex-1" style={{ color: INK }}>Pessoas neste dia</span>
              <button onClick={() => onSetAjusteDia(dataAtualISO, { pessoas: Math.max(1, pessoasDoDia - 1) })} disabled={pessoasDoDia <= 1}
                className="w-8 h-8 rounded-lg font-extrabold disabled:opacity-30" style={{ background: 'white', border: '1px solid #E7E5E4', color: INK }}>−</button>
              <span className="text-sm font-extrabold text-center" style={{ color: INK, width: '22px' }}>{pessoasDoDia}</span>
              <button onClick={() => onSetAjusteDia(dataAtualISO, { pessoas: Math.min(20, pessoasDoDia + 1) })}
                className="w-8 h-8 rounded-lg font-extrabold" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>+</button>
            </div>
            <div className="text-xs mt-1" style={{ color: '#7A6234' }}>
              Capacidade {dia === 'hoje' ? 'de hoje' : 'de amanhã'}: {formatHoras(horasDoDia)} × {pessoasDoDia} {pessoasDoDia === 1 ? 'pessoa' : 'pessoas'} = <b>{formatHoras(horasDoDia * pessoasDoDia)}</b>
            </div>
            {ajustesDia?.[dataAtualISO] && (
              <button onClick={() => onSetAjusteDia(dataAtualISO, null)} className="text-xs font-bold mt-2" style={{ color: '#B42318' }}>
                Voltar ao padrão dos Ajustes
              </button>
            )}
            <div className="text-xs text-stone-400 mt-1.5">Vale só para este dia — o padrão de todos os dias fica em Ajustes → Dias e horários.</div>
          </div>
        )}
        {excedente > 0 && (
          <div className="flex items-start gap-2 mt-3 text-xs px-3 py-2.5 rounded-xl" style={{ background: '#FCE4E4', color: '#B42318' }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{dia === 'hoje' ? 'O dia' : 'Amanhã'} está excedido em <b>{formatHoras(excedente)}</b>. Use "Adiar" nos trabalhos que puderem esperar{dia === 'hoje' ? '' : ' — ou adiante alguns hoje mesmo'}.</span>
          </div>
        )}
        {excedente <= 0 && casos.length > 0 && (
          <div className="text-xs mt-3 px-3 py-2 rounded-xl" style={{ background: '#DCF3E4', color: '#166B3A' }}>
            {dia === 'hoje' ? 'Dia dentro da capacidade' : 'Amanhã está dentro da capacidade'} — sobra {formatHoras(Math.abs(excedente))} de folga. ✓
          </div>
        )}
        {dia === 'amanha' && casos.length > 0 && (
          <div className="flex items-start gap-2 mt-3 text-xs px-3 py-2.5 rounded-xl" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
            <Hammer size={13} className="flex-shrink-0 mt-0.5" />
            <span>Sobrou tempo hoje? Você pode <b>adiantar</b> estes trabalhos: toque em "Iniciar" ou "Finalizar" e saia na frente.</span>
          </div>
        )}
        {casos.length > 0 && (
          <button onClick={() => gerarImagem(dia === 'hoje' ? 'Trabalhos de Hoje' : 'Trabalhos de Amanhã', dia === 'hoje' ? hojeExtenso() : amanhaExtenso(), casos)}
            className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: INK }}>
            <Share2 size={14} /> Gerar imagem do dia (WhatsApp / TV)
          </button>
        )}
      </div>

      {casos.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white border border-stone-200">
          <CheckCircle2 size={28} className="mx-auto mb-3" style={{ color: VERDE }} />
          <div className="text-stone-500 text-sm font-medium">{dia === 'hoje' ? 'Nenhum trabalho pendente para hoje!' : 'Nada previsto para amanhã ainda.'}</div>
          <div className="text-stone-400 text-xs mt-1">{dia === 'hoje' ? 'Trabalhos com prazo até hoje aparecem nesta lista (os que estão na clínica não contam).' : 'Trabalhos com prazo para amanhã aparecem aqui.'}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {casos.map((c, i) => {
            const horas = tempoRestante(c, tiposTrabalho);
            const atrasado = diasRestantes(c.prazo) < 0;
            const producao = emProducao(c);
            const et = etapaAtual(c);
            // Bloco de item: "Finalizar" só quando o trabalho INTEIRO estiver completo
            const trabalhoCompleto = c._casoCompleto !== undefined ? c._casoCompleto : etapasCompletas(c);
            return (
              <div key={c.id + (c._bloco || '')} className="rounded-2xl p-4 bg-white" style={{ border: producao ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4' }}>
                <button onClick={() => onSelect(c.id)} className="w-full text-left">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: GOLD_SOFT, color: '#7A6234' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate" style={{ color: INK }}>{c.paciente}</div>
                      <div className="text-xs text-stone-500 truncate mt-0.5">{c.dentista} • {c.tipoTrabalho}</div>
                      {et && <div className="text-xs truncate mt-0.5 font-semibold" style={{ color: GOLD }}>Próxima etapa: {et.nome}</div>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: GOLD }}>
                          <Hourglass size={11} /> {formatHoras(horas)} restantes
                        </span>
                        {atrasado && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#FCE4E4', color: '#B42318' }}>
                            Atrasado {Math.abs(diasRestantes(c.prazo))}d
                          </span>
                        )}
                        {producao && (
                          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: GOLD }}>
                            <span className="w-1.5 h-1.5 rounded-full pulse-gold" style={{ background: GOLD }} /> em produção
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex gap-2 mt-3">
                  {producao && trabalhoCompleto && (
                    <button onClick={() => onFinalizar(c.id)} className="flex-1 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: VERDE }}>
                      <Flag size={13} /> Finalizar
                    </button>
                  )}
                  {producao && !trabalhoCompleto && (
                    <button onClick={() => onSelect(c.id)} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
                      <ListChecks size={13} /> Etapas
                    </button>
                  )}
                  <button onClick={() => onAdiar(c.id)} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-stone-200 text-stone-600">
                    <CalendarClock size={13} /> Adiar +1 dia
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListaView({ casos, busca, setBusca, filtroStatus, setFiltroStatus, dentistas, filtroDentista, setFiltroDentista, filtroRapido, onLimparFiltroRapido, getEndereco, onSelect, onConfirmarRetirada, onLerEtiqueta }) {
  const filtros = ['Todos', ...STATUS_LIST];
  return (
    <div>
      {filtroRapido && (
        <button onClick={onLimparFiltroRapido} className="flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: INK, color: 'white' }}>
          Filtro: {FILTROS_RAPIDOS[filtroRapido].titulo} <X size={12} />
        </button>
      )}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
            <Search size={16} className="text-stone-400" />
          </div>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por paciente, dentista ou ID..." className="w-full pl-9 pr-3 py-3 rounded-xl text-sm outline-none bg-white"
            style={{ border: busca ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4', boxShadow: '0 10px 24px -20px rgba(28,27,25,0.3)', fontWeight: 600 }} />
        </div>
        {onLerEtiqueta && (
          <button onClick={onLerEtiqueta} title="Ler etiqueta (QR)" className="px-3 rounded-xl bg-white flex items-center justify-center"
            style={{ border: '1px solid #E7E5E4', color: '#8A6D3B', boxShadow: '0 10px 24px -20px rgba(28,27,25,0.3)' }}>
            <Camera size={18} />
          </button>
        )}
      </div>
      {dentistas && dentistas.length > 0 && (
        <div className="relative mb-3">
          <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
            <Stethoscope size={15} style={{ color: filtroDentista !== 'Todos' ? ROXO : '#A8A29E' }} />
          </div>
          <select value={filtroDentista} onChange={e => setFiltroDentista(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none bg-white appearance-none"
            style={{ border: filtroDentista !== 'Todos' ? `1.5px solid ${ROXO}` : '1px solid #E7E5E4', color: filtroDentista !== 'Todos' ? ROXO : INK, fontWeight: filtroDentista !== 'Todos' ? 700 : 400 }}>
            <option value="Todos">Todos os dentistas</option>
            {dentistas.map(d => <option key={d.nome} value={d.nome}>{d.nome}</option>)}
          </select>
        </div>
      )}
      {!filtroRapido && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {filtros.map(f => (
            <button key={f} onClick={() => setFiltroStatus(f)} className="px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0"
              style={filtroStatus === f
                ? { background: 'linear-gradient(135deg, #24221E, #1C1B19)', color: GOLD, border: '1px solid rgba(184,147,90,0.5)', boxShadow: '0 8px 18px -12px rgba(28,27,25,0.8)' }
                : { background: '#fff', color: '#78716C', border: '1px solid #E7E5E4' }}>
              {f}
            </button>
          ))}
        </div>
      )}
      {casos.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm">Nenhum caso encontrado.</div>
      ) : (
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
          {casos.map(c => <CasoCard key={c.id} caso={c} endereco={getEndereco ? getEndereco(c.dentista) : ''} onClick={() => onSelect(c.id)} onConfirmarRetirada={onConfirmarRetirada} />)}
        </div>
      )}
    </div>
  );
}

function NotificacoesView({ notificacoes, onAbrirCaso, onMarcarLidas, onLimpar }) {
  useEffect(() => {
    const t = setTimeout(onMarcarLidas, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      {notificacoes.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-2xl bg-white border border-stone-200">
          <Bell size={28} className="text-stone-300 mx-auto mb-3" />
          <div className="text-stone-400 text-sm">Nenhuma notificação ainda.<br />Quando um trabalho entrar em produção, for para prova ou for finalizado, aparecerá aqui.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notificacoes.map(n => (
            <button key={n.id} onClick={() => onAbrirCaso(n.casoId)}
              className="w-full text-left rounded-2xl p-4 bg-white border flex items-start gap-3"
              style={{ borderColor: n.lida ? '#E7E5E4' : GOLD }}>
              <div className="mt-0.5"><NotifIcone tipo={n.icone} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: INK, fontWeight: n.lida ? 500 : 700 }}>{n.texto}</div>
                <div className="text-xs text-stone-400 mt-1">{formatDataHoraBR(n.data)}</div>
              </div>
              {!n.lida && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: GOLD }} />}
            </button>
          ))}
          <button onClick={onLimpar} className="text-xs text-stone-400 font-semibold py-3">Limpar todas</button>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-stone-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function NovoCasoForm({ onSalvar, onCancelar, dentistas, tiposTrabalho, ehGestor, diasTrabalho, onIrParaAjustes }) {
  const [paciente, setPaciente] = useState('');
  const [dentista, setDentista] = useState(dentistas[0]?.nome || '');
  const [tipoNome, setTipoNome] = useState(tiposTrabalho[0]?.nome || '');
  const [material, setMaterial] = useState(MATERIAIS[0]);
  const [quantidade, setQuantidade] = useState(1);
  const [itens, setItens] = useState([]);
  const [dataEntrada, setDataEntrada] = useState(todayISO());
  const [prazoEditadoManual, setPrazoEditadoManual] = useState(false);
  const [prazo, setPrazo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dentes, setDentes] = useState([]); // odontograma: dentes do trabalho (FDI)
  const [gengiva, setGengiva] = useState([]); // odontograma: onde a prótese leva gengiva
  const [anexosNovos, setAnexosNovos] = useState([]); // arquivos escolhidos antes de salvar
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const fotoRefN = useRef(null);
  const camRefN = useRef(null);
  const arqRefN = useRef(null);
  const vidRefN = useRef(null);

  const categoriaArq = (file) => {
    const t = String(file.type || '');
    const n = String(file.name || '').toLowerCase();
    if (t.startsWith('video')) return 'video';
    if (n.endsWith('.stl')) return 'stl';
    if (t.startsWith('image')) return 'foto';
    return 'documento';
  };
  const comprimirFotoN = (file) => new Promise((res, rej) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) { const r = Math.min(MAX / width, MAX / height); width = Math.round(width * r); height = Math.round(height * r); }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagem inválida')); };
    img.src = url;
  });
  const addFotoN = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const dataURL = await comprimirFotoN(file);
      setAnexosNovos(l => [...l, { nome: file.name || `foto-${l.length + 1}.jpg`, dataURL, mime: 'image/jpeg', categoria: 'foto' }]);
    } catch (e) { setErro('Não consegui ler essa imagem. Tente outra.'); }
  };
  const addArquivoN = (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    setAnexosNovos(l => [...l, { nome: file.name, file, mime: file.type || 'application/octet-stream', categoria: categoriaArq(file) }]);
  };

  const tipoAtual = tiposTrabalho.find(t => t.nome === tipoNome);
  const etapasPreview = itens.length ? etapasDeItens(tiposTrabalho, itens.map(i => i.nome)) : [];
  const valorTotal = itens.reduce((s, i) => s + (tiposTrabalho.find(t => t.nome === i.nome)?.valor || 0) * i.quantidade, 0);
  // Prazo do trabalho = prazo do item mais demorado
  const prazoDiasCalc = itens.length
    ? Math.max(...itens.map(i => tiposTrabalho.find(t => t.nome === i.nome)?.prazoDias ?? 5))
    : (tipoAtual?.prazoDias ?? 5);

  useEffect(() => {
    if (!prazoEditadoManual) {
      setPrazo(proximoDiaUtil(addDias(dataEntrada, prazoDiasCalc), diasTrabalho));
    }
  }, [itens, tipoNome, dataEntrada, prazoEditadoManual, prazoDiasCalc]);

  const adicionarItem = () => {
    if (!tipoNome) return;
    setItens(lista => {
      const ja = lista.find(i => i.nome === tipoNome);
      if (ja) return lista.map(i => i.nome === tipoNome ? { ...i, quantidade: Math.min(32, i.quantidade + quantidade) } : i);
      return [...lista, { nome: tipoNome, quantidade }];
    });
    setQuantidade(1);
    setPrazoEditadoManual(false);
    setErro('');
  };
  const removerItem = (nome) => setItens(lista => lista.filter(i => i.nome !== nome));

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none bg-white";

  const handleSalvar = async () => {
    if (dentistas.length === 0) {
      setErro('Cadastre os dentistas em Ajustes antes de criar casos.');
      return;
    }
    if (!paciente.trim() || !dentista || !prazo) {
      setErro('Preencha paciente, dentista e prazo.');
      return;
    }
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item ao trabalho: escolha o item e toque em "Adicionar item".');
      return;
    }
    // Cada item tem seu valor (Ajustes) × quantidade; o valor do trabalho é a soma; prazo nunca cai no domingo
    const itensFinal = itens.map(i => {
      const t = tiposTrabalho.find(t => t.nome === i.nome);
      const unit = t?.valor || 0;
      return { nome: i.nome, quantidade: i.quantidade, valorUnit: unit, subtotal: Math.round(unit * i.quantidade * 100) / 100 };
    });
    const umSo = itensFinal.length === 1;
    const obsFinal = (umSo && itensFinal[0].quantidade > 1 ? `Quantidade: ${itensFinal[0].quantidade} unidades. ` : '') + observacoes.trim();
    setSalvando(true);
    try {
      // Sobe os anexos escolhidos ANTES de criar o caso (mesmo fluxo do Clinic)
      const anexos = [];
      for (const f of anexosNovos) {
        const anexoId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const origem = f.file || dataURLparaBlob(f.dataURL, f.mime || 'image/jpeg');
        const { url, caminho } = await window.arquivos.subir(origem, f.nome);
        anexos.push({ id: anexoId, nome: f.nome, mime: f.mime || 'image/jpeg', categoria: f.categoria || 'foto', tamanho: f.file ? f.file.size : Math.round((f.dataURL || '').length * 0.75), url, caminho });
      }
      onSalvar({
        paciente: paciente.trim(), dentista,
        tipoTrabalho: umSo ? itensFinal[0].nome : rotuloItens(itensFinal),
        itens: itensFinal,
        material,
        quantidade: umSo ? itensFinal[0].quantidade : 1,
        dataEntrada, prazo: proximoDiaUtil(prazo, diasTrabalho), observacoes: obsFinal,
        valor: Math.round(itensFinal.reduce((s, i) => s + i.subtotal, 0) * 100) / 100,
        anexos, dentes, gengiva,
      });
    } catch (e) {
      console.error('salvar caso', e);
      setErro('Não consegui enviar os anexos. Confira a internet e tente de novo.');
    }
    setSalvando(false);
  };

  // Visual igual ao "Novo Trabalho" do Special Clinic: cartões brancos com
  // passos numerados em dourado e botão principal dourado.
  const FONTE_LAB = "'Manrope', -apple-system, sans-serif";
  const cartaoSec = { position: 'relative', overflow: 'hidden', background: '#fff', border: '1px solid #E7E5E4', borderRadius: 18, padding: 15, boxShadow: '0 10px 26px -20px rgba(28,27,25,0.15)' };
  const inputEstilo = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #EEECE7', fontSize: 14, fontFamily: FONTE_LAB, outline: 'none', background: '#FAF9F7', boxSizing: 'border-box' };
  const Passo = ({ n, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
      <span style={{ width: 21, height: 21, borderRadius: 11, background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px -4px rgba(184,147,90,0.8)' }}>{n}</span>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#7A6234', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{children}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5 lg:max-w-[640px]" style={{ fontFamily: FONTE_LAB }}>
      {/* Passo 1 — paciente e dentista */}
      <div style={cartaoSec}>
        <Passo n="1">Paciente e dentista</Passo>
        <input style={{ ...inputEstilo, marginBottom: 9 }} value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nome do paciente *" />
        {dentistas.length > 0 ? (
          <div>
            <select style={inputEstilo} value={dentista} onChange={e => setDentista(e.target.value)}>
              {dentistas.map(d => <option key={d.nome} value={d.nome}>{d.nome}</option>)}
            </select>
            {(() => {
              const d = dentistas.find(x => x.nome === dentista);
              return d?.endereco ? (
                <div className="flex items-center gap-1 text-xs text-stone-400 mt-1.5">
                  <MapPin size={11} className="flex-shrink-0" /><span className="truncate">{d.endereco}</span>
                </div>
              ) : null;
            })()}
          </div>
        ) : (
          <div className="rounded-xl px-3 py-3 text-xs" style={{ background: '#FDECD8', color: '#B54708' }}>
            <div className="font-bold mb-1">Nenhum dentista cadastrado.</div>
            <div>Para criar casos, primeiro cadastre os dentistas com nome, endereço e telefone.</div>
            <button onClick={onIrParaAjustes} className="mt-2 px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: INK }}>Cadastrar em Ajustes →</button>
          </div>
        )}
      </div>

      {/* Passo 2 — itens do trabalho */}
      <div style={cartaoSec}>
        <div style={{ position: 'absolute', right: -12, top: -14, opacity: 0.05, pointerEvents: 'none' }}><EstrelaLogo size={52} color={INK} /></div>
        <Passo n="2">Itens do trabalho</Passo>
        <div className="flex flex-col gap-2">
          <select style={inputEstilo} value={tipoNome} onChange={e => setTipoNome(e.target.value)}>
            {tiposTrabalho.map(t => <option key={t.nome} value={t.nome}>{t.nome} ({t.prazoDias} dias • {formatHoras(tempoDoTipo(tiposTrabalho, t.nome))}{(t.valor || 0) > 0 ? ` • ${formatReais(t.valor)}` : ''})</option>)}
          </select>
          <div style={{ background: '#FAF9F7', border: '1px solid #EEECE7', borderRadius: 12, padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div className="flex items-center gap-3">
              <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg font-extrabold text-lg" style={{ color: INK, border: '1px solid #E7E5E4', background: '#fff' }}>−</button>
              <div className="text-center" style={{ minWidth: '52px' }}>
                <div className="font-extrabold text-lg" style={{ color: INK }}>{quantidade}</div>
                <div className="text-xs text-stone-400 -mt-1">{quantidade === 1 ? 'unidade' : 'unidades'}</div>
              </div>
              <button onClick={() => setQuantidade(q => Math.min(32, q + 1))} className="w-9 h-9 rounded-lg font-extrabold text-lg" style={{ color: INK, border: '1px solid #E7E5E4', background: '#fff' }}>＋</button>
            </div>
            <button onClick={adicionarItem} className="px-4 py-2.5 rounded-xl font-bold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>＋ Adicionar item</button>
          </div>
          {itens.length > 0 && (
            <div style={{ background: '#FAF9F7', border: '1px solid #EEECE7', borderRadius: 12, overflow: 'hidden' }}>
              {itens.map((it, idx) => {
                const t = tiposTrabalho.find(x => x.nome === it.nome);
                const unit = t?.valor || 0;
                return (
                  <div key={it.nome} className="flex items-center justify-between gap-2 px-3 py-2.5" style={idx > 0 ? { borderTop: '1px solid #EEECE7' } : undefined}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: INK }}>{it.nome}{it.quantidade > 1 ? ` × ${it.quantidade}` : ''}</div>
                      <div className="text-xs text-stone-400">{t ? `${t.prazoDias} dias` : ''}{unit > 0 ? ` • ${formatReais(unit)} / un.` : ' • sem valor no tipo (defina em Ajustes)'}</div>
                    </div>
                    {unit > 0 && <div className="text-sm font-extrabold flex-shrink-0" style={{ color: '#166B3A' }}>{formatReais(unit * it.quantidade)}</div>}
                    <button onClick={() => removerItem(it.nome)} className="w-8 h-8 rounded-lg font-bold flex-shrink-0" style={{ border: '1px solid #E7E5E4', background: '#fff', color: '#A8A29E' }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
          {valorTotal > 0 && (
            <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #24221E, #1C1B19)', border: '1px solid rgba(184,147,90,0.35)', borderRadius: 13, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ position: 'absolute', right: 42, top: -10, opacity: 0.1, pointerEvents: 'none' }}><EstrelaLogo size={34} color={GOLD} /></span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 800, letterSpacing: '0.1em' }}>VALOR TOTAL DO SERVIÇO</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: GOLD }}>{formatReais(valorTotal)}</span>
            </div>
          )}
          {itens.length === 0 && <div className="text-xs text-stone-400">Escolha o item, ajuste a quantidade e toque em <b>Adicionar item</b>. Pode adicionar vários itens no mesmo trabalho (ex.: coroa unitária + provisório).</div>}
          {etapasPreview.length > 1 && (
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
              <div className="font-bold mb-1 flex items-center gap-1"><ListChecks size={13} /> Etapas deste trabalho:</div>
              {etapasPreview.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <span>{i + 1}. {itens.length > 1 && e.item ? `${e.item} — ` : ''}{e.nome}{e.prova ? ' 🩺' : ''}</span>
                  <span className="font-semibold">{formatHoras(e.horas)}</span>
                </div>
              ))}
              <div className="mt-1 opacity-75">🩺 = etapa com prova na clínica</div>
            </div>
          )}
          <select style={inputEstilo} value={material} onChange={e => setMaterial(e.target.value)}>
            {MATERIAIS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Passo 3 — odontograma: quais dentes e onde tem gengiva */}
      <div style={cartaoSec}>
        <div style={{ position: 'absolute', left: -14, bottom: -16, opacity: 0.05, pointerEvents: 'none' }}><EstrelaLogo size={52} color={INK} /></div>
        <Passo n="3">Dentes do trabalho <span style={{ color: '#A8A29E', letterSpacing: 0, textTransform: 'none' }}>(opcional)</span></Passo>
        <OdontogramaEdit dentes={dentes} gengiva={gengiva} aoMudar={({ dentes: d, gengiva: g }) => { setDentes(d); setGengiva(g); }} />
      </div>

      {/* Passo 4 — anexos */}
      <div style={cartaoSec}>
        <Passo n="4">Anexos <span style={{ color: '#A8A29E', letterSpacing: 0, textTransform: 'none' }}>(opcional)</span></Passo>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            [Camera, 'Foto', camRefN],
            [Box, 'Vídeo', vidRefN],
            [Paperclip, 'Galeria', fotoRefN],
            [FileText, 'Arquivo', arqRefN],
          ].map(([Icone, rotulo, ref]) => (
            <button key={rotulo} onClick={() => ref.current && ref.current.click()}
              style={{ padding: '13px 4px', borderRadius: 14, border: '1px solid #EEECE7', background: '#FAF9F7', cursor: 'pointer', fontFamily: FONTE_LAB, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 34, height: 34, borderRadius: 17, background: 'linear-gradient(135deg, #F3EBDA, #E8D5B0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icone size={17} color="#7A6234" strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: INK }}>{rotulo}</span>
            </button>
          ))}
        </div>
        {anexosNovos.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {anexosNovos.map((f, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {String(f.mime || '').startsWith('image') && f.dataURL ? (
                  <img src={f.dataURL} alt={f.nome} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12, border: '1px solid #E7E5E4' }} />
                ) : (
                  <div style={{ width: 84, height: 84, borderRadius: 12, border: '1px solid #E7E5E4', background: '#FAF9F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 }}>
                    <span style={{ fontSize: 22 }}>{f.categoria === 'video' ? '🎥' : f.categoria === 'stl' ? '🦷' : '📄'}</span>
                    <span style={{ fontSize: 9, color: '#78716C', fontWeight: 700, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 72 }}>{f.nome}</span>
                  </div>
                )}
                <button onClick={() => setAnexosNovos(fs => fs.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 'none', background: INK, color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: '22px', padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <input ref={camRefN} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={addFotoN} />
        <input ref={vidRefN} type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={addArquivoN} />
        <input ref={fotoRefN} type="file" accept="image/*" style={{ display: 'none' }} onChange={addFotoN} />
        <input ref={arqRefN} type="file" style={{ display: 'none' }} onChange={addArquivoN} />
      </div>

      {/* Passo 5 — datas */}
      <div style={cartaoSec}>
        <Passo n="5">Datas</Passo>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8A8580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Entrada *</div>
            <input type="date" style={inputEstilo} value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#8A8580', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Prazo de entrega *</div>
            <input type="date" style={inputEstilo} value={prazo} onChange={e => { setPrazo(e.target.value); setPrazoEditadoManual(true); }} />
          </div>
        </div>
        {itens.length > 0 && !prazoEditadoManual && prazo && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl mt-2" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
            <Timer size={14} />
            <span>Prazo calculado: {prazoDiasCalc} dias (item mais demorado) → entrega em <b>{formatDateBR(prazo)}</b> • Serviço total: <b>{formatHoras(etapasPreview.reduce((s, e) => s + (e.horas || 0), 0))}</b></span>
          </div>
        )}
      </div>

      {/* Passo 6 — observações */}
      <div style={cartaoSec}>
        <Passo n="6">Observações <span style={{ color: '#A8A29E', letterSpacing: 0, textTransform: 'none' }}>(opcional)</span></Passo>
        <textarea style={{ ...inputEstilo, minHeight: 80, resize: 'vertical' }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Cor, dente(s), instruções..." />
      </div>

      {erro && (
        <div style={{ background: '#FCE4E4', border: '1px solid #F5B5B5', borderRadius: 12, padding: '11px 13px', color: '#B42318', fontSize: 12.5, fontWeight: 700 }}>{erro}</div>
      )}

      <button onClick={handleSalvar} disabled={salvando}
        style={{ width: '100%', marginTop: 4, padding: 16, borderRadius: 15, border: 'none', background: salvando ? '#D6D3D1' : 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, fontWeight: 800, fontSize: 15.5, cursor: 'pointer', fontFamily: FONTE_LAB, boxShadow: salvando ? 'none' : '0 14px 30px -14px rgba(184,147,90,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
        {salvando ? 'Enviando anexos...' : <>Salvar trabalho <span style={{ fontSize: 17 }}>→</span></>}
      </button>
      <button onClick={onCancelar}
        style={{ width: '100%', padding: 13, borderRadius: 13, border: '1px solid #E7E5E4', background: '#fff', color: '#78716C', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: FONTE_LAB }}>
        Cancelar
      </button>
      <div className="text-xs text-stone-400 text-center" style={{ lineHeight: 1.5 }}>
        O caso já entra <b>em produção</b> — o dentista é avisado quando a equipe tocar em "Iniciar" na primeira etapa. Fotos e arquivos podem ser anexados depois de salvar.
      </div>
    </div>
  );
}

// Editor de etapas com rascunho: as mudanças só valem depois de "Salvar alterações"
function EditorEtapas({ tipo, onUpdateTipo, medias }) {
  const [etapas, setEtapasDraft] = useState(tipo.etapas || []);
  const [comissao, setComissao] = useState(tipo.comissao ?? 0);
  const [valor, setValor] = useState(tipo.valor ?? 0);
  const [novoNome, setNovoNome] = useState('');
  const [novasHoras, setNovasHoras] = useState('1');
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    setEtapasDraft(tipo.etapas || []);
    setComissao(tipo.comissao ?? 0);
    setValor(tipo.valor ?? 0);
    setSalvo(false);
  }, [tipo.nome]);

  const alterado = JSON.stringify(etapas) !== JSON.stringify(tipo.etapas || [])
    || comissao !== (tipo.comissao ?? 0) || valor !== (tipo.valor ?? 0);

  const addEtapa = () => {
    const nome = novoNome.trim();
    const horas = parseFloat(String(novasHoras).replace(',', '.'));
    if (!nome || isNaN(horas) || horas <= 0) return;
    setEtapasDraft([...etapas, { nome, horas, prova: false }]);
    setNovoNome('');
    setNovasHoras('1');
    setSalvo(false);
  };

  const salvar = () => {
    onUpdateTipo(tipo.nome, { etapas, comissao, valor });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  };
  const cancelar = () => {
    setEtapasDraft(tipo.etapas || []);
    setComissao(tipo.comissao ?? 0);
    setValor(tipo.valor ?? 0);
  };

  return (
    <div className="mt-2 rounded-xl bg-stone-50 p-3">
      {/* Valor e comissão do tipo */}
      <div className="flex items-center gap-2 pb-2">
        <DollarSign size={14} style={{ color: VERDE }} />
        <span className="text-xs font-semibold flex-1" style={{ color: INK }}>Valor do serviço:</span>
        <span className="text-xs text-stone-400">R$</span>
        <InputNumero className="px-2 py-1 rounded-lg border border-stone-200 text-xs outline-none bg-white text-center" style={{ width: '72px' }}
          valor={valor} min={0} onValor={v => { setValor(v); setSalvo(false); }} />
      </div>
      <div className="flex items-center gap-2 pb-2.5 mb-1 border-b border-stone-200">
        <Users size={14} style={{ color: GOLD }} />
        <span className="text-xs font-semibold flex-1" style={{ color: INK }}>Comissão por trabalho:</span>
        <span className="text-xs text-stone-400">R$</span>
        <InputNumero className="px-2 py-1 rounded-lg border border-stone-200 text-xs outline-none bg-white text-center" style={{ width: '72px' }}
          valor={comissao} min={0} onValor={v => { setComissao(v); setSalvo(false); }} />
      </div>

      {etapas.map((e, i) => {
        const m = medias?.[`${tipo.nome}|${e.nome}`];
        const mediaHoras = m ? Math.round((m.media / 60) * 4) / 4 : null;
        return (
          <div key={i} className="py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400 w-4 flex-shrink-0">{i + 1}.</span>
              <span className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: INK }}>{e.nome}</span>
              <InputNumero className="px-1.5 py-1 rounded-lg border border-stone-200 text-xs outline-none bg-white text-center flex-shrink-0" style={{ width: '46px' }}
                valor={e.horas} min={0.25} onValor={v => { setEtapasDraft(etapas.map((et, j) => j === i ? { ...et, horas: v } : et)); setSalvo(false); }} />
              <span className="text-xs text-stone-400 flex-shrink-0">h</span>
              <button onClick={() => { setEtapasDraft(etapas.map((et, j) => j === i ? { ...et, prova: !et.prova } : et)); setSalvo(false); }}
                className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                style={e.prova ? { background: ROXO_SOFT, color: ROXO } : { background: '#F0EFEC', color: '#A8A29E' }}>
                <Stethoscope size={11} /> prova
              </button>
              <button onClick={() => { setEtapasDraft(etapas.filter((_, j) => j !== i)); setSalvo(false); }} className="p-0.5 flex-shrink-0">
                <Trash2 size={13} className="text-stone-300" />
              </button>
            </div>
            {m && (
              <div className="flex items-center gap-2 ml-6 mt-0.5">
                <TrendingUp size={10} style={{ color: mediaHoras > e.horas ? '#EA580C' : VERDE }} />
                <span className="text-xs text-stone-400">Média real: <b style={{ color: mediaHoras > e.horas ? '#EA580C' : VERDE }}>{formatMinutos(m.media)}</b> ({m.n} {m.n === 1 ? 'registro' : 'registros'})</span>
                {mediaHoras && Math.abs(mediaHoras - e.horas) >= 0.25 && (
                  <button onClick={() => { setEtapasDraft(etapas.map((et, j) => j === i ? { ...et, horas: mediaHoras } : et)); setSalvo(false); }}
                    className="text-xs font-bold px-1.5 py-0.5 rounded-lg" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
                    usar média
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-200">
        <input className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-stone-200 text-xs outline-none bg-white" value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nova etapa (ex.: Plano de cera)" onKeyDown={e => e.key === 'Enter' && addEtapa()} />
        <input type="text" inputMode="decimal" className="px-1.5 py-1.5 rounded-lg border border-stone-200 text-xs outline-none bg-white text-center flex-shrink-0" style={{ width: '46px' }} value={novasHoras}
          onFocus={e => { const el = e.target; requestAnimationFrame(() => el.select()); }}
          onChange={e => setNovasHoras(e.target.value.replace(/[^\d.,]/g, ''))} />
        <span className="text-xs text-stone-400 flex-shrink-0">h</span>
        <button onClick={addEtapa} className="p-1.5 rounded-lg text-white flex-shrink-0" style={{ background: INK }}><Plus size={13} /></button>
      </div>

      {/* Salvar / Cancelar com confirmação */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-200">
        {alterado && (
          <button onClick={cancelar} className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-stone-200 text-stone-500">Cancelar</button>
        )}
        <button onClick={salvar} disabled={!alterado}
          className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
          style={{ background: alterado ? VERDE : '#E7E5E4', color: alterado ? 'white' : '#A8A29E' }}>
          <Check size={14} /> Salvar alterações
        </button>
      </div>
      {alterado && <div className="text-xs font-semibold mt-2" style={{ color: '#EA580C' }}>⚠ Há alterações não salvas neste tipo de trabalho.</div>}
      {salvo && !alterado && <div className="text-xs font-semibold mt-2" style={{ color: VERDE }}>✓ Alterações salvas com sucesso!</div>}
      <p className="text-xs text-stone-400 mt-2">A <b>média real</b> vem dos tempos cronometrados pela equipe — use-a para deixar as estimativas cada vez mais precisas.</p>
    </div>
  );
}

// Pedidos vindos do Special Clinic aguardando aceite do laboratório
function PedidosClinica({ solicitacoes, onAceitar, onRecusar }) {
  const pendentes = solicitacoes.filter(s => s.status === 'pendente');
  if (pendentes.length === 0) return null;
  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: 'white', border: `2px solid ${GOLD}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Inbox size={16} color={GOLD} />
        <h2 className="text-sm font-bold flex-1" style={{ color: INK }}>Pedidos da clínica</h2>
        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full" style={{ background: GOLD_SOFT, color: '#7A6234' }}>{pendentes.length}</span>
      </div>
      <div className="flex flex-col gap-3">
        {pendentes.map(s => (
          <div key={s.id} className="rounded-xl p-3" style={{ background: '#FAF9F7', border: '1px solid #E7E5E4' }}>
            <div className="text-sm font-bold" style={{ color: INK }}>{s.paciente}</div>
            <div className="text-xs text-stone-500 mt-0.5">{s.dentista} • {s.tipoTrabalho}{s.dataHora ? ` • ${formatDataHoraBR(s.dataHora)}` : ''}</div>
            {s.obs && <div className="text-xs text-stone-500 mt-1.5 px-2.5 py-2 rounded-lg bg-white border border-stone-100">💬 {s.obs}</div>}
            {(s.anexos || []).length > 0 && (
              <div className="text-xs mt-1.5 font-semibold" style={{ color: ROXO }}>📎 {s.anexos.length} {s.anexos.length === 1 ? 'foto anexada' : 'fotos anexadas'} (vão junto para o caso)</div>
            )}
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => onAceitar(s)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: VERDE }}>
                <Check size={14} /> Aceitar e produzir
              </button>
              <button onClick={() => onRecusar(s)} className="px-4 py-2.5 rounded-xl text-xs font-bold" style={{ background: '#F0EFEC', color: '#78716C' }}>
                Recusar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chave Pix do laboratório — usada pelo dentista para pagar pelo Special Clinic
function ChavePixCard({ chavePix, onSalvar }) {
  const [texto, setTexto] = useState(chavePix || '');
  const [salvo, setSalvo] = useState(false);
  useEffect(() => { setTexto(chavePix || ''); }, [chavePix]);
  return (
    <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
      <div className="flex items-center gap-2 mb-1">
        <DollarSign size={16} color={GOLD} />
        <h2 className="text-sm font-bold" style={{ color: INK }}>Chave Pix do laboratório</h2>
      </div>
      <p className="text-xs text-stone-400 mb-3">Os dentistas veem essa chave no Special Clinic para pagar o que devem — com o código "copia e cola" já no valor certo.</p>
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none bg-white" value={texto}
          onChange={e => { setTexto(e.target.value); setSalvo(false); }} placeholder="CPF, CNPJ, celular, e-mail ou chave aleatória" />
        <button onClick={() => { onSalvar(texto.trim()); setSalvo(true); }} className="px-4 rounded-xl text-white font-bold text-sm" style={{ background: salvo ? VERDE : INK }}>
          {salvo ? '✓' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function AjustesView({ dentistas, tiposTrabalho, horasDia, diasTrabalho, onSetDiasTrabalho, horasPorDia, onSetHorasPorDia, funcionarios, ehGestor, medias, onAddDentista, onUpdateDentista, onRemoveDentista, onAddTipo, onUpdateTipo, onRemoveTipo, onSetHorasDia, onAddFuncionario, onUpdateFuncionario, onRemoveFuncionario, onAbrirEquipe, autoAjuste, onSetAutoAjuste, chavePix, onSetChavePix, pessoas, onSetPessoas }) {
  const [novoDentista, setNovoDentista] = useState('');
  const [novoEndereco, setNovoEndereco] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoDentEmail, setNovoDentEmail] = useState('');
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoPrazo, setNovoTipoPrazo] = useState('5');
  const [novoFuncNome, setNovoFuncNome] = useState('');
  const [novoFuncEmail, setNovoFuncEmail] = useState('');
  const [novoFuncPin, setNovoFuncPin] = useState('');
  const [novoFuncGestor, setNovoFuncGestor] = useState(false);
  const [erroDentista, setErroDentista] = useState('');
  const [erroTipo, setErroTipo] = useState('');
  const [erroFunc, setErroFunc] = useState('');
  const [dentistaCombinado, setDentistaCombinado] = useState(null); // dentista com o editor de combinado de pagamento aberto
  const [expandido, setExpandido] = useState(null);

  const inputClass = "px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none bg-white";

  const handleAddDentista = () => {
    const nome = novoDentista.trim();
    const endereco = novoEndereco.trim();
    const telefone = novoTelefone.trim();
    if (!nome || !endereco || !telefone) {
      setErroDentista('Cadastro completo obrigatório: nome, endereço e telefone.');
      return;
    }
    if (dentistas.some(d => d.nome.toLowerCase() === nome.toLowerCase())) {
      setErroDentista('Esse dentista já está cadastrado.');
      return;
    }
    const email = novoDentEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErroDentista('E-mail inválido. Use o e-mail Google do dentista (dá acesso ao Special Clinic).');
      return;
    }
    onAddDentista({ nome, endereco, telefone, email: email || null });
    setNovoDentista('');
    setNovoEndereco('');
    setNovoTelefone('');
    setNovoDentEmail('');
    setErroDentista('');
  };

  const handleAddTipo = () => {
    const nome = novoTipoNome.trim();
    const dias = parseInt(novoTipoPrazo);
    if (!nome || isNaN(dias) || dias < 1) {
      setErroTipo('Informe o nome do trabalho e o prazo em dias.');
      return;
    }
    if (tiposTrabalho.some(t => t.nome.toLowerCase() === nome.toLowerCase())) {
      setErroTipo('Esse tipo de trabalho já existe.');
      return;
    }
    onAddTipo(nome, dias);
    setNovoTipoNome('');
    setNovoTipoPrazo('5');
    setErroTipo('');
    setExpandido(nome);
  };

  const handleAddFuncionario = () => {
    const nome = novoFuncNome.trim();
    if (!nome) return;
    if (funcionarios.some(f => f.nome.toLowerCase() === nome.toLowerCase())) {
      setErroFunc('Esse funcionário já está cadastrado.');
      return;
    }
    if (novoFuncPin && novoFuncPin.length !== 4) {
      setErroFunc('O PIN deve ter 4 dígitos (ou deixe vazio).');
      return;
    }
    const email = novoFuncEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErroFunc('E-mail inválido. Use o e-mail da conta Google do funcionário.');
      return;
    }
    // O primeiro funcionário cadastrado é sempre gestor (senão ninguém administra o app)
    const seraGestor = funcionarios.length === 0 ? true : novoFuncGestor;
    onAddFuncionario({ id: Date.now().toString(36), nome, email: email || null, pin: novoFuncPin || null, gestor: seraGestor });
    setNovoFuncNome('');
    setNovoFuncEmail('');
    setNovoFuncPin('');
    setNovoFuncGestor(false);
    setErroFunc('');
  };

  // Instalação disponível quando o app roda no navegador (some no app já instalado/nativo)
  const mostrarInstalar = typeof window !== 'undefined' && !window.Capacitor
    && !(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    && !window.navigator.standalone;
  const cartaoInstalar = mostrarInstalar ? (
    <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Download size={16} color={GOLD} />
        <h2 className="font-bold" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Instalar o aplicativo</h2>
      </div>
      <p className="text-xs text-stone-400 mb-3">Instale o Lab Special neste aparelho: no Android dá para baixar o app, e no iPhone ele vai para a Tela de Início.</p>
      <a href="/instalar.html" className="block text-center py-3 rounded-xl font-bold text-sm" style={{ background: INK, color: GOLD, textDecoration: 'none' }}>
        📲 Instalar / baixar o app
      </a>
    </div>
  ) : null;

  // Técnicos não alteram configurações — acesso restrito ao gestor
  if (!ehGestor) {
    return (
      <div className="flex flex-col gap-4">
        {cartaoInstalar}
        <div className="text-center py-12 px-4 rounded-2xl bg-white border border-stone-200">
          <Lock size={26} className="text-stone-300 mx-auto mb-3" />
          <div className="text-stone-500 text-sm font-medium">Ajustes disponíveis apenas para gestores.</div>
          <div className="text-stone-400 text-xs mt-1">Dentistas, tipos de trabalho, prazos, comissões e equipe são configurados pelo gestor do laboratório.</div>
        </div>
        <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
          <div className="text-sm font-bold mb-1" style={{ color: INK }}>O que você pode fazer:</div>
          <div className="text-xs text-stone-500 leading-relaxed">Ver e trabalhar nos casos, usar a tela "Dia", cronometrar suas etapas com Iniciar/Concluir, enviar trabalhos para prova e finalizar. Suas comissões e tempos ficam em <b>Meu desempenho</b>, no Início.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:max-w-[680px]">
      {cartaoInstalar}
      <ChavePixCard chavePix={chavePix} onSalvar={onSetChavePix} />
      {/* Autorregulação de tempos */}
      <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
        <div className="flex items-center gap-2">
          <TrendingUp size={16} color={autoAjuste ? VERDE : '#A8A29E'} />
          <div className="flex-1">
            <h2 className="font-bold" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Autorregulação de tempos</h2>
            <p className="text-xs text-stone-400">Com 3+ tempos cronometrados numa etapa, a estimativa passa a seguir a média real automaticamente.</p>
          </div>
          <button onClick={() => onSetAutoAjuste(!autoAjuste)} className="flex-shrink-0 rounded-full p-0.5" style={{ width: '46px', height: '26px', background: autoAjuste ? VERDE : '#D6D3D1', transition: 'background 0.2s' }}>
            <span className="block w-5 h-5 rounded-full bg-white shadow" style={{ transform: autoAjuste ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
          </button>
        </div>
        {autoAjuste && (
          <div className="text-xs mt-3 px-3 py-2 rounded-xl" style={{ background: '#DCF3E4', color: '#166B3A' }}>
            Ativo — as horas das etapas vão se ajustando sozinhas conforme a equipe cronometra. ✓
          </div>
        )}
      </div>

      {/* Equipe */}
      <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} color={GOLD} />
          <h2 className="font-bold flex-1" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Equipe</h2>
          {ehGestor && funcionarios.length > 0 && (
            <button onClick={onAbrirEquipe} className="flex items-center gap-1 text-xs font-bold" style={{ color: GOLD }}>
              <BarChart3 size={13} /> Relatório
            </button>
          )}
        </div>
        <p className="text-xs text-stone-400 mb-3">Cada funcionário entra pelo botão no topo do app. Etapas e comissões ficam registradas no nome de quem está ativo. Gestores veem o relatório da equipe.{funcionarios.length === 0 ? ' O primeiro cadastrado será automaticamente o gestor.' : ''}</p>

        <div className="flex flex-col gap-2 mb-1">
          <input className={inputClass} value={novoFuncNome} onChange={e => { setNovoFuncNome(e.target.value); setErroFunc(''); }} placeholder="Nome do funcionário" />
          <input type="email" className={inputClass} value={novoFuncEmail} onChange={e => { setNovoFuncEmail(e.target.value); setErroFunc(''); }} placeholder="E-mail Google (libera o acesso ao app)" />
          <div className="flex gap-2">
            <input type="password" inputMode="numeric" maxLength={4} className={inputClass + ' flex-1'} value={novoFuncPin} onChange={e => setNovoFuncPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN 4 dígitos (opcional)" />
            <button onClick={() => setNovoFuncGestor(!novoFuncGestor)} className="px-3 rounded-xl text-xs font-bold flex items-center gap-1"
              style={novoFuncGestor ? { background: GOLD_SOFT, color: '#7A6234', border: `1.5px solid ${GOLD}` } : { background: '#F0EFEC', color: '#A8A29E' }}>
              gestor
            </button>
            <button onClick={handleAddFuncionario} className="px-4 rounded-xl text-white font-bold text-sm" style={{ background: INK }}>Adicionar</button>
          </div>
        </div>
        {erroFunc && <div className="text-xs text-red-600 font-medium mb-2">{erroFunc}</div>}

        {funcionarios.length > 0 && (
          <div className="flex flex-col mt-3">
            {funcionarios.map(f => (
              <div key={f.id} className="flex items-center gap-3 py-2.5 border-t border-stone-100">
                <span className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>
                  {f.nome.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: INK }}>{f.nome}</div>
                  <div className="text-xs text-stone-400 flex items-center gap-1.5">
                    {f.gestor ? <span className="font-semibold" style={{ color: GOLD }}>gestor</span> : 'técnico'}
                    {f.pin && <span className="flex items-center gap-0.5"><Lock size={10} /> PIN</span>}
                    {f.email && <span className="truncate">{f.email}</span>}
                  </div>
                </div>
                <button onClick={() => onUpdateFuncionario(f.id, { gestor: !f.gestor })} className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={f.gestor ? { background: GOLD_SOFT, color: '#7A6234' } : { background: '#F0EFEC', color: '#A8A29E' }}>
                  gestor
                </button>
                <button onClick={() => onRemoveFuncionario(f.id)} className="p-1"><Trash2 size={15} className="text-stone-300" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Hourglass size={16} color={GOLD} />
          <h2 className="font-bold" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Dias e horários de trabalho</h2>
        </div>
        <p className="text-xs text-stone-400 mb-3">Marque os dias em que o laboratório funciona e defina as horas de bancada de cada um (ex.: sábado só até meio-dia = 4h). Prazos que caírem em dia de folga pulam para o próximo dia de trabalho, e a carga de cada dia usa a capacidade dele.</p>

        <div className="flex gap-1.5 mb-3">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((rotulo, idx) => {
            const ativo = diasTrabalho.includes(idx);
            return (
              <button key={idx}
                onClick={() => {
                  if (ativo && diasTrabalho.length === 1) return; // pelo menos 1 dia de trabalho
                  if (ativo) {
                    onSetDiasTrabalho(diasTrabalho.filter(d => d !== idx));
                  } else {
                    onSetDiasTrabalho([...diasTrabalho, idx].sort());
                    if (!(horasPorDia?.[idx] > 0)) {
                      const novas = [...(horasPorDia || [0, 0, 0, 0, 0, 0, 0])];
                      novas[idx] = HORAS_DIA_PADRAO;
                      onSetHorasPorDia(novas);
                    }
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={ativo ? { background: INK, color: GOLD } : { background: '#F0EFEC', color: '#A8A29E' }}>
                {rotulo}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col">
          {[1, 2, 3, 4, 5, 6, 0].filter(idx => diasTrabalho.includes(idx)).map(idx => (
            <div key={idx} className="flex items-center gap-3 py-2 border-t border-stone-100">
              <span className="text-sm font-medium flex-1 capitalize" style={{ color: INK }}>{DIAS_SEMANA[idx]}</span>
              <InputNumero min={0.5} max={24}
                className="px-2 py-1.5 rounded-lg border border-stone-200 text-sm outline-none bg-white text-center" style={{ width: '64px' }}
                valor={horasPorDia?.[idx] ?? ''}
                onValor={v => {
                  const novas = [...(horasPorDia || [0, 0, 0, 0, 0, 0, 0])];
                  novas[idx] = v;
                  onSetHorasPorDia(novas);
                }} />
              <span className="text-xs text-stone-400" style={{ width: '38px' }}>horas</span>
            </div>
          ))}
        </div>

        {/* Quantas pessoas produzem ao mesmo tempo — multiplica a capacidade do dia */}
        <div className="mt-3 pt-3 border-t border-stone-100">
          <div className="flex items-center gap-3">
            <Users size={16} color={GOLD} className="flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Pessoas na produção</div>
              <div className="text-xs text-stone-400">Multiplica as horas de cada dia (ex.: 8h × {pessoas >= 1 ? pessoas : 1} {pessoas === 1 ? 'pessoa' : 'pessoas'} = {(pessoas >= 1 ? pessoas : 1) * 8}h disponíveis)</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => onSetPessoas(Math.max(1, (pessoas || 1) - 1))} disabled={(pessoas || 1) <= 1}
                className="w-9 h-9 rounded-xl font-extrabold text-lg disabled:opacity-30" style={{ background: '#F0EFEC', color: INK }}>−</button>
              <span className="text-lg font-extrabold text-center" style={{ color: INK, width: '28px' }}>{pessoas >= 1 ? pessoas : 1}</span>
              <button onClick={() => onSetPessoas(Math.min(20, (pessoas || 1) + 1))}
                className="w-9 h-9 rounded-xl font-extrabold text-lg" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>+</button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
        <div className="flex items-center gap-2 mb-3">
          <UserPlus size={16} color={GOLD} />
          <h2 className="font-bold" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Dentistas / Clínicas</h2>
        </div>

        <div className="flex flex-col gap-2 mb-1">
          <input className={inputClass} value={novoDentista} onChange={e => { setNovoDentista(e.target.value); setErroDentista(''); }} placeholder="Nome do dentista ou clínica *" />
          <input type="email" className={inputClass} value={novoDentEmail} onChange={e => { setNovoDentEmail(e.target.value); setErroDentista(''); }} placeholder="E-mail Google (acesso ao Special Clinic)" />
          <input className={inputClass} value={novoEndereco} onChange={e => { setNovoEndereco(e.target.value); setErroDentista(''); }} placeholder="Endereço da clínica *" />
          <div className="flex gap-2">
            <input type="tel" className={inputClass + ' flex-1'} value={novoTelefone} onChange={e => { setNovoTelefone(e.target.value); setErroDentista(''); }} placeholder="Telefone / WhatsApp *" onKeyDown={e => e.key === 'Enter' && handleAddDentista()} />
            <button onClick={handleAddDentista} className="px-4 rounded-xl text-white font-bold text-sm" style={{ background: INK }}>Adicionar</button>
          </div>
        </div>
        {erroDentista && <div className="text-xs text-red-600 font-medium mb-2">{erroDentista}</div>}

        {dentistas.length === 0 ? (
          <div className="text-xs text-stone-400 mt-3">Nenhum dentista cadastrado. Os casos só podem ser criados para dentistas cadastrados aqui — com endereço e telefone completos.</div>
        ) : (
          <div className="flex flex-col mt-3">
            {dentistas.map(d => (
              <div key={d.nome} className="py-2.5 border-t border-stone-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: INK }}>{d.nome}</span>
                  {d.endereco && (
                    <a href={mapsUrl(d.endereco)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
                      <MapPin size={11} /> Maps
                    </a>
                  )}
                  <button onClick={() => onRemoveDentista(d.nome)} className="p-1 flex-shrink-0"><Trash2 size={15} className="text-stone-300" /></button>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={12} className="text-stone-300 flex-shrink-0" />
                  <input className="flex-1 px-2 py-1 rounded-lg border border-stone-200 text-xs outline-none bg-white" value={d.endereco || ''} onChange={e => onUpdateDentista(d.nome, { endereco: e.target.value })} placeholder="Endereço da clínica" />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Send size={12} className="text-stone-300 flex-shrink-0" />
                  <input type="tel" className="flex-1 px-2 py-1 rounded-lg border border-stone-200 text-xs outline-none bg-white" value={d.telefone || ''} onChange={e => onUpdateDentista(d.nome, { telefone: e.target.value })} placeholder="Telefone / WhatsApp" />
                </div>
                {/* Combinado de pagamento: dia marcado do mês OU prazo em dias após a entrega */}
                <button onClick={() => setDentistaCombinado(dentistaCombinado === d.nome ? null : d.nome)}
                  className="flex items-center gap-1.5 mt-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg"
                  style={(d.diasPagamento ?? null) !== null || d.dataPagamento
                    ? { background: '#DCF3E4', color: '#166B3A' }
                    : { background: '#F0EFEC', color: '#57534E' }}>
                  <DollarSign size={12} />
                  {d.dataPagamento
                    ? `Pagamento: dia marcado ${formatDateBR(d.dataPagamento)}`
                    : (d.diasPagamento ?? null) !== null
                      ? `Pagamento: até ${d.diasPagamento} ${d.diasPagamento === 1 ? 'dia' : 'dias'} após a entrega`
                      : 'Definir combinado de pagamento'}
                  <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{dentistaCombinado === d.nome ? '▲' : '▼'}</span>
                </button>
                {dentistaCombinado === d.nome && (
                  <div className="mt-1.5">
                    <PrazoPagamentoEdit
                      atual={d.prazoPagamento}
                      onSalvar={(texto) => onUpdateDentista(d.nome, { prazoPagamento: texto || null })}
                      diasAtual={d.diasPagamento ?? null}
                      onSalvarDias={(n) => onUpdateDentista(d.nome, { diasPagamento: n ?? null, dataPagamento: null })}
                      dataAtual={d.dataPagamento || null}
                      onSalvarData={(data) => onUpdateDentista(d.nome, { dataPagamento: data || null, diasPagamento: data ? null : (d.diasPagamento ?? null) })} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Timer size={16} color={GOLD} />
          <h2 className="font-bold" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tipos de trabalho, etapas e comissões</h2>
        </div>
        <p className="text-xs text-stone-400 mb-3">Toque no tipo para editar etapas, horas, provas e a comissão. As médias reais cronometradas aparecem embaixo de cada etapa.</p>

        <div className="flex gap-2 mb-1">
          <input className={inputClass + ' flex-1 min-w-0'} value={novoTipoNome} onChange={e => { setNovoTipoNome(e.target.value); setErroTipo(''); }} placeholder="Novo tipo de trabalho" />
          <input type="text" inputMode="numeric" className={inputClass} style={{ width: '58px' }} value={novoTipoPrazo}
            onFocus={e => { const el = e.target; requestAnimationFrame(() => el.select()); }}
            onChange={e => setNovoTipoPrazo(e.target.value.replace(/[^\d]/g, ''))} placeholder="dias" />
          <button onClick={handleAddTipo} className="px-3 rounded-xl text-white font-bold text-sm flex-shrink-0" style={{ background: INK }}><Plus size={16} /></button>
        </div>
        <div className="text-xs text-stone-400 mb-2 text-right pr-12">prazo em dias ↑</div>
        {erroTipo && <div className="text-xs text-red-600 font-medium mb-2">{erroTipo}</div>}

        <div className="flex flex-col">
          {tiposTrabalho.map(t => {
            const aberto = expandido === t.nome;
            const totalHoras = tempoDoTipo(tiposTrabalho, t.nome);
            const numProvas = (t.etapas || []).filter(e => e.prova).length;
            return (
              <div key={t.nome} className="py-2.5 border-t border-stone-100">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setExpandido(aberto ? null : t.nome)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <ChevronDown size={15} className="text-stone-400 flex-shrink-0" style={{ transform: aberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium block truncate" style={{ color: INK }}>{t.nome}</span>
                      <span className="text-xs text-stone-400">{(t.etapas || []).length} etapas • {formatHoras(totalHoras)}{numProvas > 0 ? ` • ${numProvas} ${numProvas === 1 ? 'prova' : 'provas'}` : ''}{(t.comissao || 0) > 0 ? ` • ${formatReais(t.comissao)}` : ''}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <InputNumero inteiro min={1} className="px-2 py-1 rounded-lg border border-stone-200 text-sm outline-none bg-white text-center" style={{ width: '48px' }} valor={t.prazoDias} onValor={v => onUpdateTipo(t.nome, { prazoDias: v })} />
                    <span className="text-xs text-stone-400">dias</span>
                    <button onClick={() => onRemoveTipo(t.nome)} className="p-1 ml-1"><Trash2 size={15} className="text-stone-300" /></button>
                  </div>
                </div>
                {aberto && <EditorEtapas tipo={t} onUpdateTipo={onUpdateTipo} medias={medias} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sair da conta Google deste aparelho (só existe na versão em nuvem) */}
      {typeof window !== 'undefined' && window.sairDaConta && (
        <button onClick={() => { if (confirm('Sair da conta neste aparelho? Você volta para a tela de entrada.')) window.sairDaConta(); }}
          className="w-full mt-4 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 bg-white"
          style={{ color: '#B42318', border: '1px solid #F5B5B5' }}>
          <LogOut size={16} /> Sair da conta
        </button>
      )}
    </div>
  );
}

// ─── Relatório da equipe (só gestor) ───
function EquipeView({ funcionarios, comissoes, historicoTempos, tiposTrabalho, ehGestor, medias, onUpdateTipo, onVoltar, onAbrirMeu }) {
  const [funcionarioSel, setFuncionarioSel] = useState(null);
  if (!ehGestor) {
    return (
      <div className="text-center py-14 px-4 rounded-2xl bg-white border border-stone-200">
        <Lock size={26} className="text-stone-300 mx-auto mb-3" />
        <div className="text-stone-500 text-sm font-medium">Acesso restrito a gestores.</div>
        <div className="text-stone-400 text-xs mt-1">Entre com um usuário marcado como gestor para ver este relatório.</div>
      </div>
    );
  }

  // ── Ficha individual do funcionário ──
  if (funcionarioSel) {
    const f = funcionarios.find(x => x.id === funcionarioSel);
    if (!f) { setFuncionarioSel(null); return null; }
    const mes = mesAtualISO();
    const mesNome = MESES[parseInt(mes.split('-')[1]) - 1];
    const minhasComissoes = comissoes.filter(c => c.funcionarioId === f.id);
    const comissoesDoMes = minhasComissoes.filter(c => c.data.startsWith(mes));
    const totalMes = comissoesDoMes.reduce((s, c) => s + c.valor, 0);
    const totalGeral = minhasComissoes.reduce((s, c) => s + c.valor, 0);
    const meusTempos = historicoTempos.filter(h => h.funcionario === f.nome);
    const temposDoMes = meusTempos.filter(h => h.data.startsWith(mes));
    const minutosMes = temposDoMes.reduce((s, h) => s + h.minutos, 0);

    return (
      <div>
        <button onClick={() => setFuncionarioSel(null)} className="flex items-center gap-1 text-sm text-stone-500 mb-4 font-medium">
          <ChevronLeft size={16} /> Voltar ao relatório da equipe
        </button>

        <div className="flex items-center gap-3 mb-5">
          <span className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>
            {f.nome.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="text-base font-extrabold" style={{ color: INK }}>{f.nome}</div>
            <div className="text-xs text-stone-400">{f.gestor ? 'Gestor' : 'Técnico'}</div>
          </div>
        </div>

        <div className="rounded-2xl mb-3" style={{ position: 'relative', overflow: 'hidden', padding: '18px 16px', background: 'linear-gradient(150deg, #24221E 0%, #1C1B19 55%, #2B2620 100%)', border: '1px solid rgba(184,147,90,0.35)', boxShadow: '0 18px 44px -22px rgba(28,27,25,0.55)' }}>
        <span style={{ position: 'absolute', right: -8, bottom: -12, opacity: 0.09, pointerEvents: 'none' }}><EstrelaLogo size={56} color={GOLD} /></span>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: GOLD }}>Comissões — {mesNome}</div>
          <div className="text-3xl font-extrabold text-white">{formatReais(totalMes)}</div>
          <div className="text-xs mt-1" style={{ color: GOLD_SOFT }}>
            {comissoesDoMes.length} {comissoesDoMes.length === 1 ? 'trabalho' : 'trabalhos'} no mês • total geral {formatReais(totalGeral)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
            <ListChecks size={17} color={GOLD} className="mb-1.5" />
            <div className="text-xl font-extrabold" style={{ color: INK }}>{temposDoMes.length}</div>
            <div className="text-xs text-stone-500">etapas cronometradas ({mesNome})</div>
          </div>
          <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
            <Hourglass size={17} color={GOLD} className="mb-1.5" />
            <div className="text-xl font-extrabold" style={{ color: INK }}>{minutosMes > 0 ? formatMinutos(minutosMes) : '0min'}</div>
            <div className="text-xs text-stone-500">tempo de bancada ({mesNome})</div>
          </div>
        </div>

        <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Etapas executadas (cronometradas)</h2>
        {meusTempos.length === 0 ? (
          <div className="text-center py-8 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm mb-6">
            Nenhuma etapa cronometrada ainda.<br /><span className="text-xs">Peça para usar Iniciar/Concluir nas etapas.</span>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-stone-200 mb-6 overflow-hidden">
            {meusTempos.slice(0, 25).map((h, i) => {
              const cfgEtapa = tiposTrabalho.find(t => t.nome === h.tipo)?.etapas?.find(e => e.nome === h.etapa);
              const acima = cfgEtapa ? h.minutos > cfgEtapa.horas * 60 : false;
              return (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: i > 0 ? '1px solid #F5F5F4' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: INK }}>{h.etapa}</div>
                    <div className="text-xs text-stone-400 truncate">{h.tipo} • {formatDateBR(h.data)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-extrabold" style={{ color: acima ? '#EA580C' : VERDE }}>{formatMinutos(h.minutos)}</div>
                    {cfgEtapa && <div className="text-xs text-stone-400">est. {formatHoras(cfgEtapa.horas)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Comissões por serviço</h2>
        {minhasComissoes.length === 0 ? (
          <div className="text-center py-8 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm">Nenhuma comissão registrada ainda.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {minhasComissoes.slice(0, 20).map(c => (
              <div key={c.id} className="rounded-2xl px-4 py-3 bg-white border border-stone-200 flex items-center gap-3">
                <DollarSign size={16} style={{ color: VERDE }} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: INK }}>{c.paciente} • {c.tipoTrabalho}</div>
                  <div className="text-xs text-stone-400">{formatDateBR(c.data)}{c.participacao && c.participacao < 100 ? ` • ${c.participacao}% do trabalho` : ' • trabalho completo'}</div>
                </div>
                <span className="text-sm font-extrabold flex-shrink-0" style={{ color: VERDE }}>{formatReais(c.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const mes = mesAtualISO();
  const comissoesMes = comissoes.filter(c => c.data.startsWith(mes));
  const temposMes = historicoTempos.filter(h => h.data.startsWith(mes));

  const porFuncionario = funcionarios.map(f => {
    const minhas = comissoesMes.filter(c => c.funcionarioId === f.id);
    const meusTempos = temposMes.filter(h => h.funcionario === f.nome);
    const minutosTotal = meusTempos.reduce((s, h) => s + h.minutos, 0);
    return {
      ...f,
      finalizados: minhas.length,
      totalComissao: minhas.reduce((s, c) => s + c.valor, 0),
      etapasCronometradas: meusTempos.length,
      minutosTotal,
    };
  }).sort((a, b) => b.totalComissao - a.totalComissao);

  const totalMes = comissoesMes.reduce((s, c) => s + c.valor, 0);
  const mesNome = MESES[parseInt(mes.split('-')[1]) - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onVoltar} className="flex items-center gap-1 text-sm text-stone-500 font-medium">
          <ChevronLeft size={16} /> Voltar
        </button>
        {onAbrirMeu && (
          <button onClick={onAbrirMeu} className="flex items-center gap-1 text-xs font-bold" style={{ color: GOLD }}>
            <User size={13} /> Meu desempenho
          </button>
        )}
      </div>

      <div className="rounded-2xl mb-5" style={{ position: 'relative', overflow: 'hidden', padding: '18px 16px', background: 'linear-gradient(150deg, #24221E 0%, #1C1B19 55%, #2B2620 100%)', border: '1px solid rgba(184,147,90,0.35)', boxShadow: '0 18px 44px -22px rgba(28,27,25,0.55)' }}>
        <span style={{ position: 'absolute', right: -8, bottom: -12, opacity: 0.09, pointerEvents: 'none' }}><EstrelaLogo size={56} color={GOLD} /></span>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: GOLD }}>Comissões de {mesNome}</div>
        <div className="text-3xl font-extrabold text-white">{formatReais(totalMes)}</div>
        <div className="text-xs mt-1" style={{ color: GOLD_SOFT }}>{comissoesMes.length} {comissoesMes.length === 1 ? 'trabalho finalizado' : 'trabalhos finalizados'} no mês</div>
      </div>

      <h2 className="font-bold mb-1" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Produção por funcionário ({mesNome})</h2>
      <p className="text-xs text-stone-400 mb-3">Toque num funcionário para abrir a ficha dele: etapas executadas, tempos e comissões por serviço.</p>
      {porFuncionario.length === 0 ? (
        <div className="text-center py-8 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm">Nenhum funcionário cadastrado.</div>
      ) : (
        <div className="flex flex-col gap-2 mb-6">
          {porFuncionario.map(f => (
            <button key={f.id} onClick={() => setFuncionarioSel(f.id)} className="w-full text-left rounded-2xl p-4 bg-white flex items-center gap-3 active:bg-stone-50" style={{ border: '1px solid #E8D5B0', boxShadow: '0 12px 28px -22px rgba(122,98,52,0.45)' }}>
              <span className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>
                {f.nome.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: INK }}>{f.nome}{f.gestor ? ' 👑' : ''}</div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {f.finalizados} finalizados • {f.etapasCronometradas} etapas cronometradas{f.minutosTotal > 0 ? ` • ${formatMinutos(f.minutosTotal)} de bancada` : ''}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-extrabold" style={{ color: VERDE }}>{formatReais(f.totalComissao)}</div>
                <div className="text-xs text-stone-400">comissão →</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <h2 className="font-bold mb-3" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tempo estimado × tempo real</h2>
      <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-6">
        {Object.keys(medias).length === 0 ? (
          <div className="text-xs text-stone-400">Ainda não há tempos cronometrados. Peça à equipe para usar os botões <b>Iniciar</b> e <b>Concluir</b> nas etapas — cada registro alimenta este relatório.</div>
        ) : (
          <div className="flex flex-col">
            {tiposTrabalho.map(t => {
              const linhas = (t.etapas || []).map((e, i) => ({ e, m: medias[`${t.nome}|${e.nome}`], i })).filter(l => l.m);
              if (linhas.length === 0) return null;
              return (
                <div key={t.nome} className="py-2 border-b border-stone-100 last:border-0">
                  <div className="text-xs font-bold mb-1" style={{ color: INK }}>{t.nome}</div>
                  {linhas.map(({ e, m }) => {
                    const mediaHoras = Math.round((m.media / 60) * 4) / 4;
                    const acima = m.media > e.horas * 60;
                    return (
                      <div key={e.nome} className="flex items-center gap-2 py-1">
                        <span className="text-xs text-stone-500 flex-1 min-w-0 truncate">{e.nome}</span>
                        <span className="text-xs text-stone-400">est. {formatHoras(e.horas)}</span>
                        <span className="text-xs font-bold" style={{ color: acima ? '#EA580C' : VERDE }}>real {formatMinutos(m.media)}</span>
                        <span className="text-xs text-stone-300">({m.n})</span>
                        {Math.abs(mediaHoras - e.horas) >= 0.25 && (
                          <button onClick={() => onUpdateTipo(t.nome, { etapas: t.etapas.map(et => et.nome === e.nome ? { ...et, horas: mediaHoras } : et) })}
                            className="text-xs font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
                            usar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Últimas comissões</h2>
      {comissoes.length === 0 ? (
        <div className="text-center py-8 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm">Nenhuma comissão registrada ainda.<br /><span className="text-xs">Defina o valor por tipo de trabalho nos Ajustes — ao finalizar, a comissão vai para o usuário ativo.</span></div>
      ) : (
        <div className="flex flex-col gap-2">
          {comissoes.slice(0, 15).map(c => (
            <div key={c.id} className="rounded-2xl px-4 py-3 bg-white border border-stone-200 flex items-center gap-3">
              <DollarSign size={16} style={{ color: VERDE }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: INK }}>{c.paciente} • {c.tipoTrabalho}</div>
                <div className="text-xs text-stone-400">{c.funcionario} • {formatDateBR(c.data)}{c.participacao && c.participacao < 100 ? ` • ${c.participacao}% do trabalho` : ''}</div>
              </div>
              <span className="text-sm font-extrabold flex-shrink-0" style={{ color: VERDE }}>{formatReais(c.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusStepper({ status, onChange }) {
  const idx = STATUS_LIST.indexOf(status);
  return (
    <div className="flex flex-col">
      {STATUS_LIST.map((s, i) => {
        const done = i <= idx;
        const atual = i === idx;
        const isLast = i === STATUS_LIST.length - 1;
        return (
          <button key={s} onClick={() => onChange(s)} className="flex text-left">
            <div className="flex flex-col items-center mr-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={done ? { background: GOLD, color: INK } : { background: '#EAE3D3', color: '#B0A891' }}>
                {done ? '✓' : i + 1}
              </span>
              {!isLast && <span className="flex-1" style={{ width: '2px', background: i < idx ? GOLD : '#E7DFCB', minHeight: '20px' }} />}
            </div>
            <div className="pb-4 pt-1">
              <div className="text-sm" style={{ color: atual ? INK : (done ? '#57534E' : '#A8A29E'), fontWeight: atual ? 700 : 500 }}>{s}</div>
              {atual && <div className="text-xs mt-0.5 font-semibold" style={{ color: GOLD }}>Etapa atual</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Relógio da etapa em execução (atualiza a cada 30s)
function TempoDecorrido({ inicioExec }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const min = Math.max(0, Math.round((new Date() - new Date(inicioExec)) / 60000));
  return <span>{formatMinutos(min)}</span>;
}

// ─── Checklist de etapas com cronômetro ───
function EtapasCaso({ caso, usuarioAtivo, onIniciarEtapa, onCancelarEtapa, onConcluirEtapa, onDesfazerEtapa, onAbrirSeletorUsuario }) {
  if (!caso.etapas?.length) return null;
  const concluidas = caso.etapas.filter(e => e.concluida).length;
  const total = caso.etapas.length;
  const pct = Math.round((concluidas / total) * 100);
  const idxAtual = caso.etapas.findIndex(e => !e.concluida);

  return (
    <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <ListChecks size={16} color={GOLD} />
        <h2 className="font-bold flex-1" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Etapas de produção</h2>
        <span className="text-xs font-semibold" style={{ color: pct === 100 ? VERDE : GOLD }}>{concluidas}/{total}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden mb-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? VERDE : GOLD, transition: 'width 0.4s' }} />
      </div>

      {!usuarioAtivo && (
        <button onClick={onAbrirSeletorUsuario} className="w-full mb-2 px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center gap-2" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
          <User size={13} /> Entre com seu nome para registrar quem fez cada etapa e cronometrar os tempos →
        </button>
      )}

      {(() => {
        const linhaEtapa = (e, i, primeira) => {
          const atual = i === idxAtual;
          const rodando = !!e.inicioExec && !e.concluida;
          return (
            <div key={i} className="py-2.5" style={{ borderTop: primeira ? 'none' : '1px solid #F5F5F4' }}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={e.concluida ? { background: VERDE } : (rodando ? { background: GOLD } : (atual ? { background: GOLD_SOFT, border: `1.5px solid ${GOLD}` } : { background: '#F0EFEC' }))}>
                  {e.concluida && <Check size={14} color="white" strokeWidth={3} />}
                  {rodando && <span className="w-2 h-2 rounded-sm bg-white pulse-gold" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: e.concluida ? '#A8A29E' : INK, fontWeight: (atual || rodando) ? 700 : 500, textDecoration: e.concluida ? 'line-through' : 'none' }}>
                    {e.nome}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-stone-400">est. {formatHoras(e.horas)}</span>
                    {e.prova && (
                      <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: ROXO }}>
                        <Stethoscope size={10} /> prova
                      </span>
                    )}
                    {rodando && (
                      <span className="text-xs font-bold" style={{ color: GOLD }}>
                        ⏱ <TempoDecorrido inicioExec={e.inicioExec} />{e.funcionario ? ` • ${e.funcionario}` : ''}
                      </span>
                    )}
                    {e.concluida && (
                      <span className="text-xs" style={{ color: VERDE }}>
                        ✓ {formatDateBR(e.dataConclusao)}{e.duracaoMin ? ` em ${formatMinutos(e.duracaoMin)}` : ''}{e.funcionario ? ` • ${e.funcionario}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {!e.concluida && !rodando && (
                    <button onClick={() => onIniciarEtapa(i)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: GOLD, color: INK }}>
                      <Play size={12} /> Iniciar
                    </button>
                  )}
                  {rodando && (
                    <>
                      <button onClick={() => onCancelarEtapa(i)} className="p-1.5 rounded-lg" style={{ background: '#F0EFEC' }} title="Cancelar cronômetro">
                        <Square size={12} className="text-stone-500" />
                      </button>
                      <button onClick={() => onConcluirEtapa(i)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: VERDE }}>
                        <Check size={12} /> Concluir
                      </button>
                    </>
                  )}
                  {!e.concluida && !rodando && (
                    <button onClick={() => onConcluirEtapa(i)} className="p-1.5 rounded-lg" style={{ background: '#F0EFEC' }} title="Concluir sem cronometrar">
                      <Check size={12} className="text-stone-500" />
                    </button>
                  )}
                  {e.concluida && (
                    <button onClick={() => onDesfazerEtapa(i)} className="p-1.5 rounded-lg" style={{ background: '#F0EFEC' }} title="Desfazer conclusão">
                      <Undo2 size={12} className="text-stone-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        };
        // Agrupa as etapas por serviço (item): cada serviço vira uma seção separada,
        // com nome e progresso próprios — quem confirma a etapa vê de qual serviço ela é
        const grupos = [];
        caso.etapas.forEach((e, i) => {
          const nome = e.item || '';
          let g = grupos.find(x => x.nome === nome);
          if (!g) { g = { nome, etapas: [] }; grupos.push(g); }
          g.etapas.push({ e, i });
        });
        if (grupos.length <= 1) {
          return <div className="flex flex-col">{caso.etapas.map((e, i) => linhaEtapa(e, i, i === 0))}</div>;
        }
        return (
          <div className="flex flex-col gap-3 mt-1">
            {grupos.map(g => {
              const feitas = g.etapas.filter(x => x.e.concluida).length;
              const totalG = g.etapas.length;
              const prontoG = feitas === totalG;
              return (
                <div key={g.nome || 'geral'} className="rounded-xl overflow-hidden" style={{ border: prontoG ? `1.5px solid ${VERDE}` : '1px solid #E7E5E4' }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ background: prontoG ? '#DCF3E4' : GOLD_SOFT }}>
                    <span className="text-xs font-extrabold truncate" style={{ color: prontoG ? '#166B3A' : '#7A6234' }}>🦷 {g.nome || caso.tipoTrabalho}</span>
                    <span className="text-xs font-extrabold flex-shrink-0" style={{ color: prontoG ? '#166B3A' : '#7A6234' }}>{prontoG ? '✓ pronto' : `${feitas}/${totalG}`}</span>
                  </div>
                  <div className="flex flex-col px-3">
                    {g.etapas.map(({ e, i }, idx) => linhaEtapa(e, i, idx === 0))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      <p className="text-xs text-stone-400 mt-2"><b>Iniciar</b> liga o cronômetro; <b>Concluir</b> registra o tempo e envia o trabalho para a fila de <b>Entregas</b> (levar à clínica). A última etapa finaliza o trabalho automaticamente. O ✓ pequeno conclui sem cronometrar.</p>
    </div>
  );
}

// Visor de foto em tela cheia: pinça ou toque duplo para zoom, arrastar para mover,
// botão para girar 90° — pensado para a técnica consultar a foto durante o trabalho
function VisorFoto({ foto, onFechar }) {
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const gesto = useRef(null);
  const ultimoTap = useRef(0);

  const distancia = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const limitarZoom = (z) => Math.min(6, Math.max(1, z));

  const aoTocar = (ev) => {
    if (ev.touches.length === 2) {
      gesto.current = { tipo: 'pinca', d0: distancia(ev.touches), zoom0: zoom };
      setArrastando(true);
    } else if (ev.touches.length === 1) {
      const agora = Date.now();
      if (agora - ultimoTap.current < 300) {
        // Toque duplo: aproxima ou volta ao normal
        setZoom(z => {
          const novo = z > 1 ? 1 : 2.5;
          if (novo === 1) setPos({ x: 0, y: 0 });
          return novo;
        });
        ultimoTap.current = 0;
        gesto.current = null;
        return;
      }
      ultimoTap.current = agora;
      gesto.current = { tipo: 'mover', x0: ev.touches[0].clientX - pos.x, y0: ev.touches[0].clientY - pos.y };
      setArrastando(true);
    }
  };
  const aoMoverToque = (ev) => {
    if (!gesto.current) return;
    if (gesto.current.tipo === 'pinca' && ev.touches.length === 2) {
      const z = limitarZoom(gesto.current.zoom0 * distancia(ev.touches) / gesto.current.d0);
      setZoom(z);
      if (z === 1) setPos({ x: 0, y: 0 });
    } else if (gesto.current.tipo === 'mover' && ev.touches.length === 1 && zoom > 1) {
      setPos({ x: ev.touches[0].clientX - gesto.current.x0, y: ev.touches[0].clientY - gesto.current.y0 });
    }
  };
  const aoSoltar = () => { gesto.current = null; setArrastando(false); };

  // Arrastar com o mouse (computador) e zoom com a rodinha
  const aoMouseDown = (ev) => {
    if (zoom <= 1) return;
    gesto.current = { tipo: 'mover', x0: ev.clientX - pos.x, y0: ev.clientY - pos.y };
    setArrastando(true);
  };
  const aoMouseMove = (ev) => {
    if (gesto.current?.tipo === 'mover' && zoom > 1) {
      setPos({ x: ev.clientX - gesto.current.x0, y: ev.clientY - gesto.current.y0 });
    }
  };
  const aoRodinha = (ev) => {
    const z = limitarZoom(zoom * (ev.deltaY < 0 ? 1.2 : 1 / 1.2));
    setZoom(z);
    if (z === 1) setPos({ x: 0, y: 0 });
  };

  const mudarZoom = (fator) => {
    setZoom(z => {
      const novo = limitarZoom(z * fator);
      if (novo === 1) setPos({ x: 0, y: 0 });
      return novo;
    });
  };
  const girar = () => setRot(r => (r + 90) % 360);

  const btn = { width: 44, height: 44, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.16)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'black', touchAction: 'none' }}>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
        onTouchStart={aoTocar} onTouchMove={aoMoverToque} onTouchEnd={aoSoltar} onTouchCancel={aoSoltar}
        onMouseDown={aoMouseDown} onMouseMove={aoMouseMove} onMouseUp={aoSoltar} onMouseLeave={aoSoltar}
        onWheel={aoRodinha}
        onDoubleClick={() => mudarZoom(zoom > 1 ? 0.01 : 2.5)}>
        <img
          src={foto.dataURL} alt={foto.nome} draggable={false}
          style={{
            maxWidth: '100vw', maxHeight: '100vh',
            transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg) scale(${zoom})`,
            transition: arrastando ? 'none' : 'transform 0.18s ease',
            userSelect: 'none',
          }} />
      </div>
      <div className="flex items-center justify-center gap-3 px-4" style={{ paddingTop: 10, paddingBottom: 'max(18px, env(safe-area-inset-bottom))', background: 'rgba(0,0,0,0.6)', position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <button onClick={() => mudarZoom(1 / 1.5)} style={btn} title="Diminuir zoom"><ZoomOut size={20} /></button>
        <button onClick={() => mudarZoom(1.5)} style={btn} title="Aumentar zoom"><ZoomIn size={20} /></button>
        <button onClick={girar} style={btn} title="Girar 90°"><RotateCw size={20} /></button>
        <button onClick={() => baixarDataURL(foto.dataURL, foto.nome)} style={btn} title="Baixar"><Download size={20} /></button>
        <button onClick={onFechar} style={{ ...btn, background: 'rgba(255,255,255,0.9)', color: '#1C1B19' }} title="Fechar"><X size={22} /></button>
      </div>
      <div className="absolute top-0 left-0 right-0 text-center" style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
        {foto.nome} — pinça ou toque duplo para zoom • arraste para mover
      </div>
    </div>
  );
}

// Cache dos STLs já baixados (fica em memória): abrir de novo é instantâneo
const cacheSTL = new Map();

function AnexosSection({ caso, onAddAnexo, getAnexoData, onRemoveAnexo, onAtualizarAnexo }) {
  const fotoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const arquivoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState('');
  const [thumbs, setThumbs] = useState({});
  const [fotoAberta, setFotoAberta] = useState(null);
  const [videoAberto, setVideoAberto] = useState(null);

  const [stlAberto, setStlAberto] = useState(null);
  const anexos = caso.anexos || [];
  const fotos = anexos.filter(a => a.categoria === 'foto');
  const arquivos = anexos.filter(a => a.categoria !== 'foto');

  // Deslizar da borda esquerda fecha primeiro o STL/foto/vídeo aberto
  useGestoVoltar(() => {
    if (stlAberto) { setStlAberto(null); return; }
    if (videoAberto) { setVideoAberto(null); return; }
    if (fotoAberta) { setFotoAberta(null); return; }
    return false;
  });

  // Abre a tela do 3D NA HORA; formato novo já vem com o link direto do armazém
  const abrirSTL = async (a) => {
    if (a.url) { setStlAberto({ nome: a.nome, url: a.url }); return; }
    const emCache = cacheSTL.get(a.id);
    setStlAberto({ nome: a.nome, dataURL: emCache || null });
    if (emCache) return;
    try {
      const data = await getAnexoData(a);
      if (data) {
        cacheSTL.set(a.id, data.dataURL);
        setStlAberto(s => s ? { nome: data.nome || a.nome, dataURL: data.dataURL } : s);
      } else setStlAberto(null);
    } catch (e) { setStlAberto(null); }
  };

  // Pré-baixa os STLs antigos (guardados no banco) em segundo plano; os novos abrem por link
  useEffect(() => {
    let ativo = true;
    (async () => {
      for (const a of arquivos.filter(x => x.categoria === 'stl' && !x.url && !cacheSTL.has(x.id))) {
        try {
          const data = await getAnexoData(a);
          if (!ativo) return;
          if (data) cacheSTL.set(a.id, data.dataURL);
        } catch (e) { /* baixa quando clicar */ }
      }
    })();
    return () => { ativo = false; };
  }, [caso.id, arquivos.length]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      for (const f of fotos) {
        if (thumbs[f.id]) continue;
        try {
          const data = await getAnexoData(f);
          if (ativo && data) setThumbs(prev => ({ ...prev, [f.id]: data.url || data.dataURL }));
        } catch (e) { /* anexo removido */ }
      }
    })();
    return () => { ativo = false; };
  }, [caso.anexos]);

  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro('');
    setProcessando(true);
    setProgresso(0);
    try {
      const { dataURL, mime } = await prepararImagem(file);
      const tamanho = Math.round(dataURL.length * 0.75);
      const nomeBase = (file.name || 'foto').replace(/\.[^.]+$/, '');
      await onAddAnexo({ nome: mime === 'image/jpeg' ? `${nomeBase}.jpg` : (file.name || 'foto'), mime, categoria: 'foto', dataURL, tamanho, aoProgresso: setProgresso });
    } catch (err) {
      if (err?.message === 'imagem-grande') {
        setErro(`Esta foto é muito grande (${formatBytes(file.size)}) e não pôde ser convertida. Tente pelo botão "Tirar foto" ou envie uma captura de tela dela.`);
      } else {
        setErro('Não foi possível anexar esta imagem. Tente pelo botão "Tirar foto" ou envie uma captura de tela.');
      }
    }
    setProcessando(false);
  };

  const handleArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro('');
    if (file.size > LIMITE_ARQUIVO_MB * 1024 * 1024) {
      setErro(`Arquivo muito grande (${formatBytes(file.size)}). O limite é ${LIMITE_ARQUIVO_MB} MB por arquivo.`);
      return;
    }
    setProcessando(true);
    setProgresso(0);
    try {
      const ehSTL = file.name.toLowerCase().endsWith('.stl');
      const ehVideo = (file.type || '').startsWith('video');
      // O arquivo sobe direto como binário (sem converter p/ texto) — muito mais rápido
      await onAddAnexo({
        nome: file.name,
        mime: file.type || 'application/octet-stream',
        categoria: ehSTL ? 'stl' : (ehVideo ? 'video' : 'documento'),
        blob: file,
        tamanho: file.size,
        aoProgresso: setProgresso,
      });
    } catch (err) {
      console.error(err);
      setErro('Não foi possível anexar o arquivo. Confira a internet e tente de novo.');
    }
    setProcessando(false);
  };

  const baixar = async (anexo) => {
    try {
      const data = await getAnexoData(anexo);
      if (!data) return;
      if (data.url) {
        const blob = await (await fetch(data.url)).blob();
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = data.nome || anexo.nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(u), 5000);
      } else {
        baixarDataURL(data.dataURL, data.nome);
      }
    } catch (e) {
      setErro('Não foi possível abrir este arquivo.');
    }
  };

  const abrirFoto = async (anexo) => {
    if (thumbs[anexo.id]) { setFotoAberta({ nome: anexo.nome, dataURL: thumbs[anexo.id] }); return; }
    try {
      const data = await getAnexoData(anexo);
      if (data) setFotoAberta({ nome: data.nome, dataURL: data.url || data.dataURL });
    } catch (e) { /* ignora */ }
  };

  const abrirVideo = async (anexo) => {
    try {
      const data = await getAnexoData(anexo);
      if (data) setVideoAberto({ nome: data.nome, dataURL: data.url || data.dataURL });
    } catch (e) { setErro('Não foi possível abrir este vídeo.'); }
  };

  const IconeArquivo = ({ categoria }) => categoria === 'stl'
    ? <Box size={18} style={{ color: GOLD }} />
    : categoria === 'video'
      ? <Play size={18} style={{ color: GOLD }} />
      : <FileText size={18} className="text-stone-400" />;

  return (
    <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip size={16} color={GOLD} />
        <h2 className="text-sm font-bold" style={{ color: INK }}>Anexos</h2>
        {anexos.length > 0 && <span className="text-xs text-stone-400">({anexos.length})</span>}
      </div>

      <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
      <input ref={arquivoInputRef} type="file" className="hidden" onChange={handleArquivo} />
      <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleArquivo} />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => cameraInputRef.current?.click()} disabled={processando}
          className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: INK, color: 'white' }}>
          <Camera size={15} /> Tirar foto
        </button>
        <button onClick={() => videoInputRef.current?.click()} disabled={processando}
          className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ background: GOLD_SOFT, color: '#7A6234' }}>
          🎥 Gravar vídeo
        </button>
        <button onClick={() => fotoInputRef.current?.click()} disabled={processando}
          className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-stone-200 text-stone-600 disabled:opacity-50">
          <Paperclip size={14} /> Galeria
        </button>
        <button onClick={() => arquivoInputRef.current?.click()} disabled={processando}
          className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-stone-200 text-stone-600 disabled:opacity-50">
          <FileText size={15} /> Doc / STL
        </button>
      </div>

      {processando && (
        <div className="mb-2">
          <div className="text-xs mb-1" style={{ color: GOLD }}>Enviando... {progresso > 0 ? `${progresso}%` : ''}</div>
          <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progresso}%`, background: GOLD, transition: 'width 0.25s' }} />
          </div>
        </div>
      )}
      {erro && <div className="text-xs text-red-600 font-medium mb-2">{erro}</div>}

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {fotos.map(f => (
            <div key={f.id} className="relative">
              <button onClick={() => abrirFoto(f)} className="w-full aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                {thumbs[f.id]
                  ? <img src={thumbs[f.id]} alt={f.nome} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">...</div>}
              </button>
              <button onClick={() => onRemoveAnexo(f.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-700 text-white flex items-center justify-center">
                <X size={11} />
              </button>
              {/* Aprovação do dentista na foto: cinza = pedir, laranja = aguardando, verde = aprovada */}
              <button
                onClick={() => {
                  if (f.aprovacao?.status === 'aprovado') return;
                  if (f.aprovacao?.status === 'pendente') onAtualizarAnexo(f.id, { aprovacao: null });
                  else onAtualizarAnexo(f.id, { aprovacao: { status: 'pendente', pedidaEm: todayISO() } });
                }}
                title={f.aprovacao?.status === 'aprovado' ? 'Aprovada pelo dentista ✓' : (f.aprovacao?.status === 'pendente' ? 'Aguardando o dentista (toque p/ cancelar)' : 'Pedir aprovação do dentista')}
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white"
                style={{ background: f.aprovacao?.status === 'aprovado' ? VERDE : (f.aprovacao?.status === 'pendente' ? '#EA580C' : '#78716C') }}>
                <ThumbsUp size={11} color="white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {arquivos.length > 0 && (
        <div className="flex flex-col">
          {arquivos.map(a => (
            <div key={a.id} className="py-2.5 border-t border-stone-100">
              <div className="flex items-center gap-3">
                <IconeArquivo categoria={a.categoria} />
                <button onClick={() => a.categoria === 'video' ? abrirVideo(a) : (a.categoria === 'stl' ? abrirSTL(a) : baixar(a))} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium truncate" style={{ color: INK }}>{a.nome}</div>
                  <div className="text-xs" style={{ color: (a.categoria === 'video' || a.categoria === 'stl') ? GOLD : '#A8A29E', fontWeight: (a.categoria === 'video' || a.categoria === 'stl') ? 700 : 400 }}>
                    {a.categoria === 'video' ? '▶ Tocar vídeo' : (a.categoria === 'stl' ? '🦷 Ver em 3D' : 'Documento')} • {formatBytes(a.tamanho)}
                  </div>
                </button>
                <button onClick={() => baixar(a)} className="p-1.5"><Download size={16} className="text-stone-400" /></button>
                <button onClick={() => onRemoveAnexo(a.id)} className="p-1.5"><Trash2 size={16} className="text-stone-300" /></button>
              </div>
              {/* Aprovação do dentista: pedir → o dentista é avisado no app dele e aprova por lá */}
              {!a.aprovacao && (
                <button onClick={() => onAtualizarAnexo(a.id, { aprovacao: { status: 'pendente', pedidaEm: todayISO() } })}
                  className="mt-1.5 text-xs font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: '#F0EFEC', color: '#57534E' }}>
                  <ThumbsUp size={12} /> Pedir aprovação do dentista
                </button>
              )}
              {a.aprovacao?.status === 'pendente' && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ background: '#FDECD8', color: '#B54708' }}>⏳ Aguardando aprovação do dentista</span>
                  <button onClick={() => onAtualizarAnexo(a.id, { aprovacao: null })} className="text-xs font-bold" style={{ color: '#A8A29E' }}>cancelar</button>
                </div>
              )}
              {a.aprovacao?.status === 'aprovado' && (
                <span className="mt-1.5 inline-block text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ background: '#DCF3E4', color: '#166B3A' }}>✓ Aprovado pelo dentista{a.aprovacao.respondidaEm ? ` em ${formatDateBR(a.aprovacao.respondidaEm)}` : ''}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {anexos.length === 0 && !processando && (
        <div className="text-xs text-stone-400">Nenhum anexo ainda. Adicione fotos do trabalho, receitas, guias ou arquivos STL (até {LIMITE_ARQUIVO_MB} MB cada).</div>
      )}

      {fotoAberta && <VisorFoto foto={fotoAberta} onFechar={() => setFotoAberta(null)} />}
      {stlAberto && <VisorSTL nome={stlAberto.nome} dataURL={stlAberto.dataURL} url={stlAberto.url} onFechar={() => setStlAberto(null)} />}
      {videoAberto && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'black' }} onClick={() => setVideoAberto(null)}>
          <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
            <video src={videoAberto.dataURL} controls autoPlay playsInline style={{ maxWidth: '100vw', maxHeight: '88vh' }} />
          </div>
          <div className="absolute top-0 left-0 right-0 flex items-center gap-2" style={{ padding: '10px 12px', paddingTop: 'calc(10px + env(safe-area-inset-top))', background: 'rgba(0,0,0,0.55)' }}>
            <span className="flex-1 truncate" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700 }}>🎥 {videoAberto.nome}</span>
            <button onClick={(e) => { e.stopPropagation(); baixarDataURL(videoAberto.dataURL, videoAberto.nome); }}
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.16)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Download size={18} />
            </button>
            <button onClick={() => setVideoAberto(null)}
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#1C1B19', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Odontograma (leitura): mostra os dentes marcados pelo dentista no pedido da clínica ───
// Dourado = dente do trabalho; anel rosa = onde a prótese leva gengiva. Numeração FDI.
const ODONTO_SUP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ODONTO_INF = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ROSA_GENGIVA = '#D96B8F';

function dentesDoArco(lista, cx, cy, rx, ry, baixo) {
  return lista.map((num, i) => {
    const t = ((168 - i * (156 / (lista.length - 1))) * Math.PI) / 180;
    return { num, x: cx + rx * Math.cos(t), y: baixo ? cy + ry * Math.sin(t) : cy - ry * Math.sin(t) };
  });
}

function OdontogramaLeitura({ dentes = [], gengiva = [] }) {
  const posicoes = [
    ...dentesDoArco(ODONTO_SUP, 170, 172, 148, 138, false),
    ...dentesDoArco(ODONTO_INF, 170, 228, 148, 138, true),
  ];
  return (
    <div>
      <svg viewBox="0 0 340 402" style={{ width: '100%', maxWidth: 360, display: 'block', margin: '0 auto' }}>
        <line x1="30" y1="200" x2="310" y2="200" stroke="#E7E5E4" strokeWidth="1" strokeDasharray="3 4" />
        <text x="170" y="193" textAnchor="middle" fontSize="8.5" fontWeight="800" letterSpacing="1.4" fill="#B6B1AB">ARCO SUPERIOR</text>
        <text x="170" y="213" textAnchor="middle" fontSize="8.5" fontWeight="800" letterSpacing="1.4" fill="#B6B1AB">ARCO INFERIOR</text>
        {posicoes.map(p => {
          const selD = dentes.includes(p.num);
          const selG = gengiva.includes(p.num);
          return (
            <g key={p.num}>
              {selG && <circle cx={p.x} cy={p.y} r="16.4" fill="none" stroke={ROSA_GENGIVA} strokeWidth="3.4" />}
              <circle cx={p.x} cy={p.y} r="12.6" fill={selD ? GOLD : '#fff'} stroke={selD ? '#8A6B3A' : '#D6D3D1'} strokeWidth={selD ? 1.6 : 1.1} />
              <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="800" fill={selD ? '#1C1B19' : '#8A8580'}>{p.num}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-xs mt-1.5" style={{ color: '#57534E', lineHeight: 1.6 }}>
        {dentes.length > 0 && <div><b style={{ color: '#7A6234' }}>Dentes:</b> {dentes.join(', ')}</div>}
        {gengiva.length > 0 && <div><b style={{ color: ROSA_GENGIVA }}>Gengiva:</b> {gengiva.join(', ')}</div>}
      </div>
    </div>
  );
}

// Odontograma interativo (igual ao do Special Clinic): toca no dente (dourado)
// e no modo Gengiva marca o anel rosa onde a prótese leva gengiva.
function OdontogramaEdit({ dentes = [], gengiva = [], aoMudar }) {
  const [modo, setModo] = useState('dente');
  const FONTE_OD = "'Manrope', -apple-system, sans-serif";
  const posicoes = [
    ...dentesDoArco(ODONTO_SUP, 170, 172, 148, 138, false),
    ...dentesDoArco(ODONTO_INF, 170, 228, 148, 138, true),
  ];
  const tocar = (num) => {
    if (modo === 'dente') {
      const tem = dentes.includes(num);
      aoMudar({ dentes: tem ? dentes.filter(d => d !== num) : [...dentes, num].sort((a, b) => a - b), gengiva });
    } else {
      const tem = gengiva.includes(num);
      aoMudar({ dentes, gengiva: tem ? gengiva.filter(d => d !== num) : [...gengiva, num].sort((a, b) => a - b) });
    }
  };
  const chip = (ativo, cor, corFundo) => ({ flex: 1, padding: '9px 6px', borderRadius: 11, fontFamily: FONTE_OD, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: ativo ? `1.5px solid ${cor}` : '1px solid #E7E5E4', background: ativo ? corFundo : '#FAF9F7', color: ativo ? cor : '#78716C' });
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <button onClick={() => setModo('dente')} style={chip(modo === 'dente', '#7A6234', 'rgba(184,147,90,0.14)')}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: GOLD, flexShrink: 0 }} /> Dentes
        </button>
        <button onClick={() => setModo('gengiva')} style={chip(modo === 'gengiva', ROSA_GENGIVA, 'rgba(217,107,143,0.1)')}>
          <span style={{ width: 12, height: 12, borderRadius: 6, border: `2.5px solid ${ROSA_GENGIVA}`, boxSizing: 'border-box', flexShrink: 0 }} /> Gengiva
        </button>
      </div>
      <svg viewBox="0 0 340 402" style={{ width: '100%', display: 'block', touchAction: 'manipulation' }}>
        <line x1="30" y1="200" x2="310" y2="200" stroke="#E7E5E4" strokeWidth="1" strokeDasharray="3 4" />
        <text x="170" y="193" textAnchor="middle" fontSize="8.5" fontWeight="800" letterSpacing="1.4" fill="#B6B1AB" style={{ userSelect: 'none' }}>ARCO SUPERIOR</text>
        <text x="170" y="213" textAnchor="middle" fontSize="8.5" fontWeight="800" letterSpacing="1.4" fill="#B6B1AB" style={{ userSelect: 'none' }}>ARCO INFERIOR</text>
        {posicoes.map(p => {
          const selD = dentes.includes(p.num);
          const selG = gengiva.includes(p.num);
          return (
            <g key={p.num} onClick={() => tocar(p.num)} style={{ cursor: 'pointer' }}>
              {selG && <circle cx={p.x} cy={p.y} r="16.4" fill="none" stroke={ROSA_GENGIVA} strokeWidth="3.4" />}
              <circle cx={p.x} cy={p.y} r="12.6" fill={selD ? GOLD : '#fff'} stroke={selD ? '#8A6B3A' : '#D6D3D1'} strokeWidth={selD ? 1.6 : 1.1} />
              <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="800" fill={selD ? '#1C1B19' : '#8A8580'} style={{ userSelect: 'none' }}>{p.num}</text>
              <circle cx={p.x} cy={p.y} r="18" fill="rgba(0,0,0,0)" />
            </g>
          );
        })}
      </svg>
      {(dentes.length > 0 || gengiva.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, fontSize: 11.5, color: '#57534E', lineHeight: 1.6 }}>
            {dentes.length > 0 && <div><b style={{ color: '#7A6234' }}>Dentes:</b> {dentes.join(', ')}</div>}
            {gengiva.length > 0 && <div><b style={{ color: ROSA_GENGIVA }}>Gengiva:</b> {gengiva.join(', ')}</div>}
          </div>
          <button onClick={() => aoMudar({ dentes: [], gengiva: [] })}
            style={{ border: '1px solid #E7E5E4', background: '#fff', borderRadius: 9, padding: '5px 10px', fontSize: 11, fontWeight: 700, color: '#78716C', cursor: 'pointer', fontFamily: FONTE_OD, flexShrink: 0 }}>Limpar</button>
        </div>
      )}
      {dentes.length === 0 && gengiva.length === 0 && (
        <div style={{ fontSize: 11, color: '#A8A29E', lineHeight: 1.5, marginTop: 2 }}>Toque nos dentes que entram no trabalho. No modo <b style={{ color: ROSA_GENGIVA }}>Gengiva</b>, marque onde a prótese leva gengiva.</div>
      )}
    </div>
  );
}

function ObservacoesEditaveis({ caso, onSalvar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(caso.observacoes || '');

  useEffect(() => { setTexto(caso.observacoes || ''); }, [caso.id]);

  const salvar = () => {
    onSalvar(texto.trim());
    setEditando(false);
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-stone-400">Observações</div>
        {!editando ? (
          <button onClick={() => setEditando(true)} className="flex items-center gap-1 text-xs font-semibold" style={{ color: GOLD }}>
            <Pencil size={12} /> {caso.observacoes ? 'Editar' : 'Adicionar'}
          </button>
        ) : (
          <button onClick={salvar} className="flex items-center gap-1 text-xs font-semibold" style={{ color: GOLD }}>
            <Check size={13} /> Salvar
          </button>
        )}
      </div>
      {editando ? (
        <textarea autoFocus className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none bg-white" style={{ minHeight: '80px' }}
          value={texto} onChange={e => setTexto(e.target.value)} placeholder="Anotações sobre este caso: cor, detalhes técnicos, pedidos do dentista..." />
      ) : (
        <div className="text-sm whitespace-pre-wrap" style={{ color: caso.observacoes ? INK : '#A8A29E' }}>
          {caso.observacoes || 'Sem anotações ainda.'}
        </div>
      )}
    </div>
  );
}

// Cartão "Itens do trabalho" no detalhe: mostra os itens e permite adicionar/remover a qualquer momento
function ItensTrabalhoCard({ caso, tiposTrabalho, onSalvar }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState([]);
  const [tipoNome, setTipoNome] = useState(tiposTrabalho[0]?.nome || '');
  const [qtd, setQtd] = useState(1);
  const itensAtuais = (caso.itens && caso.itens.length) ? caso.itens : [{ nome: caso.tipoTrabalho, quantidade: caso.quantidade || 1 }];

  const iniciar = () => {
    setRascunho(itensAtuais.map(i => ({ nome: i.nome, quantidade: i.quantidade || 1 })));
    setEditando(true);
  };
  const adicionar = () => {
    if (!tipoNome) return;
    setRascunho(l => {
      const ja = l.find(i => i.nome === tipoNome);
      if (ja) return l.map(i => i.nome === tipoNome ? { ...i, quantidade: Math.min(32, i.quantidade + qtd) } : i);
      return [...l, { nome: tipoNome, quantidade: qtd }];
    });
    setQtd(1);
  };
  const salvar = () => {
    if (rascunho.length === 0) return;
    onSalvar(rascunho);
    setEditando(false);
  };

  if (!editando) {
    return (
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-0.5">
          <div className="text-xs text-stone-400">Itens do trabalho</div>
          <button onClick={iniciar} className="text-xs font-bold flex items-center gap-1" style={{ color: '#7A6234' }}><Pencil size={11} /> Editar itens</button>
        </div>
        <div className="font-medium" style={{ color: INK }}>{caso.tipoTrabalho}{!((caso.itens || []).length > 1) && (caso.quantidade || 1) > 1 ? ` × ${caso.quantidade}` : ''}</div>
      </div>
    );
  }
  return (
    <div className="col-span-2 rounded-xl p-3" style={{ background: GOLD_SOFT }}>
      <div className="text-xs font-bold mb-2" style={{ color: '#7A6234' }}>✏️ Editando itens do trabalho</div>
      <div className="flex flex-col gap-2">
        <select className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none bg-white" value={tipoNome} onChange={e => setTipoNome(e.target.value)}>
          {tiposTrabalho.map(t => <option key={t.nome} value={t.nome}>{t.nome}{(t.valor || 0) > 0 ? ` (${formatReais(t.valor)})` : ''}</option>)}
        </select>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setQtd(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg border border-stone-200 bg-white font-extrabold text-lg" style={{ color: INK }}>−</button>
            <div className="font-extrabold text-base text-center" style={{ color: INK, minWidth: '32px' }}>{qtd}</div>
            <button onClick={() => setQtd(q => Math.min(32, q + 1))} className="w-9 h-9 rounded-lg border border-stone-200 bg-white font-extrabold text-lg" style={{ color: INK }}>＋</button>
          </div>
          <button onClick={adicionar} className="px-4 py-2.5 rounded-xl font-bold text-xs text-white" style={{ background: INK }}>＋ Adicionar item</button>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {rascunho.map((it, idx) => {
            const t = tiposTrabalho.find(x => x.nome === it.nome);
            const unit = t?.valor || 0;
            return (
              <div key={it.nome} className="flex items-center justify-between gap-2 px-3 py-2.5" style={idx > 0 ? { borderTop: '1px solid #F0EFEC' } : undefined}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: INK }}>{it.nome}{it.quantidade > 1 ? ` × ${it.quantidade}` : ''}</div>
                  {unit > 0 && <div className="text-xs text-stone-400">{formatReais(unit)} / un. • {formatReais(unit * it.quantidade)}</div>}
                </div>
                <button onClick={() => setRascunho(l => l.filter(x => x.nome !== it.nome))} className="w-8 h-8 rounded-lg border border-stone-200 text-stone-400 font-bold flex-shrink-0">×</button>
              </div>
            );
          })}
          {rascunho.length === 0 && <div className="px-3 py-2.5 text-xs text-red-600 font-medium">Adicione pelo menos um item.</div>}
        </div>
        <div className="text-xs" style={{ color: '#7A6234' }}>Etapas já iniciadas ou concluídas são preservadas. O valor do serviço é recalculado pela soma dos itens.</div>
        <div className="flex gap-2 mt-1">
          <button onClick={() => setEditando(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-white text-stone-600 border border-stone-200">Cancelar</button>
          <button onClick={salvar} disabled={rascunho.length === 0} className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white" style={{ background: rascunho.length === 0 ? '#A8A29E' : VERDE }}>Salvar itens</button>
        </div>
      </div>
    </div>
  );
}

// ID do trabalho, copiável num toque — pra identificar e buscar rapidinho
function IdCopiavel({ id }) {
  const [ok, setOk] = useState(false);
  const copiar = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(String(id)); setOk(true); setTimeout(() => setOk(false), 1600); } catch (err) { }
  };
  return (
    <button onClick={copiar} title="Copiar ID"
      className="inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-lg text-[10px] font-bold"
      style={{ background: ok ? '#DCF3E4' : '#F5F4F0', color: ok ? '#166B3A' : '#78716C', border: `1px solid ${ok ? '#A7E3BC' : '#E7E5E4'}`, fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '0.04em' }}>
      {ok ? 'ID copiado ✓' : `ID ${String(id).toUpperCase()} ⧉`}
    </button>
  );
}

function DetalheView({ caso, endereco, horasRestantes, usuarioAtivo, onVoltar, onStatusChange, onIniciarEtapa, onCancelarEtapa, onConcluirEtapa, onDesfazerEtapa, onToggleClinica, onEntregarProva, onConfirmarRetirada, onSalvarObs, onAddAnexo, getAnexoData, onRemoveAnexo, onAtualizarAnexo, onAbrirSeletorUsuario, ehGestor, onSalvarValor, tiposTrabalho, onSalvarItens, onImprimir, onEtiqueta, confirmandoExclusao, setConfirmandoExclusao, onExcluir }) {
  const urg = getUrgencia(caso);
  const style = URGENCIA_STYLES[urg];
  const dias = diasRestantes(caso.prazo);
  const producao = emProducao(caso);
  const todasConcluidas = etapasCompletas(caso);
  const feitas = caso.etapas?.filter(e => e.concluida).length || 0;
  const totalEtapas = caso.etapas?.length || 0;

  return (
    <div>
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm text-stone-500 mb-4 font-medium">
        <ChevronLeft size={16} /> Voltar
      </button>

      {/* Faixa azul: trabalho postado pela clínica esperando o laboratório ir buscar */}
      {aguardandoRetirada(caso) && (
        <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: '#E8F0FE' }}>
          <div className="flex items-center gap-2">
            <Inbox size={17} style={{ color: '#2563EB' }} />
            <span className="text-sm font-bold flex-1" style={{ color: '#1D4ED8' }}>Aguardando retirada na clínica</span>
            <button onClick={onConfirmarRetirada} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1" style={{ background: '#2563EB' }}>
              <Check size={13} /> Foi pego
            </button>
          </div>
          {endereco && (
            <a href={mapsUrl(endereco)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-white" style={{ color: '#1A73E8' }}>
              <MapPin size={13} className="flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{endereco}</span>
              <span className="flex-shrink-0 font-bold">Abrir no Maps →</span>
            </a>
          )}
        </div>
      )}

      {/* Faixa vermelha: trabalho travado esperando o dentista aprovar arquivo(s) */}
      {aguardandoDentista(caso) && (
        <div className="rounded-2xl p-4 mb-4 border-2" style={{ background: '#FCE4E4', borderColor: '#DC2626' }}>
          <div className="flex items-center gap-2">
            <Hourglass size={18} style={{ color: '#B42318' }} className="flex-shrink-0" />
            <div className="text-sm font-extrabold" style={{ color: '#B42318' }}>AGUARDANDO O DENTISTA</div>
          </div>
          <div className="text-xs mt-1.5" style={{ color: '#B42318' }}>
            Você pediu aprovação de: <b>{(caso.anexos || []).filter(a => a.aprovacao?.status === 'pendente').map(a => a.nome).join(', ')}</b>.
            Aguarde a resposta antes de continuar a produção — quando o dentista aprovar, você recebe a notificação e esta faixa some.
          </div>
        </div>
      )}

      {caso.provaPendente && !caso.naClinica && (
        <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: '#FDECD8' }}>
          <div className="flex items-center gap-2">
            <Package size={17} style={{ color: '#B54708' }} />
            <span className="text-sm font-bold flex-1" style={{ color: '#B54708' }}>Aguardando entrega para prova na clínica</span>
            <button onClick={onEntregarProva} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1" style={{ background: ROXO }}>
              <Check size={13} /> Entregue
            </button>
          </div>
          {endereco && (
            <a href={mapsUrl(endereco)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-white" style={{ color: '#1A73E8' }}>
              <MapPin size={13} className="flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{endereco}</span>
              <span className="flex-shrink-0 font-bold">Abrir no Maps →</span>
            </a>
          )}
        </div>
      )}

      {caso.naClinica && (
        <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: ROXO_SOFT }}>
          <div className="flex items-center gap-2">
            <Stethoscope size={17} style={{ color: ROXO }} />
            <span className="text-sm font-bold flex-1" style={{ color: ROXO }}>Na clínica para prova</span>
            <button onClick={onToggleClinica} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1" style={{ background: ROXO }}>
              <Undo2 size={13} /> Retornou
            </button>
          </div>
          {caso.retornoSolicitado && (
            <div className="flex items-center gap-1.5 mt-2.5 px-2.5 py-2 rounded-xl text-xs font-bold" style={{ background: '#2563EB', color: '#fff' }}>
              📣 O dentista avisou: está pronto para o laboratório buscar!
            </div>
          )}
          {endereco && (
            <a href={mapsUrl(endereco)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold bg-white" style={{ color: '#1A73E8' }}>
              <MapPin size={13} className="flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate">{endereco}</span>
              <span className="flex-shrink-0 font-bold">Abrir no Maps →</span>
            </a>
          )}
        </div>
      )}

      <div className="rounded-2xl p-4 bg-white mb-5" style={{ border: caso.naClinica ? `1.5px solid ${ROXO}` : (producao ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4') }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold truncate" style={{ color: INK }}>{caso.paciente}</h2>
            <div className="text-sm text-stone-500 truncate">{caso.dentista}</div>
            <IdCopiavel id={caso.id} />
            {endereco && !caso.naClinica && (
              <a href={mapsUrl(endereco)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#1A73E8' }}>
                <MapPin size={11} className="flex-shrink-0" /><span className="truncate">{endereco}</span>
              </a>
            )}
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={{ background: style.bg, color: style.text }}>{style.label(dias)}</span>
        </div>

        {!caso.naClinica && <BarraProgresso caso={caso} />}

        <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-stone-100">
          <ItensTrabalhoCard caso={caso} tiposTrabalho={tiposTrabalho || []} onSalvar={onSalvarItens} />
          <div>
            <div className="text-xs text-stone-400 mb-0.5">Serviço restante</div>
            <div className="font-medium flex items-center gap-1" style={{ color: INK }}><Hourglass size={13} style={{ color: GOLD }} /> {formatHoras(horasRestantes)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400 mb-0.5">Material</div>
            <div className="font-medium" style={{ color: INK }}>{caso.material}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400 mb-0.5">Entrada</div>
            <div className="font-medium" style={{ color: INK }}>{formatDateBR(caso.dataEntrada)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400 mb-0.5">Prazo</div>
            <div className="font-medium" style={{ color: INK }}>{formatDateBR(caso.prazo)}</div>
          </div>
          {ehGestor && (
            <div>
              <div className="text-xs text-stone-400 mb-0.5">Valor do serviço</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-stone-400">R$</span>
                <InputNumero min={0} className="px-2 py-1 rounded-lg border border-stone-200 text-sm outline-none bg-white font-medium" style={{ width: '90px', color: INK }}
                  valor={caso.valor || ''} placeholder="0"
                  onValor={v => onSalvarValor(v)} />
              </div>
            </div>
          )}
          {caso.dataProducao && (
            <div>
              <div className="text-xs text-stone-400 mb-0.5">Início da produção</div>
              <div className="font-medium" style={{ color: INK }}>{formatDateBR(caso.dataProducao)}</div>
            </div>
          )}
          {caso.dataFinalizado && (
            <div>
              <div className="text-xs text-stone-400 mb-0.5">Finalizado em</div>
              <div className="font-medium" style={{ color: VERDE }}>{formatDateBR(caso.dataFinalizado)}</div>
            </div>
          )}
          {caso.dataSaida && (
            <div>
              <div className="text-xs text-stone-400 mb-0.5">Saída</div>
              <div className="font-medium" style={{ color: INK }}>{formatDateBR(caso.dataSaida)}</div>
            </div>
          )}
        </div>

        {(((caso.dentes || []).length > 0) || ((caso.gengiva || []).length > 0)) && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="text-xs text-stone-400 mb-2">🦷 Dentes do trabalho (marcados pelo dentista)</div>
            <OdontogramaLeitura dentes={caso.dentes || []} gengiva={caso.gengiva || []} />
          </div>
        )}

        <ObservacoesEditaveis caso={caso} onSalvar={onSalvarObs} />
      </div>

      {producao && !caso.naClinica && !caso.provaPendente && (
        todasConcluidas ? (
          <button onClick={() => onStatusChange('Pronto')} className="w-full mb-5 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2" style={{ background: VERDE }}>
            <Flag size={17} /> Finalizar Trabalho
          </button>
        ) : (
          <div className="w-full mb-5 py-3 px-4 rounded-2xl flex items-center gap-2 text-xs font-semibold" style={{ background: '#F0EFEC', color: '#78716C' }}>
            <Lock size={14} className="flex-shrink-0" />
            <span>Finalizar libera quando todas as etapas estiverem concluídas ({feitas}/{totalEtapas}). Etapas de prova enviam o trabalho à clínica automaticamente.</span>
          </div>
        )
      )}
      {caso.status === 'Pronto' && (
        <button onClick={() => onStatusChange('Entregue')} className="w-full mb-2 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2" style={{ background: INK }}>
          <CheckCircle2 size={17} /> Marcar como Entregue
        </button>
      )}
      <button onClick={onImprimir} className="w-full mb-2 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border" style={{ borderColor: INK, color: INK, background: 'white' }}>
        <FileText size={16} /> Imprimir ficha do trabalho (A4)
      </button>
      <button onClick={onEtiqueta} className="w-full mb-5 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border" style={{ borderColor: GOLD, color: '#8A6D3B', background: 'white' }}>
        <Package size={16} /> Imprimir etiqueta (50×30)
      </button>

      <EtapasCaso caso={caso} usuarioAtivo={usuarioAtivo}
        onIniciarEtapa={onIniciarEtapa} onCancelarEtapa={onCancelarEtapa}
        onConcluirEtapa={onConcluirEtapa} onDesfazerEtapa={onDesfazerEtapa}
        onAbrirSeletorUsuario={onAbrirSeletorUsuario} />

      <AnexosSection caso={caso} onAddAnexo={onAddAnexo} getAnexoData={getAnexoData} onRemoveAnexo={onRemoveAnexo} onAtualizarAnexo={onAtualizarAnexo} />

      <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-5">
        <div className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3">Fluxo geral</div>
        <StatusStepper status={caso.status} onChange={onStatusChange} />
      </div>

      {!confirmandoExclusao ? (
        <button onClick={() => setConfirmandoExclusao(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-red-600">
          <Trash2 size={16} /> Excluir caso
        </button>
      ) : (
        <div className="rounded-xl p-3 bg-red-50 flex items-center justify-between gap-2">
          <span className="text-sm text-red-700 font-medium">Confirmar exclusão? Os anexos também serão removidos.</span>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setConfirmandoExclusao(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-stone-600">Não</button>
            <button onClick={onExcluir} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white">Sim, excluir</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Meu Desempenho (visão individual do funcionário) ───
function MeuView({ usuarioAtivo, comissoes, historicoTempos, tiposTrabalho, onVoltar, onAbrirSeletorUsuario }) {
  if (!usuarioAtivo) {
    return (
      <div className="text-center py-14 px-4 rounded-2xl bg-white border border-stone-200">
        <User size={26} className="text-stone-300 mx-auto mb-3" />
        <div className="text-stone-500 text-sm font-medium mb-3">Entre com seu nome para ver seu desempenho.</div>
        <button onClick={onAbrirSeletorUsuario} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: INK }}>Entrar</button>
      </div>
    );
  }

  const mes = mesAtualISO();
  const mesNome = MESES[parseInt(mes.split('-')[1]) - 1];
  const minhasComissoesMes = comissoes.filter(c => c.funcionarioId === usuarioAtivo.id && c.data.startsWith(mes));
  const totalMes = minhasComissoesMes.reduce((s, c) => s + c.valor, 0);
  const minhasTodas = comissoes.filter(c => c.funcionarioId === usuarioAtivo.id);
  const meusTemposMes = historicoTempos.filter(h => h.funcionario === usuarioAtivo.nome && h.data.startsWith(mes));
  const minutosMes = meusTemposMes.reduce((s, h) => s + h.minutos, 0);

  // Minhas médias por etapa (todos os registros meus)
  const meusTempos = historicoTempos.filter(h => h.funcionario === usuarioAtivo.nome);
  const minhasMedias = calcularMedias(meusTempos);

  return (
    <div>
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm text-stone-500 mb-4 font-medium">
        <ChevronLeft size={16} /> Voltar
      </button>

      <div className="flex items-center gap-3 mb-5">
        <span className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8C48A, #B8935A)', color: INK, boxShadow: '0 8px 18px -8px rgba(184,147,90,0.7)' }}>
          {usuarioAtivo.nome.charAt(0).toUpperCase()}
        </span>
        <div>
          <div className="text-base font-extrabold" style={{ color: INK }}>{usuarioAtivo.nome}</div>
          <div className="text-xs text-stone-400">{usuarioAtivo.gestor ? 'Gestor' : 'Técnico'}</div>
        </div>
      </div>

      <div className="rounded-2xl mb-3" style={{ position: 'relative', overflow: 'hidden', padding: '18px 16px', background: 'linear-gradient(150deg, #24221E 0%, #1C1B19 55%, #2B2620 100%)', border: '1px solid rgba(184,147,90,0.35)', boxShadow: '0 18px 44px -22px rgba(28,27,25,0.55)' }}>
        <span style={{ position: 'absolute', right: -8, bottom: -12, opacity: 0.09, pointerEvents: 'none' }}><EstrelaLogo size={56} color={GOLD} /></span>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: GOLD }}>Minhas comissões — {mesNome}</div>
        <div className="text-3xl font-extrabold text-white">{formatReais(totalMes)}</div>
        <div className="text-xs mt-1" style={{ color: GOLD_SOFT }}>
          {minhasComissoesMes.length} {minhasComissoesMes.length === 1 ? 'trabalho finalizado' : 'trabalhos finalizados'} no mês
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
          <ListChecks size={17} color={GOLD} className="mb-1.5" />
          <div className="text-xl font-extrabold" style={{ color: INK }}>{meusTemposMes.length}</div>
          <div className="text-xs text-stone-500">etapas cronometradas ({mesNome})</div>
        </div>
        <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
          <Hourglass size={17} color={GOLD} className="mb-1.5" />
          <div className="text-xl font-extrabold" style={{ color: INK }}>{formatMinutos(minutosMes) === '—' ? '0min' : formatMinutos(minutosMes)}</div>
          <div className="text-xs text-stone-500">tempo de bancada ({mesNome})</div>
        </div>
      </div>

      <h2 className="font-bold mb-3" style={{ color: '#7A6234', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Meus tempos médios</h2>
      <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-6">
        {Object.keys(minhasMedias).length === 0 ? (
          <div className="text-xs text-stone-400">Ainda sem tempos cronometrados. Use os botões <b>Iniciar</b> e <b>Concluir</b> nas etapas para registrar.</div>
        ) : (
          <div className="flex flex-col">
            {tiposTrabalho.map(t => {
              const linhas = (t.etapas || []).map(e => ({ e, m: minhasMedias[`${t.nome}|${e.nome}`] })).filter(l => l.m);
              if (linhas.length === 0) return null;
              return (
                <div key={t.nome} className="py-2 border-b border-stone-100 last:border-0">
                  <div className="text-xs font-bold mb-1" style={{ color: INK }}>{t.nome}</div>
                  {linhas.map(({ e, m }) => (
                    <div key={e.nome} className="flex items-center gap-2 py-1">
                      <span className="text-xs text-stone-500 flex-1 min-w-0 truncate">{e.nome}</span>
                      <span className="text-xs text-stone-400">est. {formatHoras(e.horas)}</span>
                      <span className="text-xs font-bold" style={{ color: m.media > e.horas * 60 ? '#EA580C' : VERDE }}>meu: {formatMinutos(m.media)}</span>
                      <span className="text-xs text-stone-300">({m.n})</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Minhas comissões recentes</h2>
      {minhasTodas.length === 0 ? (
        <div className="text-center py-8 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm">
          Nenhuma comissão registrada ainda.<br /><span className="text-xs">Ao finalizar um trabalho estando logado, a comissão do tipo cai aqui.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {minhasTodas.slice(0, 15).map(c => (
            <div key={c.id} className="rounded-2xl px-4 py-3 bg-white border border-stone-200 flex items-center gap-3">
              <DollarSign size={16} style={{ color: VERDE }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: INK }}>{c.paciente} • {c.tipoTrabalho}</div>
                <div className="text-xs text-stone-400">{formatDateBR(c.data)}{c.participacao && c.participacao < 100 ? ` • ${c.participacao}% do trabalho` : ''}</div>
              </div>
              <span className="text-sm font-extrabold flex-shrink-0" style={{ color: VERDE }}>{formatReais(c.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Central de entregas: prontos com endereço da clínica e confirmação ───
function EntregasView({ casos, provasLevar, provasNaClinica, getEndereco, getTelefone, onSelect, onEntregarProva, onRetornou, onEntregar }) {
  const EnderecoBloco = ({ dentista }) => {
    const endereco = getEndereco(dentista);
    const telefone = getTelefone ? getTelefone(dentista) : '';
    return (
      <>
        {endereco ? (
          <a href={mapsUrl(endereco)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-3 px-3 py-2.5 rounded-xl text-xs font-semibold" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
            <MapPin size={13} className="flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">{endereco}</span>
            <span className="flex-shrink-0 font-bold">Abrir no Maps →</span>
          </a>
        ) : (
          <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl text-xs" style={{ background: '#F0EFEC', color: '#A8A29E' }}>
            <MapPin size={12} /> Sem endereço cadastrado — adicione em Ajustes → Dentistas.
          </div>
        )}
        {telefone && (
          <a href={`tel:${telefone.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-1.5 mt-2 px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: ROXO_SOFT, color: ROXO }}>
            <Send size={12} className="flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">{telefone}</span>
            <span className="flex-shrink-0 font-bold">Ligar →</span>
          </a>
        )}
      </>
    );
  };

  const CabecalhoCaso = ({ c, badge, badgeStyle, extra }) => (
    <button onClick={() => onSelect(c.id)} className="w-full text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate" style={{ color: INK }}>{c.paciente}</div>
          <div className="text-xs text-stone-500 truncate mt-0.5">{c.tipoTrabalho}{extra || ''}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Stethoscope size={12} style={{ color: ROXO }} className="flex-shrink-0" />
            <span className="text-sm font-semibold truncate" style={{ color: INK }}>{c.dentista}</span>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0" style={badgeStyle}>{badge}</span>
      </div>
    </button>
  );

  const vazio = casos.length === 0 && provasLevar.length === 0 && provasNaClinica.length === 0;

  return (
    <div>
      <p className="text-xs text-stone-400 mb-4">Tudo que precisa sair do laboratório. Confirme cada saída: prova entregue na clínica ou entrega final concluída.</p>

      {vazio && (
        <div className="text-center py-12 px-4 rounded-2xl bg-white border border-stone-200">
          <Flag size={28} className="mx-auto mb-3" style={{ color: VERDE }} />
          <div className="text-stone-500 text-sm font-medium">Nada para entregar agora.</div>
          <div className="text-stone-400 text-xs mt-1">Provas concluídas e trabalhos finalizados aparecem aqui com o endereço da clínica.</div>
        </div>
      )}

      {provasLevar.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: '#B54708' }}>
            <Package size={15} /> Levar à clínica — aguardando saída ({provasLevar.length})
          </h2>
          <div className="flex flex-col gap-2 mb-6">
            {provasLevar.map(c => {
              const et = c.etapas?.filter(e => e.concluida && e.prova).slice(-1)[0];
              return (
                <div key={c.id} className="rounded-2xl p-4 bg-white" style={{ border: '1.5px solid #EA580C' }}>
                  <CabecalhoCaso c={c} badge="levar p/ prova" badgeStyle={{ background: '#FDECD8', color: '#B54708' }} extra={et ? ` • prova: ${et.nome}` : ''} />
                  <EnderecoBloco dentista={c.dentista} />
                  <button onClick={() => onEntregarProva(c.id)} className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: ROXO }}>
                    <Check size={14} /> Entregue na clínica ✓
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {provasNaClinica.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: ROXO }}>
            <Stethoscope size={15} /> Na clínica — aguardando retorno ({provasNaClinica.length})
          </h2>
          <div className="flex flex-col gap-2 mb-6">
            {provasNaClinica.map(c => {
              const et = c.etapas?.filter(e => e.concluida && e.prova).slice(-1)[0];
              return (
                <div key={c.id} className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${ROXO}` }}>
                  <CabecalhoCaso c={c} badge="em prova" badgeStyle={{ background: ROXO_SOFT, color: ROXO }} extra={et ? ` • prova: ${et.nome}` : ''} />
                  <EnderecoBloco dentista={c.dentista} />
                  <button onClick={() => onRetornou(c.id)} className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: ROXO }}>
                    <Undo2 size={14} /> Retornou ao laboratório
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {casos.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: '#166B3A' }}>
            <Flag size={15} /> Entrega final ({casos.length})
          </h2>
          <div className="flex flex-col gap-2">
            {casos.map(c => (
              <div key={c.id} className="rounded-2xl p-4 bg-white" style={{ border: `1.5px solid ${VERDE}` }}>
                <CabecalhoCaso c={c} badge="Pronto" badgeStyle={{ background: '#DCF3E4', color: '#166B3A' }} extra={c.dataFinalizado ? ` • finalizado ${formatDateBR(c.dataFinalizado)}` : ''} />
                <EnderecoBloco dentista={c.dentista} />
                <button onClick={() => onEntregar(c.id)} className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5" style={{ background: VERDE }}>
                  <CheckCircle2 size={14} /> Entregue ✓
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Finanças (só gestor): entradas, valores e comissões ───
// Combinado de pagamento do dentista (aparece para ele no Special Clinic)
function PrazoPagamentoEdit({ atual, onSalvar, diasAtual, onSalvarDias, dataAtual, onSalvarData }) {
  // Escolha fica local e SÓ grava quando toca em Salvar (nada muda sem querer)
  const [modo, setModo] = useState(dataAtual ? 'data' : (diasAtual ?? null) !== null ? 'dias' : null);
  const [dias, setDias] = useState((diasAtual ?? null) !== null ? String(diasAtual) : '');
  const [data, setData] = useState(dataAtual || '');
  const [salvo, setSalvo] = useState(false);

  const podeSalvar = modo === 'dias' ? parseInt(dias, 10) >= 0 : (modo === 'data' ? !!data : true);
  const salvar = () => {
    if (modo === 'dias') {
      const n = parseInt(dias, 10);
      onSalvarDias(n);
      onSalvar(`pagar até ${n} ${n === 1 ? 'dia' : 'dias'} após a entrega`);
    } else if (modo === 'data') {
      onSalvarData(data);
      onSalvar(`pagamento até ${data.split('-').reverse().join('/')}`);
    } else {
      onSalvarDias(null);
      onSalvarData(null);
      onSalvar('');
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2200);
  };
  const estiloCard = (ativo) => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '12px 13px', borderRadius: 14, cursor: 'pointer', marginBottom: 8,
    background: ativo ? '#fff' : '#FBFAF8',
    border: ativo ? `1.5px solid ${GOLD}` : '1px solid #E7E5E4',
    boxShadow: ativo ? '0 8px 20px -14px rgba(184,147,90,0.6)' : 'none',
  });
  const bolinha = (ativo) => (
    <span style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, border: ativo ? `5.5px solid ${GOLD}` : '2px solid #D6D3D1', background: '#fff', boxSizing: 'border-box' }} />
  );
  return (
    <div className="rounded-xl p-3 mb-2" style={{ background: '#F5F4F0' }}>
      <div className="text-xs font-bold mb-2.5" style={{ color: INK }}>Combinado de pagamento <span className="font-normal text-stone-400">(marque UMA opção e salve — o dentista vê no Special Clinic)</span></div>

      {/* Opção 1: X dias após a entrega */}
      <button onClick={() => { setModo('dias'); setSalvo(false); }} style={estiloCard(modo === 'dias')}>
        {bolinha(modo === 'dias')}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="block text-sm font-bold" style={{ color: INK }}>Pagar em dias após a entrega</span>
          <span className="block text-xs text-stone-400 mt-0.5">Cada trabalho entregue vence tantos dias depois</span>
        </span>
      </button>
      {modo === 'dias' && (
        <div className="flex items-center gap-2 mb-2 pl-1">
          <input type="text" inputMode="numeric" value={dias}
            onChange={e => { setDias(e.target.value.replace(/[^\d]/g, '')); setSalvo(false); }}
            className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white text-center font-bold" style={{ width: 74, borderColor: GOLD }} placeholder="?" />
          <span className="text-xs font-bold" style={{ color: INK }}>dias após a entrega</span>
          <span className="flex gap-1 ml-auto">
            {[2, 5, 7, 15, 30].map(n => (
              <button key={n} onClick={() => { setDias(String(n)); setSalvo(false); }}
                className="px-2 py-1.5 rounded-lg text-xs font-bold"
                style={dias === String(n) ? { background: INK, color: GOLD } : { background: '#fff', color: '#78716C', border: '1px solid #E7E5E4' }}>
                {n}
              </button>
            ))}
          </span>
        </div>
      )}

      {/* Opção 2: data escolhida */}
      <button onClick={() => { setModo('data'); setSalvo(false); }} style={estiloCard(modo === 'data')}>
        {bolinha(modo === 'data')}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="block text-sm font-bold" style={{ color: INK }}>Pagar numa data escolhida</span>
          <span className="block text-xs text-stone-400 mt-0.5">Tudo que foi entregue até essa data é pago nesse dia</span>
        </span>
      </button>
      {modo === 'data' && (
        <div className="mb-2 pl-1">
          <input type="date" value={data} onChange={e => { setData(e.target.value); setSalvo(false); }}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white" style={{ border: `1.5px solid ${GOLD}`, color: INK, fontWeight: 700 }} />
        </div>
      )}

      {/* Opção 3: sem combinado */}
      <button onClick={() => { setModo(null); setSalvo(false); }} style={estiloCard(modo === null)}>
        {bolinha(modo === null)}
        <span className="text-sm font-bold" style={{ color: '#78716C' }}>Sem combinado (não cobra automático)</span>
      </button>

      <button onClick={salvar} disabled={!podeSalvar}
        className="w-full py-3 rounded-xl text-sm font-extrabold text-white mt-1 disabled:opacity-40"
        style={{ background: salvo ? VERDE : INK }}>
        {salvo ? '✓ Salvo — o dentista já vê no Special Clinic' : 'Salvar combinado'}
      </button>
      {modo === 'dias' && parseInt(dias, 10) >= 0 && !salvo && (
        <div className="text-xs mt-2 text-center" style={{ color: '#7A6234' }}>Entregou e passou de <b>{dias} {parseInt(dias, 10) === 1 ? 'dia' : 'dias'}</b> sem pagamento → fica vermelho e o robô cobra às 9h.</div>
      )}
      {modo === 'data' && data && !salvo && (
        <div className="text-xs mt-2 text-center" style={{ color: '#7A6234' }}>Entregas até <b>{data.split('-').reverse().join('/')}</b> devem ser pagas nesse dia → passou, fica vermelho e o robô cobra às 9h.</div>
      )}
    </div>
  );
}

function FinancasView({ casos, comissoes, ehGestor, pagamentos, dentistas, onSetPrazoPagamento, onSetDiasPagamento, onSetDataPagamento, onRegistrarPagamento, onRemoverPagamento, onSelect, onVoltar }) {
  const [mesOffset, setMesOffset] = useState(0);
  const [dentistaCobranca, setDentistaCobranca] = useState(null);
  const [valorPagamento, setValorPagamento] = useState('');
  const [filtroDentistaFin, setFiltroDentistaFin] = useState('Todos');

  if (!ehGestor) {
    return (
      <div className="text-center py-14 px-4 rounded-2xl bg-white border border-stone-200">
        <Lock size={26} className="text-stone-300 mx-auto mb-3" />
        <div className="text-stone-500 text-sm font-medium">Acesso restrito a gestores.</div>
      </div>
    );
  }

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + mesOffset);
  const mes = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
  const mesNome = MESES[base.getMonth()];

  const entraram = casos.filter(c => c.dataEntrada?.startsWith(mes));
  const finalizados = casos.filter(c => c.dataFinalizado?.startsWith(mes));
  const entregues = casos.filter(c => c.dataSaida?.startsWith(mes));
  const comissoesMes = comissoes.filter(c => c.data.startsWith(mes));

  const valorEntrou = entraram.reduce((s, c) => s + (c.valor || 0), 0);
  const valorFinalizado = finalizados.reduce((s, c) => s + (c.valor || 0), 0);
  const valorEntregue = entregues.reduce((s, c) => s + (c.valor || 0), 0);
  const totalComissoes = comissoesMes.reduce((s, c) => s + c.valor, 0);
  const liquido = valorFinalizado - totalComissoes;

  const semValor = entraram.filter(c => !(c.valor > 0)).length;

  // Em aberto (acumulado geral): tudo que ainda não foi entregue passa para os próximos meses
  const emAberto = casos.filter(c => c.status !== 'Entregue');
  const valorEmAberto = emAberto.reduce((s, c) => s + (c.valor || 0), 0);

  // Por tipo de trabalho (entradas do mês)
  const porTipo = {};
  entraram.forEach(c => {
    if (!porTipo[c.tipoTrabalho]) porTipo[c.tipoTrabalho] = { qtd: 0, valor: 0 };
    porTipo[c.tipoTrabalho].qtd += 1;
    porTipo[c.tipoTrabalho].valor += (c.valor || 0);
  });
  const tiposOrdenados = Object.entries(porTipo).sort((a, b) => b[1].valor - a[1].valor);

  // Fechamento do mês por tipo: só os trabalhos FINALIZADOS no mês contam no fechamento
  const porTipoFechamento = {};
  finalizados.forEach(c => {
    if (!porTipoFechamento[c.tipoTrabalho]) porTipoFechamento[c.tipoTrabalho] = { qtd: 0, valor: 0 };
    porTipoFechamento[c.tipoTrabalho].qtd += 1;
    porTipoFechamento[c.tipoTrabalho].valor += (c.valor || 0);
  });
  const tiposFechamento = Object.entries(porTipoFechamento).sort((a, b) => b[1].valor - a[1].valor);

  // Extrato por dentista: só o que foi ENTREGUE no mês (é o que se cobra)
  const porDentista = {};
  entregues.forEach(c => {
    if (!porDentista[c.dentista]) porDentista[c.dentista] = { trabalhos: [], total: 0 };
    porDentista[c.dentista].trabalhos.push(c);
    porDentista[c.dentista].total += (c.valor || 0);
  });
  const dentistasOrdenados = Object.entries(porDentista).sort((a, b) => b[1].total - a[1].total);

  // ── Contas a receber (acumulado geral): entregues − pagamentos ──
  const receber = {};
  casos.filter(c => c.status === 'Entregue').forEach(c => {
    if (!receber[c.dentista]) receber[c.dentista] = { entregue: 0, pago: 0, trabalhos: [] };
    receber[c.dentista].entregue += (c.valor || 0);
    receber[c.dentista].trabalhos.push(c);
  });
  (pagamentos || []).forEach(p => {
    if (!receber[p.dentista]) receber[p.dentista] = { entregue: 0, pago: 0, trabalhos: [] };
    receber[p.dentista].pago += p.valor;
  });
  const receberOrdenado = Object.entries(receber)
    .map(([nome, d]) => ({ nome, ...d, saldo: Math.round((d.entregue - d.pago) * 100) / 100 }))
    .sort((a, b) => b.saldo - a.saldo);
  const totalReceber = receberOrdenado.reduce((s, d) => s + Math.max(0, d.saldo), 0);

  // Aloca pagamentos nos trabalhos mais antigos primeiro (FIFO) → status pago/parcial/aberto
  const statusTrabalhos = (dados) => {
    const ordenados = [...dados.trabalhos].sort((a, b) => (a.dataSaida || '').localeCompare(b.dataSaida || ''));
    let restante = dados.pago;
    return ordenados.map(c => {
      const v = c.valor || 0;
      let st, pagoValor;
      if (v <= 0) { st = 'semvalor'; pagoValor = 0; }
      else if (restante >= v) { st = 'pago'; pagoValor = v; restante -= v; }
      else if (restante > 0) { st = 'parcial'; pagoValor = restante; restante = 0; }
      else { st = 'aberto'; pagoValor = 0; }
      return { caso: c, st, pagoValor };
    });
  };

  // Filtro por dentista para o extrato e a lista do mês
  const dentistasDoMes = [...new Set([...entregues.map(c => c.dentista), ...entraram.map(c => c.dentista)])].sort();
  const entreguesFiltrados = filtroDentistaFin === 'Todos' ? entregues : entregues.filter(c => c.dentista === filtroDentistaFin);
  const entraramFiltrados = filtroDentistaFin === 'Todos' ? entraram : entraram.filter(c => c.dentista === filtroDentistaFin);
  const valorEntregueFiltrado = entreguesFiltrados.reduce((s, c) => s + (c.valor || 0), 0);

  const confirmarPagamento = (nome) => {
    const v = parseFloat(String(valorPagamento).replace(',', '.'));
    if (isNaN(v) || v <= 0) return;
    onRegistrarPagamento(nome, Math.round(v * 100) / 100);
    setValorPagamento('');
  };

  const compartilharExtratoDentista = async (nomeDentista, dados) => {
    try {
      const url = desenharExtratoDentista({ dentistaNome: nomeDentista, mesLabel: `${mesNome} de ${base.getFullYear()}`, trabalhos: dados.trabalhos, total: dados.total });
      const pdfBlob = jpegParaPDF(url);
      const nomeArq = `extrato-${nomeDentista.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${mes}.pdf`;
      const file = new File([pdfBlob], nomeArq, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Extrato — ${nomeDentista}` });
        return;
      }
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nomeArq;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e) { console.error('Erro ao gerar extrato', e); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onVoltar} className="flex items-center gap-1 text-sm text-stone-500 font-medium">
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setMesOffset(mesOffset - 1)} className="p-1.5 rounded-lg bg-white border border-stone-200"><ChevronLeft size={14} className="text-stone-500" /></button>
          <span className="text-sm font-extrabold capitalize" style={{ color: INK }}>{mesNome} {base.getFullYear()}</span>
          <button onClick={() => setMesOffset(mesOffset + 1)} className="p-1.5 rounded-lg bg-white border border-stone-200" style={{ transform: 'rotate(180deg)' }}><ChevronLeft size={14} className="text-stone-500" /></button>
        </div>
      </div>

      <div className="rounded-2xl mb-3" style={{ position: 'relative', overflow: 'hidden', padding: '18px 16px', background: 'linear-gradient(150deg, #24221E 0%, #1C1B19 55%, #2B2620 100%)', border: '1px solid rgba(184,147,90,0.35)', boxShadow: '0 18px 44px -22px rgba(28,27,25,0.55)' }}>
        <span style={{ position: 'absolute', right: -8, bottom: -12, opacity: 0.09, pointerEvents: 'none' }}><EstrelaLogo size={56} color={GOLD} /></span>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: GOLD }}>Entrou de serviço em {mesNome}</div>
        <div className="text-3xl font-extrabold text-white">{formatReais(valorEntrou)}</div>
        <div className="text-xs mt-1" style={{ color: GOLD_SOFT }}>{entraram.length} {entraram.length === 1 ? 'trabalho recebido' : 'trabalhos recebidos'} no mês</div>
        {semValor > 0 && (
          <div className="text-xs mt-2 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.12)', color: GOLD_SOFT }}>
            ⚠ {semValor} {semValor === 1 ? 'trabalho sem valor definido' : 'trabalhos sem valor definido'} — defina o valor padrão nos tipos (Ajustes).
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
          <Flag size={16} style={{ color: VERDE }} className="mb-1.5" />
          <div className="text-lg font-extrabold" style={{ color: INK }}>{formatReais(valorFinalizado)}</div>
          <div className="text-xs text-stone-500">finalizados no mês ({finalizados.length})</div>
        </div>
        <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
          <CheckCircle2 size={16} style={{ color: VERDE }} className="mb-1.5" />
          <div className="text-lg font-extrabold" style={{ color: INK }}>{formatReais(valorEntregue)}</div>
          <div className="text-xs text-stone-500">entregues no mês ({entregues.length})</div>
        </div>
        <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid #E7E5E4', boxShadow: '0 12px 28px -22px rgba(28,27,25,0.3)' }}>
          <Users size={16} style={{ color: '#EA580C' }} className="mb-1.5" />
          <div className="text-lg font-extrabold" style={{ color: '#EA580C' }}>− {formatReais(totalComissoes)}</div>
          <div className="text-xs text-stone-500">comissões no mês</div>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: liquido >= 0 ? '#DCF3E4' : '#FCE4E4', borderColor: liquido >= 0 ? VERDE : '#DC2626' }}>
          <TrendingUp size={16} style={{ color: liquido >= 0 ? '#166B3A' : '#B42318' }} className="mb-1.5" />
          <div className="text-lg font-extrabold" style={{ color: liquido >= 0 ? '#166B3A' : '#B42318' }}>{formatReais(liquido)}</div>
          <div className="text-xs" style={{ color: liquido >= 0 ? '#166B3A' : '#B42318' }}>finalizado − comissões</div>
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-6 flex items-center gap-3">
        <Hourglass size={18} style={{ color: '#B54708' }} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold" style={{ color: INK }}>Em aberto (passa p/ o próximo mês)</div>
          <div className="text-xs text-stone-400">{emAberto.length} {emAberto.length === 1 ? 'trabalho ainda não entregue' : 'trabalhos ainda não entregues'} — só entram no extrato quando forem entregues.</div>
        </div>
        <span className="text-sm font-extrabold flex-shrink-0" style={{ color: '#B54708' }}>{formatReais(valorEmAberto)}</span>
      </div>

      <h2 className="text-sm font-bold mb-1" style={{ color: INK }}>Contas a receber</h2>
      <p className="text-xs text-stone-400 mb-3">Acumulado geral: trabalhos entregues − pagamentos recebidos. Toque num dentista para registrar pagamentos (parciais ou totais).</p>
      <div className="rounded-2xl bg-white border border-stone-200 mb-2 overflow-hidden">
        {receberOrdenado.length === 0 ? (
          <div className="px-4 py-6 text-xs text-stone-400 text-center">Nenhuma entrega registrada ainda — as cobranças aparecem aqui após a primeira entrega.</div>
        ) : (
          receberOrdenado.map((d, i) => {
            const aberto = dentistaCobranca === d.nome;
            const quitado = d.saldo <= 0;
            return (
              <div key={d.nome} style={{ borderTop: i > 0 ? '1px solid #F5F5F4' : 'none' }}>
                <button onClick={() => { setDentistaCobranca(aberto ? null : d.nome); setValorPagamento(''); }} className="w-full text-left flex items-center gap-3 px-4 py-3 active:bg-stone-50">
                  <ChevronDown size={15} className="text-stone-400 flex-shrink-0" style={{ transform: aberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: INK }}>{d.nome}</div>
                    <div className="text-xs text-stone-400">entregue {formatReais(d.entregue)} • pago {formatReais(d.pago)}</div>
                  </div>
                  {d.saldo < 0 ? (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0" style={{ background: '#E8F0FE', color: '#1A73E8' }}>CRÉDITO {formatReais(-d.saldo)}</span>
                  ) : quitado ? (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0" style={{ background: '#DCF3E4', color: '#166B3A' }}>QUITADO ✓</span>
                  ) : (
                    <span className="text-sm font-extrabold flex-shrink-0" style={{ color: '#DC2626' }}>{formatReais(d.saldo)}</span>
                  )}
                </button>

                {aberto && (
                  <div className="px-4 pb-4">
                    {d.saldo < 0 && (
                      <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl text-xs" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
                        <DollarSign size={14} className="flex-shrink-0 mt-0.5" />
                        <span><b>Crédito de {formatReais(-d.saldo)} a favor de {d.nome}</b> (pagou a mais). Será abatido automaticamente das próximas entregas.</span>
                      </div>
                    )}
                    <PrazoPagamentoEdit
                      atual={(dentistas || []).find(x => x.nome === d.nome)?.prazoPagamento}
                      onSalvar={(texto) => onSetPrazoPagamento(d.nome, texto)}
                      diasAtual={(dentistas || []).find(x => x.nome === d.nome)?.diasPagamento ?? null}
                      onSalvarDias={(n) => onSetDiasPagamento(d.nome, n)}
                      dataAtual={(dentistas || []).find(x => x.nome === d.nome)?.dataPagamento || null}
                      onSalvarData={(data) => onSetDataPagamento(d.nome, data)} />
                    {/* Registrar pagamento */}
                    <div className="rounded-xl p-3" style={{ background: '#F5F4F0' }}>
                      <div className="text-xs font-bold mb-2" style={{ color: INK }}>Registrar pagamento recebido:</div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 px-3 rounded-xl border border-stone-200 bg-white">
                          <span className="text-xs text-stone-400">R$</span>
                          <input type="text" inputMode="decimal" className="flex-1 py-2.5 text-sm outline-none bg-white" value={valorPagamento}
                            onFocus={e => { const el = e.target; requestAnimationFrame(() => el.select()); }}
                            onChange={e => setValorPagamento(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={d.saldo > 0 ? String(d.saldo.toFixed(2)).replace('.', ',') : '0,00'}
                            onKeyDown={e => e.key === 'Enter' && confirmarPagamento(d.nome)} />
                        </div>
                        <button onClick={() => confirmarPagamento(d.nome)} disabled={!(parseFloat(String(valorPagamento).replace(',', '.')) > 0)}
                          className="px-4 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ background: VERDE }}>
                          Pago ✓
                        </button>
                      </div>
                      {d.saldo > 0 && (
                        <button onClick={() => { setValorPagamento(String(d.saldo.toFixed(2))); }} className="text-xs font-bold mt-2" style={{ color: '#166B3A' }}>
                          Preencher valor total ({formatReais(d.saldo)})
                        </button>
                      )}
                    </div>

                    {/* Checklist dos trabalhos (FIFO) */}
                    <div className="text-xs font-bold mt-3 mb-1.5" style={{ color: INK }}>Trabalhos entregues:</div>
                    <div className="flex flex-col">
                      {statusTrabalhos(d).map(({ caso: c, st, pagoValor }) => (
                        <button key={c.id} onClick={() => onSelect(c.id)} className="flex items-center gap-2 py-2 text-left" style={{ borderTop: '1px solid #F5F5F4' }}>
                          <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                            style={st === 'pago' ? { background: VERDE } : (st === 'parcial' ? { background: '#FDECD8', border: '1.5px solid #EA580C' } : { background: '#F0EFEC' })}>
                            {st === 'pago' && <Check size={12} color="white" strokeWidth={3} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate" style={{ color: st === 'pago' ? '#A8A29E' : INK, textDecoration: st === 'pago' ? 'line-through' : 'none' }}>
                              {c.paciente} • {c.tipoTrabalho}
                            </div>
                            <div className="text-xs text-stone-400">
                              {formatDateBR(c.dataSaida)}
                              {st === 'pago' && <span style={{ color: '#166B3A' }}> • pago ✓</span>}
                              {st === 'parcial' && <span style={{ color: '#B54708' }}> • pagou {formatReais(pagoValor)} — <b>faltam {formatReais(c.valor - pagoValor)}</b></span>}
                              {st === 'aberto' && <span style={{ color: '#DC2626' }}> • em aberto</span>}
                              {st === 'semvalor' && ' • sem valor'}
                            </div>
                          </div>
                          <span className="text-xs font-extrabold flex-shrink-0" style={{ color: st === 'pago' ? '#A8A29E' : (c.valor > 0 ? INK : '#A8A29E') }}>
                            {c.valor > 0 ? formatReais(c.valor) : '—'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Histórico de pagamentos */}
                    {(pagamentos || []).filter(p => p.dentista === d.nome).length > 0 && (
                      <>
                        <div className="text-xs font-bold mt-3 mb-1.5" style={{ color: INK }}>Pagamentos recebidos:</div>
                        <div className="flex flex-col">
                          {(pagamentos || []).filter(p => p.dentista === d.nome).map(p => (
                            <div key={p.id} className="flex items-center gap-2 py-2" style={{ borderTop: '1px solid #F5F5F4' }}>
                              <DollarSign size={13} style={{ color: VERDE }} className="flex-shrink-0" />
                              <span className="text-xs flex-1 text-stone-500">{formatDateBR(p.data)}</span>
                              <span className="text-xs font-extrabold" style={{ color: '#166B3A' }}>{formatReais(p.valor)}</span>
                              <button onClick={() => onRemoverPagamento(p.id)} className="p-1" title="Remover lançamento"><Trash2 size={13} className="text-stone-300" /></button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {(() => {
        const totalCreditos = receberOrdenado.reduce((s, d) => s + Math.max(0, -d.saldo), 0);
        return (
          <>
            {totalReceber > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl" style={{ background: INK }}>
                <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: GOLD }}>Total a receber</span>
                <span className="text-base font-extrabold text-white">{formatReais(totalReceber)}</span>
              </div>
            )}
            {totalCreditos > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl mt-2" style={{ background: '#E8F0FE' }}>
                <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#1A73E8' }}>Créditos de dentistas (pagos a mais)</span>
                <span className="text-sm font-extrabold" style={{ color: '#1A73E8' }}>{formatReais(totalCreditos)}</span>
              </div>
            )}
            <div className="mb-6" />
          </>
        );
      })()}

      <h2 className="text-sm font-bold mb-1" style={{ color: INK }}>Extrato por dentista ({mesNome})</h2>
      <p className="text-xs text-stone-400 mb-3">Só trabalhos <b>entregues</b> no mês — o valor real a cobrar de cada um. Toque em <Share2 size={11} className="inline" /> para enviar o extrato em PDF ao dentista.</p>
      <div className="rounded-2xl bg-white border border-stone-200 mb-6 overflow-hidden">
        {dentistasOrdenados.length === 0 ? (
          <div className="px-4 py-6 text-xs text-stone-400 text-center">Nenhuma entrega registrada em {mesNome} ainda.</div>
        ) : (
          dentistasOrdenados.map(([nomeD, dados], i) => (
            <div key={nomeD} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '1px solid #F5F5F4' : 'none' }}>
              <Stethoscope size={16} style={{ color: ROXO }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: INK }}>{nomeD}</div>
                <div className="text-xs text-stone-400">{dados.trabalhos.length} {dados.trabalhos.length === 1 ? 'trabalho entregue' : 'trabalhos entregues'}</div>
              </div>
              <span className="text-sm font-extrabold flex-shrink-0" style={{ color: '#166B3A' }}>{formatReais(dados.total)}</span>
              <button onClick={() => compartilharExtratoDentista(nomeD, dados)} className="p-2 rounded-lg flex-shrink-0" style={{ background: '#25D366' }} title="Enviar extrato em PDF">
                <Share2 size={14} color="white" />
              </button>
            </div>
          ))
        )}
      </div>

      {dentistasDoMes.length > 0 && (
        <div className="relative mb-3">
          <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
            <Stethoscope size={15} style={{ color: filtroDentistaFin !== 'Todos' ? ROXO : '#A8A29E' }} />
          </div>
          <select value={filtroDentistaFin} onChange={e => setFiltroDentistaFin(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none bg-white appearance-none"
            style={{ border: filtroDentistaFin !== 'Todos' ? `1.5px solid ${ROXO}` : '1px solid #E7E5E4', color: filtroDentistaFin !== 'Todos' ? ROXO : INK, fontWeight: filtroDentistaFin !== 'Todos' ? 700 : 400 }}>
            <option value="Todos">Todos os dentistas</option>
            {dentistasDoMes.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Extrato de entregas ({mesNome}{filtroDentistaFin !== 'Todos' ? ` — ${filtroDentistaFin}` : ''})</h2>
      {entreguesFiltrados.length === 0 ? (
        <div className="text-center py-6 rounded-2xl bg-white border border-stone-200 text-stone-400 text-xs mb-6">Nenhuma entrega {filtroDentistaFin !== 'Todos' ? `de ${filtroDentistaFin} ` : ''}em {mesNome} — os trabalhos em andamento entram no extrato do mês em que forem entregues.</div>
      ) : (
        <div className="rounded-2xl bg-white border border-stone-200 mb-6 overflow-hidden">
          {[...entreguesFiltrados].sort((a, b) => (b.dataSaida || '').localeCompare(a.dataSaida || '')).map((c, i) => (
            <button key={c.id} onClick={() => onSelect(c.id)} className="w-full text-left flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '1px solid #F5F5F4' : 'none' }}>
              <CheckCircle2 size={15} style={{ color: VERDE }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: INK }}>{c.paciente} • {c.tipoTrabalho}</div>
                <div className="text-xs text-stone-400 truncate">{c.dentista} • entregue {formatDateBR(c.dataSaida)}</div>
              </div>
              <span className="text-sm font-extrabold flex-shrink-0" style={{ color: c.valor > 0 ? '#166B3A' : '#A8A29E' }}>{c.valor > 0 ? formatReais(c.valor) : 'sem valor'}</span>
            </button>
          ))}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: GOLD_SOFT }}>
            <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#7A6234' }}>Total entregue em {mesNome}{filtroDentistaFin !== 'Todos' ? ` — ${filtroDentistaFin}` : ''}</span>
            <span className="text-base font-extrabold" style={{ color: INK }}>{formatReais(valorEntregueFiltrado)}</span>
          </div>
        </div>
      )}

      <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Entradas por tipo ({mesNome})</h2>
      <div className="rounded-2xl p-4 bg-white border border-stone-200 mb-6">
        {tiposOrdenados.length === 0 ? (
          <div className="text-xs text-stone-400">Nenhum trabalho entrou neste mês.</div>
        ) : (
          <div className="flex flex-col">
            {tiposOrdenados.map(([tipo, dados]) => (
              <div key={tipo} className="flex items-center gap-2 py-2 border-b border-stone-100 last:border-0">
                <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: INK }}>{tipo}</span>
                <span className="text-xs text-stone-400">{dados.qtd}×</span>
                <span className="text-sm font-extrabold" style={{ color: VERDE }}>{formatReais(dados.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-sm font-bold mb-1" style={{ color: INK }}>Fechamento do mês por tipo ({mesNome})</h2>
      <p className="text-xs text-stone-400 mb-3">A memória do mês: só os trabalhos <b>finalizados</b> em {mesNome} contam aqui. Use as setas no topo para rever o fechamento de qualquer mês anterior.</p>
      <div className="rounded-2xl bg-white border border-stone-200 mb-6 overflow-hidden">
        {tiposFechamento.length === 0 ? (
          <div className="px-4 py-6 text-xs text-stone-400 text-center">Nenhum trabalho finalizado em {mesNome} ainda — o fechamento vai se montando conforme você finaliza.</div>
        ) : (
          <>
            <div className="p-4 pb-2 flex flex-col">
              {tiposFechamento.map(([tipo, dados]) => (
                <div key={tipo} className="flex items-center gap-2 py-2 border-b border-stone-100 last:border-0">
                  <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: INK }}>{tipo}</span>
                  <span className="text-xs text-stone-400">{dados.qtd}×</span>
                  <span className="text-sm font-extrabold" style={{ color: INK }}>{formatReais(dados.valor)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: GOLD_SOFT }}>
              <span className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#7A6234' }}>Fechamento de {mesNome} ({finalizados.length} {finalizados.length === 1 ? 'trabalho' : 'trabalhos'})</span>
              <span className="text-base font-extrabold" style={{ color: INK }}>{formatReais(valorFinalizado)}</span>
            </div>
          </>
        )}
      </div>

      <h2 className="text-sm font-bold mb-3" style={{ color: INK }}>Trabalhos do mês{filtroDentistaFin !== 'Todos' ? ` — ${filtroDentistaFin}` : ''}</h2>
      {entraramFiltrados.length === 0 ? (
        <div className="text-center py-8 rounded-2xl bg-white border border-stone-200 text-stone-400 text-sm">Nenhum trabalho {filtroDentistaFin !== 'Todos' ? `de ${filtroDentistaFin} ` : ''}entrou em {mesNome}.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...entraramFiltrados].sort((a, b) => (b.valor || 0) - (a.valor || 0)).map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)} className="w-full text-left rounded-2xl px-4 py-3 bg-white border border-stone-200 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: INK }}>{c.paciente} • {c.tipoTrabalho}</div>
                <div className="text-xs text-stone-400">{c.dentista} • entrada {formatDateBR(c.dataEntrada)} • {c.status}</div>
              </div>
              <span className="text-sm font-extrabold flex-shrink-0" style={{ color: c.valor > 0 ? VERDE : '#A8A29E' }}>{c.valor > 0 ? formatReais(c.valor) : 'sem valor'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Gera a ficha como arquivo HTML independente (abre e imprime sozinho)
function gerarFichaHTML(caso, dentistaInfo, ehGestor) {
  const etapas = caso.etapas || [];
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linhasEtapas = etapas.map((e, i) => `
    <tr>
      <td>${i + 1}. ${esc(e.nome)}</td>
      <td class="c">${e.prova ? 'Sim' : '—'}</td>
      <td class="c">${e.concluida ? formatDateBR(e.dataConclusao) : '—'}</td>
      <td class="c">${e.duracaoMin ? formatMinutos(e.duracaoMin) : '—'}</td>
      <td>${esc(e.funcionario || '—')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Ficha — ${esc(caso.paciente)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Manrope', -apple-system, system-ui, sans-serif; color: #1C1B19; margin: 0; padding: 24px; }
  .marca { font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #B8935A; }
  .nome { font-size: 26px; font-weight: 800; letter-spacing: 1px; }
  .sub { font-size: 12px; color: #78716C; margin-top: 2px; }
  .cab { border-bottom: 3px solid #1C1B19; padding-bottom: 12px; margin-bottom: 18px; }
  .secao { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #B8935A; margin: 16px 0 6px; }
  table { width: 100%; font-size: 13px; border-collapse: collapse; }
  td, th { padding: 6px 8px; border: 1px solid #E7E5E4; text-align: left; }
  th { background: #F3EBDA; font-size: 12px; }
  .c { text-align: center; }
  .obs { border: 1px solid #E7E5E4; border-radius: 4px; padding: 10px; min-height: 52px; font-size: 13px; white-space: pre-wrap; }
  .ass { width: 100%; margin-top: 48px; font-size: 12px; }
  .ass td { border: none; text-align: center; }
  .linha { border-top: 1px solid #1C1B19; padding-top: 6px; }
  .rodape { font-size: 10px; color: #A8A29E; text-align: center; margin-top: 24px; }
  .aviso { background: #F3EBDA; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
  @media print { .aviso { display: none; } }
</style>
</head>
<body onload="setTimeout(function(){ window.print(); }, 300)">
  <div class="aviso">🖨️ A impressão deve abrir automaticamente. Se não abrir, use <b>Ctrl+P</b> (computador) ou <b>Compartilhar → Imprimir</b> (celular).</div>
  <div class="cab">
    <div class="marca">Laboratório</div>
    <div class="nome">SPECIAL</div>
    <div class="sub">Ficha de Trabalho Protético</div>
  </div>

  <table>
    <tr><td style="width:50%"><b>Paciente:</b> ${esc(caso.paciente)}</td><td><b>Tipo de trabalho:</b> ${esc(caso.tipoTrabalho)}</td></tr>
    <tr><td><b>Dentista/Clínica:</b> ${esc(caso.dentista)}</td><td><b>Material:</b> ${esc(caso.material)}</td></tr>
    ${(dentistaInfo?.endereco || dentistaInfo?.telefone) ? `<tr><td><b>Endereço:</b> ${esc(dentistaInfo?.endereco || '—')}</td><td><b>Telefone:</b> ${esc(dentistaInfo?.telefone || '—')}</td></tr>` : ''}
  </table>

  <div class="secao">Linha do tempo</div>
  <table>
    <tr><td><b>Entrada:</b> ${formatDateBR(caso.dataEntrada)}</td><td><b>Início produção:</b> ${caso.dataProducao ? formatDateBR(caso.dataProducao) : '—'}</td></tr>
    <tr><td><b>Prazo:</b> ${formatDateBR(caso.prazo)}</td><td><b>Finalizado:</b> ${caso.dataFinalizado ? formatDateBR(caso.dataFinalizado) : '—'}</td></tr>
    <tr><td><b>Entregue:</b> ${caso.dataSaida ? formatDateBR(caso.dataSaida) : '—'}</td><td>${ehGestor && caso.valor > 0 ? `<b>Valor do serviço:</b> ${formatReais(caso.valor)}` : '&nbsp;'}</td></tr>
  </table>

  ${etapas.length > 0 ? `
  <div class="secao">Etapas executadas</div>
  <table>
    <tr><th>Etapa</th><th class="c" style="width:70px">Prova</th><th class="c" style="width:90px">Concluída</th><th class="c" style="width:80px">Tempo</th><th style="width:110px">Executor</th></tr>
    ${linhasEtapas}
  </table>` : ''}

  <div class="secao">Observações</div>
  <div class="obs">${esc(caso.observacoes || ' ')}</div>

  <table class="ass">
    <tr>
      <td style="width:45%"><div class="linha">Laboratório Special</div></td>
      <td style="width:10%"></td>
      <td style="width:45%"><div class="linha">Recebido por (clínica)</div></td>
    </tr>
  </table>

  <div class="rodape">Emitido em ${formatDateBR(todayISO())} • Laboratório Special — gestão de casos</div>
</body>
</html>`;
}

// ─── Ficha de trabalho desenhada como imagem (cabe no celular e vira PDF) ───
function desenharFicha(caso, dentistaInfo, ehGestor) {
  const W = 1240, PAD = 90;
  const etapas = caso.etapas || [];
  const F = "'Manrope', -apple-system, sans-serif";
  const cvMed = document.createElement('canvas');
  const ctx0 = cvMed.getContext('2d');
  const quebrarLinhas = (ctx, txt, maxW) => {
    const saida = [];
    String(txt || '').split('\n').forEach(par => {
      const palavras = par.split(/\s+/).filter(Boolean);
      if (palavras.length === 0) { saida.push(''); return; }
      let l = '';
      palavras.forEach(p => {
        const t = l ? l + ' ' + p : p;
        if (ctx.measureText(t).width > maxW && l) { saida.push(l); l = p; }
        else l = t;
      });
      if (l) saida.push(l);
    });
    return saida;
  };
  ctx0.font = `500 26px ${F}`;
  const obsLinhas = quebrarLinhas(ctx0, caso.observacoes || '', W - PAD * 2 - 56);
  const hObs = Math.max(110, obsLinhas.length * 36 + 60);
  const temContato = !!(dentistaInfo?.endereco || dentistaInfo?.telefone);
  const H = 300 + (temContato ? 3 : 2) * 58 + 56 + 3 * 58 + (etapas.length > 0 ? 56 + (etapas.length + 1) * 52 : 0) + 56 + hObs + 320;

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  const celula = (x, y, w, h, texto, negrito, centro, fundo) => {
    if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(x, y, w, h); }
    ctx.strokeStyle = '#D6D3D1'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#1C1B19';
    ctx.font = `${negrito ? 800 : 500} 26px ${F}`;
    let t = String(texto ?? '');
    while (ctx.measureText(t).width > w - 28 && t.length > 3) t = t.slice(0, -2);
    ctx.textBaseline = 'middle';
    if (centro) { ctx.textAlign = 'center'; ctx.fillText(t, x + w / 2, y + h / 2); ctx.textAlign = 'left'; }
    else ctx.fillText(t, x + 14, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  };
  const rotulo = (texto, y) => {
    ctx.fillStyle = '#B8935A'; ctx.font = `800 24px ${F}`;
    ctx.fillText(texto.toUpperCase(), PAD, y);
  };

  // Cabeçalho
  ctx.fillStyle = '#B8935A'; ctx.font = `700 24px ${F}`;
  ctx.fillText('L A B O R A T Ó R I O', PAD, 96);
  ctx.fillStyle = '#1C1B19'; ctx.font = `800 62px ${F}`;
  ctx.fillText('SPECIAL', PAD, 164);
  ctx.fillStyle = '#78716C'; ctx.font = `600 26px ${F}`;
  ctx.fillText('Ficha de Trabalho Protético', PAD, 204);
  ctx.fillStyle = '#1C1B19'; ctx.fillRect(PAD, 228, W - PAD * 2, 6);

  let y = 280;
  const meia = (W - PAD * 2) / 2;
  const L = 58;
  celula(PAD, y, meia, L, `Paciente: ${caso.paciente}`);
  celula(PAD + meia, y, meia, L, `Trabalho: ${caso.tipoTrabalho}`); y += L;
  celula(PAD, y, meia, L, `Dentista: ${caso.dentista}`);
  celula(PAD + meia, y, meia, L, `Material: ${caso.material || '—'}`); y += L;
  if (temContato) {
    celula(PAD, y, meia, L, `Endereço: ${dentistaInfo?.endereco || '—'}`);
    celula(PAD + meia, y, meia, L, `Telefone: ${dentistaInfo?.telefone || '—'}`); y += L;
  }

  y += 56;
  rotulo('Linha do tempo', y - 14);
  celula(PAD, y, meia, L, `Entrada: ${formatDateBR(caso.dataEntrada)}`);
  celula(PAD + meia, y, meia, L, `Início produção: ${caso.dataProducao ? formatDateBR(caso.dataProducao) : '—'}`); y += L;
  celula(PAD, y, meia, L, `Prazo: ${formatDateBR(caso.prazo)}`);
  celula(PAD + meia, y, meia, L, `Finalizado: ${caso.dataFinalizado ? formatDateBR(caso.dataFinalizado) : '—'}`); y += L;
  celula(PAD, y, meia, L, `Entregue: ${caso.dataSaida ? formatDateBR(caso.dataSaida) : '—'}`);
  celula(PAD + meia, y, meia, L, ehGestor && caso.valor > 0 ? `Valor do serviço: ${formatReais(caso.valor)}` : ''); y += L;

  if (etapas.length > 0) {
    y += 56;
    rotulo('Etapas executadas', y - 14);
    const cols = [W - PAD * 2 - 120 - 160 - 130 - 190, 120, 160, 130, 190];
    let x = PAD;
    ['Etapa', 'Prova', 'Concluída', 'Tempo', 'Executor'].forEach((c, i) => { celula(x, y, cols[i], 52, c, true, i > 0, '#F3EBDA'); x += cols[i]; });
    y += 52;
    etapas.forEach((e, i) => {
      x = PAD;
      const nomeEt = `${i + 1}. ${e.item && (caso.itens || []).length > 1 ? `${e.item} — ` : ''}${e.nome}`;
      const vals = [nomeEt, e.prova ? 'Sim' : '—', e.concluida ? formatDateBR(e.dataConclusao) : '—', e.duracaoMin ? formatMinutos(e.duracaoMin) : '—', e.funcionario || '—'];
      vals.forEach((v, j) => { celula(x, y, cols[j], 52, v, false, j > 0 && j < 4); x += cols[j]; });
      y += 52;
    });
  }

  y += 56;
  rotulo('Observações', y - 14);
  ctx.strokeStyle = '#D6D3D1'; ctx.lineWidth = 2;
  ctx.strokeRect(PAD, y, W - PAD * 2, hObs);
  ctx.fillStyle = '#1C1B19'; ctx.font = `500 26px ${F}`;
  obsLinhas.forEach((l, i) => ctx.fillText(l, PAD + 28, y + 48 + i * 36));
  y += hObs;

  y += 140;
  const wAss = (W - PAD * 2 - 120) / 2;
  ctx.strokeStyle = '#1C1B19'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(PAD + wAss, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD + wAss + 120, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  ctx.fillStyle = '#57534E'; ctx.font = `600 24px ${F}`; ctx.textAlign = 'center';
  ctx.fillText('Laboratório Special', PAD + wAss / 2, y + 38);
  ctx.fillText('Recebido por (clínica)', PAD + wAss + 120 + wAss / 2, y + 38);
  ctx.fillStyle = '#A8A29E'; ctx.font = `500 22px ${F}`;
  ctx.fillText(`Emitido em ${formatDateBR(todayISO())} • Laboratório Special — gestão de casos`, W / 2, H - 46);
  ctx.textAlign = 'left';

  return cv.toDataURL('image/jpeg', 0.94);
}

function FichaImpressao({ caso, dentistaInfo, ehGestor, onFechar }) {
  const [img, setImg] = useState('');
  useEffect(() => {
    try { setImg(desenharFicha(caso, dentistaInfo, ehGestor)); } catch (e) { console.error('Erro ao gerar ficha', e); }
  }, [caso]);

  const nomeBase = `ficha-${(caso.paciente || 'trabalho').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const compartilharPDF = async (baixarDireto) => {
    if (!img) return;
    try {
      const pdf = jpegParaPDF(img);
      const file = new File([pdf], `${nomeBase}.pdf`, { type: 'application/pdf' });
      if (!baixarDireto && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ficha — ${caso.paciente}` });
        return;
      }
      const u = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = u; a.download = `${nomeBase}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.error(e);
      baixarDataURL(img, `${nomeBase}.jpg`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto print-overlay" style={{ background: 'rgba(0,0,0,0.78)' }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-sheet, .print-sheet * { visibility: visible !important; }
          .print-sheet { position: absolute !important; left: 0; top: 0; width: 100% !important; max-width: none !important; margin: 0 !important; border-radius: 0 !important; }
          .no-print-inner { display: none !important; }
        }
      `}</style>

      <div className="no-print-inner sticky top-0 z-10 flex flex-col items-center gap-2 py-3 px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button onClick={() => compartilharPDF(false)} className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: '#25D366', color: 'white' }}>
            <Share2 size={16} /> Compartilhar PDF
          </button>
          <button onClick={() => compartilharPDF(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: GOLD, color: INK }}>
            <Download size={16} /> Baixar PDF
          </button>
          <button onClick={() => { try { window.print(); } catch (e) { /* bloqueado */ } }} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white items-center gap-2 hidden lg:flex" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <FileText size={15} /> Imprimir
          </button>
          <button onClick={onFechar} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <X size={15} /> Fechar
          </button>
        </div>
        <div className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '400px' }}>
          No celular: <b>Compartilhar PDF</b> abre o WhatsApp ou o serviço de impressão do aparelho. No computador: <b>Imprimir</b>.
        </div>
      </div>

      {img
        ? <img src={img} alt="Ficha de trabalho" className="print-sheet w-full mx-auto my-4 rounded-xl bg-white" style={{ maxWidth: '640px', display: 'block' }} />
        : <div className="text-center text-white text-sm py-10">Gerando ficha...</div>}
    </div>
  );
}

// (versão antiga em HTML — mantida apenas como referência, sem uso)
function FichaImpressaoAntigaHTML({ caso, dentistaInfo, ehGestor, onFechar }) {
  const etapas = caso.etapas || [];

  const baixarEImprimir = () => {
    const html = gerarFichaHTML(caso, dentistaInfo, ehGestor);
    const nomeArquivo = `ficha-${caso.paciente.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
    baixarDataURL('data:text/html;charset=utf-8,' + encodeURIComponent(html), nomeArquivo);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto print-overlay" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-sheet, .print-sheet * { visibility: visible !important; }
          .print-sheet { position: absolute !important; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
          .no-print-inner { display: none !important; }
        }
      `}</style>

      <div className="no-print-inner sticky top-0 z-10 flex flex-col items-center gap-2 py-3 px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button onClick={baixarEImprimir} className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2" style={{ background: GOLD, color: INK }}>
            <Download size={16} /> Baixar e imprimir (A4)
          </button>
          <button onClick={() => { try { window.print(); } catch (e) { /* bloqueado */ } }} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <FileText size={15} /> Imprimir direto
          </button>
          <button onClick={onFechar} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <X size={15} /> Fechar
          </button>
        </div>
        <div className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '380px' }}>
          Toque em <b>"Baixar e imprimir"</b>: a ficha baixa e, ao abrir o arquivo, a impressão já aparece sozinha. ("Imprimir direto" funciona quando o app está aberto no navegador.)
        </div>
      </div>

      <div className="print-sheet mx-auto my-4 bg-white" style={{ maxWidth: '210mm', minHeight: '280mm', padding: '18mm 16mm', fontFamily: "'Manrope', system-ui, sans-serif", color: '#1C1B19' }}>
        {/* Cabeçalho */}
        <div style={{ borderBottom: '3px solid #1C1B19', paddingBottom: '12px', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: '#B8935A' }}>Laboratório</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '1px' }}>SPECIAL</div>
          <div style={{ fontSize: '12px', color: '#78716C', marginTop: '2px' }}>Ficha de Trabalho Protético</div>
        </div>

        {/* Identificação */}
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', width: '50%', border: '1px solid #E7E5E4' }}><b>Paciente:</b> {caso.paciente}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Tipo de trabalho:</b> {caso.tipoTrabalho}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Dentista/Clínica:</b> {caso.dentista}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Material:</b> {caso.material}</td>
            </tr>
            {(dentistaInfo?.endereco || dentistaInfo?.telefone) && (
              <tr>
                <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Endereço:</b> {dentistaInfo?.endereco || '—'}</td>
                <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Telefone:</b> {dentistaInfo?.telefone || '—'}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Datas */}
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#B8935A', marginBottom: '6px' }}>Linha do tempo</div>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Entrada:</b> {formatDateBR(caso.dataEntrada)}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Início produção:</b> {caso.dataProducao ? formatDateBR(caso.dataProducao) : '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Prazo:</b> {formatDateBR(caso.prazo)}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Finalizado:</b> {caso.dataFinalizado ? formatDateBR(caso.dataFinalizado) : '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}><b>Entregue:</b> {caso.dataSaida ? formatDateBR(caso.dataSaida) : '—'}</td>
              <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}>{ehGestor && caso.valor > 0 ? <><b>Valor do serviço:</b> {formatReais(caso.valor)}</> : <span> </span>}</td>
            </tr>
          </tbody>
        </table>

        {/* Etapas */}
        {etapas.length > 0 && (
          <>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#B8935A', marginBottom: '6px' }}>Etapas executadas</div>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#F3EBDA' }}>
                  <th style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'left' }}>Etapa</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'center', width: '70px' }}>Prova</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'center', width: '90px' }}>Concluída</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'center', width: '80px' }}>Tempo</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'left', width: '110px' }}>Executor</th>
                </tr>
              </thead>
              <tbody>
                {etapas.map((e, i) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}>{i + 1}. {e.nome}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'center' }}>{e.prova ? 'Sim' : '—'}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'center' }}>{e.concluida ? formatDateBR(e.dataConclusao) : '—'}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4', textAlign: 'center' }}>{e.duracaoMin ? formatMinutos(e.duracaoMin) : '—'}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #E7E5E4' }}>{e.funcionario || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Observações */}
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#B8935A', marginBottom: '6px' }}>Observações</div>
        <div style={{ fontSize: '13px', border: '1px solid #E7E5E4', borderRadius: '4px', padding: '10px', minHeight: '52px', marginBottom: '28px', whiteSpace: 'pre-wrap' }}>
          {caso.observacoes || ' '}
        </div>

        {/* Assinaturas */}
        <table style={{ width: '100%', fontSize: '12px', marginTop: '30px' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%', textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #1C1B19', paddingTop: '6px' }}>Laboratório Special</div>
              </td>
              <td style={{ width: '10%' }} />
              <td style={{ width: '45%', textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #1C1B19', paddingTop: '6px' }}>Recebido por (clínica)</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '10px', color: '#A8A29E', textAlign: 'center', marginTop: '24px' }}>
          Emitido em {formatDateBR(todayISO())} • Laboratório Special — gestão de casos
        </div>
      </div>
    </div>
  );
}
