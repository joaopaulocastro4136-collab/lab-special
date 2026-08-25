// Figurinhas do chat — personagens da odontologia com sentimento, desenhados
// na identidade do Seja Semente. A mensagem guarda só o NOME da figurinha
// (ex.: "bisturi-raiva"), levinho para o banco; o desenho vive aqui no app.
const T = '#26323B'; // cor do traço dos rostinhos

// ── Peças de rosto no espaço do dentinho (20×22, o mesmo dos avatares) ──
const olhos = <><circle cx="7" cy="8.6" r="1" fill={T} /><circle cx="13" cy="8.6" r="1" fill={T} /></>;
const sorriso = <path d="M7.2 10.9 Q10 13.1 12.8 10.9" stroke={T} strokeWidth="1.2" fill="none" strokeLinecap="round" />;
const boca_triste = <path d="M7.4 12.5 Q10 10.7 12.6 12.5" stroke={T} strokeWidth="1.2" fill="none" strokeLinecap="round" />;

function Dentinho({ rosto, extras }) {
  return (
    <g transform="translate(1.8,1.2) scale(2.1)">
      <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z" fill="#FFFFFF" stroke={T} strokeWidth="0.7" />
      {rosto}
      {extras}
    </g>
  );
}

export const FIGURINHAS = [
  {
    id: 'dente-feliz', nome: 'Dentinho feliz',
    desenho: <Dentinho rosto={<>{olhos}{sorriso}</>} />,
  },
  {
    id: 'dente-triste', nome: 'Dentinho triste',
    desenho: <Dentinho rosto={<>
      <path d="M5.9 7.6 Q7 8.4 8.1 7.9" stroke={T} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M14.1 7.6 Q13 8.4 11.9 7.9" stroke={T} strokeWidth="1" fill="none" strokeLinecap="round" />
      {olhos}{boca_triste}
      <path d="M14.9 9.4 C16.1 11 16.1 12.1 14.9 12.5 C13.7 12.1 13.7 11 14.9 9.4 Z" fill="#29A0CE" />
    </>} />,
  },
  {
    id: 'dente-raiva', nome: 'Dentinho com raiva',
    desenho: <Dentinho rosto={<>
      <path d="M5.4 6.7 L8.2 7.9" stroke={T} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14.6 6.7 L11.8 7.9" stroke={T} strokeWidth="1.2" strokeLinecap="round" />
      {olhos}
      <path d="M7.4 12.3 Q10 10.5 12.6 12.3" stroke={T} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>} extras={<>
      <path d="M16.6 2.4 L15.6 3.8 M18 3.6 L16.6 4.6 M17.9 1.6 L17.2 2.9" stroke="#C22326" strokeWidth="1" strokeLinecap="round" />
    </>} />,
  },
  {
    id: 'dente-amor', nome: 'Dentinho apaixonado',
    desenho: <Dentinho rosto={<>
      <path d="M7 9.7 C5.5 8.4 6.2 6.8 7 7.5 C7.8 6.8 8.5 8.4 7 9.7 Z" fill="#E2578A" />
      <path d="M13 9.7 C11.5 8.4 12.2 6.8 13 7.5 C13.8 6.8 14.5 8.4 13 9.7 Z" fill="#E2578A" />
      {sorriso}
    </>} extras={<>
      <path d="M17.2 3.6 C16.2 2.7 16.7 1.6 17.2 2.1 C17.7 1.6 18.2 2.7 17.2 3.6 Z" fill="#E2578A" />
    </>} />,
  },
  {
    id: 'dente-oculos', nome: 'Dentinho estiloso',
    desenho: <Dentinho rosto={<>
      <rect x="4.4" y="6.9" width="4.6" height="3.1" rx="1.2" fill={T} />
      <rect x="11" y="6.9" width="4.6" height="3.1" rx="1.2" fill={T} />
      <path d="M9 8.3 L11 8.3" stroke={T} strokeWidth="1" />
      {sorriso}
    </>} />,
  },
  {
    id: 'dente-coroa', nome: 'Dentinho rei',
    desenho: <Dentinho rosto={<>{olhos}{sorriso}</>} extras={<>
      <path d="M6.8 2.6 L7.5 0.4 L9 1.8 L10 0 L11 1.8 L12.5 0.4 L13.2 2.6 Z" fill="#F0A912" stroke={T} strokeWidth="0.6" strokeLinejoin="round" />
    </>} />,
  },
  {
    id: 'dente-quebrado', nome: 'Dentinho quebrado',
    desenho: <Dentinho rosto={<>
      <path d="M5.9 7.6 Q7 8.4 8.1 7.9" stroke={T} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M14.1 7.6 Q13 8.4 11.9 7.9" stroke={T} strokeWidth="1" fill="none" strokeLinecap="round" />
      {olhos}{boca_triste}
    </>} extras={<>
      <path d="M12.6 2.9 L11.6 4.6 L13 6 L11.9 7.4" stroke={T} strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>} />,
  },
  {
    id: 'bisturi-raiva', nome: 'Bisturi com raiva',
    desenho: <>
      <path d="M20 16 C20 8.5 21.6 4.5 24 3 C28.6 6 30 11 28.6 16 Z" fill="#DDE7EC" stroke={T} strokeWidth="1" strokeLinejoin="round" />
      <rect x="20" y="16" width="8.6" height="26" rx="4" fill="#3559B8" stroke={T} strokeWidth="1" />
      <path d="M21.2 22.2 L23.4 23.4 M27.4 22.2 L25.2 23.4" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="22.4" cy="25.6" r="1.15" fill="#FFFFFF" />
      <circle cx="26.2" cy="25.6" r="1.15" fill="#FFFFFF" />
      <path d="M22.2 29.8 Q24.3 28.2 26.4 29.8" stroke="#FFFFFF" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M33 6 L31.6 8 M35 8.4 L33 9.8 M34.6 4.6 L33.7 6.4" stroke="#C22326" strokeWidth="1.2" strokeLinecap="round" />
    </>,
  },
  {
    id: 'boticao-sorriso', nome: 'Boticão sorridente',
    desenho: <>
      <path d="M21.8 17 C20.6 10.5 21.8 6.5 24 4.5" stroke="#C9D4DA" strokeWidth="3.8" strokeLinecap="round" fill="none" />
      <path d="M26.2 17 C27.4 10.5 26.2 6.5 24 4.5" stroke="#C9D4DA" strokeWidth="3.8" strokeLinecap="round" fill="none" />
      <path d="M18 44 C15.6 34 17.6 27 21 21.5" stroke="#C22326" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M30 44 C32.4 34 30.4 27 27 21.5" stroke="#C22326" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="24" cy="21.5" r="7.2" fill="#C22326" stroke={T} strokeWidth="1" />
      <circle cx="21.4" cy="20" r="1.3" fill="#FFFFFF" />
      <circle cx="26.6" cy="20" r="1.3" fill="#FFFFFF" />
      <path d="M20.8 23.6 Q24 26.6 27.2 23.6" stroke="#FFFFFF" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>,
  },
  {
    id: 'escova-feliz', nome: 'Escovinha animada',
    desenho: <>
      <path d="M20.6 4.6 L20.6 1.6 M23 4.6 L23 1.6 M25.4 4.6 L25.4 1.6 M27.8 4.6 L27.8 1.6" stroke="#29A0CE" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="19.3" y="4.6" width="9.8" height="11" rx="3.2" fill="#FFFFFF" stroke={T} strokeWidth="1" />
      <rect x="20.7" y="15.6" width="7" height="27" rx="3.5" fill="#2F7D4E" stroke={T} strokeWidth="1" />
      <circle cx="22.5" cy="22.5" r="1.15" fill="#FFFFFF" />
      <circle cx="25.9" cy="22.5" r="1.15" fill="#FFFFFF" />
      <path d="M22.2 26.4 Q24.2 28.4 26.2 26.4" stroke="#FFFFFF" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>,
  },
  {
    id: 'seringa-medo', nome: 'Seringa assustada',
    desenho: <>
      <path d="M24 1.4 L24 8" stroke="#8A968D" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="18.8" y="8" width="10.4" height="21" rx="2.6" fill="#EFE4F7" stroke={T} strokeWidth="1" />
      <path d="M20.4 12.5 L23 12.5 M20.4 16.5 L23 16.5" stroke="#7E4A9E" strokeWidth="1" strokeLinecap="round" />
      <rect x="21.4" y="29" width="5.2" height="9.5" rx="2.2" fill="#7E4A9E" stroke={T} strokeWidth="1" />
      <rect x="17.4" y="38.5" width="13.2" height="4.4" rx="2.2" fill="#7E4A9E" stroke={T} strokeWidth="1" />
      <circle cx="21.9" cy="20.5" r="1.7" fill="#FFFFFF" stroke={T} strokeWidth="0.8" />
      <circle cx="26.1" cy="20.5" r="1.7" fill="#FFFFFF" stroke={T} strokeWidth="0.8" />
      <circle cx="21.9" cy="20.9" r="0.7" fill={T} />
      <circle cx="26.1" cy="20.9" r="0.7" fill={T} />
      <ellipse cx="24" cy="25.4" rx="1.4" ry="1.8" fill={T} />
      <path d="M32.4 12.4 C33.6 14 33.6 15.1 32.4 15.5 C31.2 15.1 31.2 14 32.4 12.4 Z" fill="#29A0CE" />
    </>,
  },
  {
    id: 'espelhinho-uau', nome: 'Espelhinho surpreso',
    desenho: <>
      <circle cx="24" cy="14" r="10" fill="#DDE7EC" stroke="#3559B8" strokeWidth="2.6" />
      <rect x="22.2" y="24.4" width="3.6" height="18.6" rx="1.8" fill="#3559B8" stroke={T} strokeWidth="0.8" />
      <path d="M18.6 9.2 L21 11.4" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="21" cy="13" r="1.1" fill={T} />
      <circle cx="27" cy="13" r="1.1" fill={T} />
      <circle cx="24" cy="17.4" r="1.6" fill={T} />
    </>,
  },
];

export function Figurinha({ id, tamanho = 96 }) {
  const f = FIGURINHAS.find(x => x.id === id);
  if (!f) return null;
  return <svg viewBox="0 0 48 48" width={tamanho} height={tamanho} aria-label={f.nome} style={{ display: 'block' }}>{f.desenho}</svg>;
}
