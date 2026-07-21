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
export function Bolha({ nome, Icone, foto }) {
  const cor = corDoNome(nome);
  if (foto) return <div className="bolha" style={{ padding: 0, overflow: 'hidden', background: '#E7EDE7' }}><img src={foto} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  if (Icone) return <div className="bolha suave" style={{ background: cor + '22', color: cor }}><Icone size={22} strokeWidth={2.4} /></div>;
  return <div className="bolha" style={{ background: cor }}>{iniciais(nome)}</div>;
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
