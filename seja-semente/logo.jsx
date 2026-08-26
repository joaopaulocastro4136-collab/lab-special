// A árvore original da logo do Seja Semente (recortada da marca oficial),
// para usar nas telas dos aplicativos. A marca não se modifica — este arquivo
// só embute a imagem como ela é.
import { useState, useEffect } from 'react';
import arvore from './icones/arvore.png';

export function ArvoreLogo({ tamanho = 120 }) {
  return <img src={arvore} width={tamanho} alt="Seja Semente" style={{ display: 'block' }} />;
}

// Paleta das gotas da árvore — usada nas bolhas coloridas dos cartões
export const CORES_MARCA = ['#F0A912', '#F28C1E', '#E24B26', '#A44A9C', '#7E4A9E', '#3559B8', '#1F6FB2', '#29A0CE', '#2FA38C', '#5FA83C', '#2F7D4E'];

export function corDoNome(texto) {
  let soma = 0;
  for (const ch of String(texto || '?')) soma = (soma + ch.charCodeAt(0)) % 997;
  return CORES_MARCA[soma % CORES_MARCA.length];
}

export function iniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?';
}

// Bolha colorida: com `foto` mostra o rosto; com `Icone` (lucide) vira bolha
// de ícone em tom suave; senão, as iniciais do nome
export function Bolha({ nome, Icone, foto, avatar }) {
  const cor = corDoNome(nome);
  if (foto) return <div className="bolha" style={{ padding: 0, overflow: 'hidden', background: '#E7EDE7' }}><img src={foto} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  if (avatar) return <DenteAvatar tipo={avatar} />;
  if (Icone) return <div className="bolha suave" style={{ background: cor + '22', color: cor }}><Icone size={22} strokeWidth={2.4} /></div>;
  return <div className="bolha" style={{ background: cor }}>{iniciais(nome)}</div>;
}

// ─── Biblioteca de dentinhos: avatares de dente com carinhas, para usar no
//     lugar da foto do perfil (feliz, com raiva, apaixonado, estiloso…) ───
export const AVATARES_DENTE = [
  { id: 'feliz', nome: 'Dente feliz', bg: '#2F7D4E' },
  { id: 'sorrisao', nome: 'Dente sorridente', bg: '#29A0CE' },
  { id: 'raiva', nome: 'Dente com raiva', bg: '#C22326' },
  { id: 'amor', nome: 'Dente apaixonado', bg: '#E2578A' },
  { id: 'oculos', nome: 'Dente estiloso', bg: '#223528' },
  { id: 'estrela', nome: 'Dente brilhante', bg: '#F0A912' },
  { id: 'surpreso', nome: 'Dente surpreso', bg: '#7E4A9E' },
  { id: 'sono', nome: 'Dente sonolento', bg: '#3559B8' },
];

function RostoDoDente({ tipo }) {
  const olhos = <><circle cx="7" cy="8.6" r="1" fill="#26323B" /><circle cx="13" cy="8.6" r="1" fill="#26323B" /></>;
  const sorriso = <path d="M7.2 10.9 Q10 13.1 12.8 10.9" stroke="#26323B" strokeWidth="1.2" fill="none" strokeLinecap="round" />;
  if (tipo === 'sorrisao') return <>
    <path d="M5.8 8.6 Q7 7.3 8.2 8.6" stroke="#26323B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    <path d="M11.8 8.6 Q13 7.3 14.2 8.6" stroke="#26323B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    <path d="M6.9 10.6 Q10 13.9 13.1 10.6 Z" fill="#26323B" />
  </>;
  if (tipo === 'raiva') return <>
    <path d="M5.4 6.7 L8.2 7.9" stroke="#26323B" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M14.6 6.7 L11.8 7.9" stroke="#26323B" strokeWidth="1.2" strokeLinecap="round" />
    {olhos}
    <path d="M7.4 12.3 Q10 10.5 12.6 12.3" stroke="#26323B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </>;
  if (tipo === 'amor') return <>
    <path d="M7 9.7 C5.5 8.4 6.2 6.8 7 7.5 C7.8 6.8 8.5 8.4 7 9.7 Z" fill="#E2578A" />
    <path d="M13 9.7 C11.5 8.4 12.2 6.8 13 7.5 C13.8 6.8 14.5 8.4 13 9.7 Z" fill="#E2578A" />
    {sorriso}
  </>;
  if (tipo === 'oculos') return <>
    <rect x="4.4" y="6.9" width="4.6" height="3.1" rx="1.2" fill="#26323B" />
    <rect x="11" y="6.9" width="4.6" height="3.1" rx="1.2" fill="#26323B" />
    <path d="M9 8.3 L11 8.3" stroke="#26323B" strokeWidth="1" />
    {sorriso}
  </>;
  if (tipo === 'estrela') return <>
    <path d="M7 6.9 L7.5 8.3 L8.9 8.8 L7.5 9.3 L7 10.7 L6.5 9.3 L5.1 8.8 L6.5 8.3 Z" fill="#F0A912" />
    <path d="M13 6.9 L13.5 8.3 L14.9 8.8 L13.5 9.3 L13 10.7 L12.5 9.3 L11.1 8.8 L12.5 8.3 Z" fill="#F0A912" />
    {sorriso}
  </>;
  if (tipo === 'surpreso') return <>{olhos}<circle cx="10" cy="11.7" r="1.4" fill="#26323B" /></>;
  if (tipo === 'sono') return <>
    <path d="M5.8 8.6 L8.2 8.6" stroke="#26323B" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M11.8 8.6 L14.2 8.6" stroke="#26323B" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M9.2 11.7 Q10 12.3 10.8 11.7" stroke="#26323B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    <text x="14.6" y="5.6" fontSize="4.6" fontWeight="800" fill="#26323B">z</text>
  </>;
  return <>{olhos}{sorriso}</>; // feliz (padrão)
}

