// A árvore original da logo do Seja Semente (recortada da marca oficial),
// para usar nas telas dos aplicativos. A marca não se modifica — este arquivo
// só embute a imagem como ela é.
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

// Bolha colorida: com só `nome` vira avatar de iniciais; com `Icone` (lucide)
// vira bolha de ícone em tom suave
export function Bolha({ nome, Icone }) {
  const cor = corDoNome(nome);
  if (Icone) return <div className="bolha suave" style={{ background: cor + '22', color: cor }}><Icone size={22} strokeWidth={2.4} /></div>;
  return <div className="bolha" style={{ background: cor }}>{iniciais(nome)}</div>;
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
