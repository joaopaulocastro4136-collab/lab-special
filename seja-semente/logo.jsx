// A árvore do Seja Semente (gotas coloridas) desenhada em SVG — a mesma dos
// ícones dos aplicativos, para usar nas telas (login, cabeçalhos etc).
const CORES = ['#F6C500', '#F28C1E', '#E24B26', '#C22326', '#A44A9C', '#7E4A9E', '#274B9F', '#1F6FB2', '#29A8DF', '#3FB5A3', '#7DBB42', '#4C9E3F'];
const GOTA = 'M0 -34 C 14 -12, 19 6, 0 22 C -19 6, -14 -12, 0 -34 Z';

function gotas() {
  const lista = [];
  const N1 = 13;
  for (let i = 0; i < N1; i++) {
    const t = i / (N1 - 1);
    const ang = (-190 + t * 200) * Math.PI / 180;
    const raio = 175 + 18 * Math.sin(i * 2.1);
    lista.push({ x: raio * Math.cos(ang), y: raio * Math.sin(ang) * 0.9, rot: ang * 180 / Math.PI - 90, tam: 1 + 0.22 * Math.sin(i * 1.3), cor: CORES[i % CORES.length] });
  }
  const N2 = 9;
  for (let i = 0; i < N2; i++) {
    const t = i / (N2 - 1);
    const ang = (-178 + t * 176) * Math.PI / 180;
    const raio = 112 + 10 * Math.sin(i * 1.7 + 2);
    lista.push({ x: raio * Math.cos(ang), y: raio * Math.sin(ang) * 0.9, rot: ang * 180 / Math.PI - 90, tam: 0.66 + 0.14 * Math.sin(i * 2.3 + 1), cor: CORES[(i * 5 + 3) % CORES.length] });
  }
  for (let i = 0; i < 5; i++) {
    const ang = (-160 + i * 35) * Math.PI / 180;
    lista.push({ x: 58 * Math.cos(ang), y: 58 * Math.sin(ang) * 0.9, rot: ang * 180 / Math.PI - 90, tam: 0.42, cor: CORES[(i * 7 + 5) % CORES.length] });
  }
  return lista;
}

const GALHOS = [-165, -130, -95, -60, -25].map(a => {
  const r = a * Math.PI / 180;
  const fx = 118 * Math.cos(r), fy = 118 * Math.sin(r) * 0.9;
  return `M0 55 Q ${fx * 0.35} ${fy * 0.5 + 30}, ${fx} ${fy}`;
});

export function ArvoreLogo({ tamanho = 120, tronco = '#6B4423' }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="-280 -290 570 620">
      {GALHOS.map((d, i) => <path key={'g' + i} d={d} stroke={tronco} strokeWidth="9" fill="none" strokeLinecap="round" />)}
      <path d="M-8 300 C 2 240, -4 160, 0 55" stroke={tronco} strokeWidth="20" fill="none" strokeLinecap="round" />
      <path d="M-80 302 Q 0 278, 84 302" stroke={tronco} strokeWidth="11" fill="none" strokeLinecap="round" />
      {gotas().map((g, i) => (
        <path key={i} d={GOTA} transform={`translate(${g.x} ${g.y}) rotate(${g.rot}) scale(${g.tam})`} fill={g.cor} />
      ))}
    </svg>
  );
}