export function DenteAvatar({ tipo, tamanho = 46 }) {
  const av = AVATARES_DENTE.find(a => a.id === tipo) || AVATARES_DENTE[0];
  return (
    <div className="bolha" style={{ background: av.bg, width: tamanho, height: tamanho, flex: 'none' }} title={av.nome}>
      <svg width={tamanho * 0.66} height={tamanho * 0.66} viewBox="0 0 20 22" aria-label={av.nome}>
        <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z" fill="#FFFFFF" />
        <RostoDoDente tipo={av.id} />
      </svg>
    </div>
  );
}

// Abertura animada — a história da diversidade: um monte de cores diferentes
// passa pela tela, vai se reunindo no centro até FORMAR UMA SEMENTE; a
// semente se abre e dela brota a logo. Pessoas diferentes, um projeto só.
// Roda toda vez que o aplicativo abre do zero.
export function Abertura({ tema = 'verde', nome = 'Seja Semente', frase = '', aoTerminar }) {
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    const s = setTimeout(() => setSaindo(true), 3800);
    const t = setTimeout(() => aoTerminar?.(), 4400);
    return () => { clearTimeout(s); clearTimeout(t); };
  }, []);
  // 26 partículas coloridas; o ângulo áureo espalha bem sem precisar de sorteio
  const particulas = Array.from({ length: 26 }, (_, i) => {
    const a0 = i * 2.39996; // ~137,5°
    const r0 = 52 + (i % 5) * 9;
    const a1 = a0 + 1.9 + (i % 3) * 0.35; // ponto do meio: cria o redemoinho
    const r1 = 20 + (i % 4) * 7;
    return {
      cor: CORES_MARCA[i % CORES_MARCA.length],
      x0: Math.cos(a0) * r0, y0: Math.sin(a0) * r0,
      x1: Math.cos(a1) * r1, y1: Math.sin(a1) * r1,
      tam: 8 + (i % 4) * 3,
      atraso: (i % 7) * 0.09,
      redonda: i % 3 !== 0,
    };
  });
  return (
    <div className={`abertura ${tema}${saindo ? ' saindo' : ''}`}>
      <div className="abertura-palco">
        {particulas.map((p, i) => (
          <span key={i} className="abertura-cor" style={{
            background: p.cor, width: p.tam, height: p.tam,
            margin: `${-p.tam / 2}px 0 0 ${-p.tam / 2}px`,
            borderRadius: p.redonda ? '50%' : '50% 50% 50% 10%',
            '--x0': p.x0 + 'vmin', '--y0': p.y0 + 'vmin',
            '--x1': p.x1 + 'vmin', '--y1': p.y1 + 'vmin',
            animationDelay: p.atraso + 's',
          }} />
        ))}
        <div className="abertura-luz" />
        <svg className="abertura-broto" width="136" height="136" viewBox="0 0 100 112" fill="none">
          {/* a plantinha que brota de dentro da semente */}
          <g stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 96 C50 76 50 60 50 42" />
            <path d="M50 62 C34 62 22 52 20 34 C38 36 48 46 50 62" />
            <path d="M50 48 C50 30 62 18 80 16 C78 34 66 46 50 48" />
          </g>
          {/* a semente que as cores formam — e que se abre em duas cascas */}
          <path className="casca esq" fill="#F6EBC9" d="M50 74 C40 74 33 82 33 92 C33 102 41 109 50 109 Z" />
          <path className="casca dir" fill="#EFD9A0" d="M50 74 C60 74 67 82 67 92 C67 102 59 109 50 109 Z" />
        </svg>
      </div>
      <div className="abertura-nome">{nome}</div>
      {frase && <div className="abertura-frase">{frase}</div>}
    </div>
  );
}

