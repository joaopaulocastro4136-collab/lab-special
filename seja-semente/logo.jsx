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

// Abertura animada: as cores da marca voam das bordas da tela, se unem no
// centro e a plantinha "brota" desenhando-se; por fim aparece o nome do app.
// Roda toda vez que o aplicativo abre do zero.
export function Abertura({ tema = 'verde', nome = 'Seja Semente', frase = '', aoTerminar }) {
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    const s = setTimeout(() => setSaindo(true), 2800);
    const t = setTimeout(() => aoTerminar?.(), 3400);
    return () => { clearTimeout(s); clearTimeout(t); };
  }, []);
  const sementes = CORES_MARCA.map((cor, i) => {
    const ang = (i / CORES_MARCA.length) * Math.PI * 2 + 0.6;
    const dist = 46 + (i % 3) * 16;
    return { cor, dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, atraso: 0.1 + (i % 5) * 0.08 };
  });
  return (
    <div className={`abertura ${tema}${saindo ? ' saindo' : ''}`}>
      <div className="abertura-palco">
        {sementes.map((s, i) => (
          <span key={i} className="abertura-semente" style={{ background: s.cor, '--dx': s.dx + 'vmin', '--dy': s.dy + 'vmin', animationDelay: s.atraso + 's' }} />
        ))}
        <div className="abertura-luz" />
        <svg className="abertura-broto" width="128" height="128" viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 92 C50 74 50 60 50 42" />
          <path d="M50 62 C34 62 22 52 20 34 C38 36 48 46 50 62" />
          <path d="M50 48 C50 30 62 18 80 16 C78 34 66 46 50 48" />
        </svg>
      </div>
      <div className="abertura-nome">{nome}</div>
      {frase && <div className="abertura-frase">{frase}</div>}
    </div>
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