// O "G" colorido oficial do Google, para o botão de entrar
// A maçã da Apple, para o botão de entrar — desenhada aqui para não
// depender de imagem nenhuma
export function MacaAppleLogo({ tamanho = 20 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.72c-.02-2.28 1.86-3.38 1.95-3.43-1.06-1.56-2.72-1.77-3.31-1.79-1.41-.14-2.75.83-3.47.83-.71 0-1.82-.81-2.99-.79-1.54.02-2.96.89-3.75 2.27-1.6 2.78-.41 6.9 1.15 9.16.76 1.11 1.67 2.35 2.86 2.31 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.99.72 1.23-.02 2.01-1.13 2.76-2.24.87-1.29 1.23-2.53 1.25-2.6-.03-.01-2.4-.92-2.42-3.65zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.67 1.37-.59.68-1.1 1.77-.96 2.81 1.01.08 2.05-.51 2.69-1.28z" />
    </svg>
  );
}

export function GoogleG({ tamanho = 22 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// Brotinho pequeno para divisores e enfeites
export function BrotoMini({ tamanho = 18, cor = '#9DBBA8' }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 100 100" fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M50 92 C50 74 50 60 50 42" />
      <path d="M50 62 C34 62 22 52 20 34 C38 36 48 46 50 62" />
      <path d="M50 48 C50 30 62 18 80 16 C78 34 66 46 50 48" />
    </svg>
  );
}

// Diz se o aparelho está com internet neste momento (atualiza sozinho).
// Os apps usam para mostrar o aviso "sem internet — salvando no aparelho".
export function usarTemInternet() {
  const [tem, setTem] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const liga = () => setTem(true), desliga = () => setTem(false);
    window.addEventListener('online', liga);
    window.addEventListener('offline', desliga);
    return () => { window.removeEventListener('online', liga); window.removeEventListener('offline', desliga); };
  }, []);
  return tem;
}

// Identidade DESTE aparelho (celular/navegador): sorteada uma vez e guardada.
// Usada para a chamada de paciente não tocar no aparelho de quem chamou —
// mas tocar em todos os outros, mesmo que a conta seja a mesma.
export function idAparelho() {
  let id = lerLocal('ss-aparelho', '');
  if (!id) { id = 'ap-' + Math.random().toString(36).slice(2, 12); gravarLocal('ss-aparelho', id); }
  return id;
}

// Guarda e lê dados no aparelho (modo demonstração vira "app de verdade":
// o que você cadastra fica salvo mesmo fechando o aplicativo)
export function lerLocal(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch (e) { return padrao; }
}
export function gravarLocal(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem espaço */ }
}

// Gesto de voltar: arrastar o dedo da beirada esquerda para a direita faz o
// mesmo que o botão "Voltar" da tela aberta (o costume do iPhone). Só age
// quando existe um botão Voltar na tela — formulários com "Cancelar" ficam
// de fora, para ninguém perder o que estava digitando sem querer.
export function ligarGestoVoltar() {
  let inicioX = null, inicioY = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    inicioX = t.clientX;
    inicioY = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (inicioX === null) return;
    const t = e.changedTouches[0];
    const andouX = t.clientX - inicioX;
    const andouY = Math.abs(t.clientY - inicioY);
    const começouNaBeirada = inicioX <= 60;
    if (começouNaBeirada && andouX > 70 && andouY < 80) {
      const botao = document.querySelector('.btn-voltar');
      if (botao) botao.click();
    }
    inicioX = null;
  }, { passive: true });
}
