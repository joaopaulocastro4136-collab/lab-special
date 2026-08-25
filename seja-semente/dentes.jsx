// Odontograma — a arcada completa com DENTES desenhados (não bolinhas),
// cada um com o seu número (padrão FDI: 18–11 | 21–28 em cima, 48–41 |
// 31–38 embaixo). Na triagem a pessoa TOCA nos dentes do tratamento; na
// ficha a mesma arcada aparece só de leitura, mostrando os marcados.
// Compartilhado entre a central Seja Semente e o Semeador.

export const DENTES_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const DENTES_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Posições dos 16 dentes ao longo do arco (em % do contêiner)
function posicoes(paraBaixo) {
  return Array.from({ length: 16 }, (_, i) => {
    const ang = Math.PI * (1 - i / 15); // 180° → 0°
    const x = 50 + 44 * Math.cos(ang);
    const y = paraBaixo
      ? 14 + 74 * Math.sin(ang)   // arco de baixo: ∪ (fundo no meio)
      : 86 - 74 * Math.sin(ang);  // arco de cima: ∩ (topo no meio)
    return { x, y };
  });
}

function Dente({ n, marcado, gengivaMarcada, aoTocar, tamanho, x, y }) {
  return (
    <button type="button" className={'dente' + (marcado ? ' marcado' : '') + (aoTocar ? '' : ' leitura')}
      style={{ left: `${x}%`, top: `${y}%`, width: tamanho, height: tamanho * 1.12 }}
      onClick={aoTocar} aria-label={`Dente ${n}`}>
      <svg viewBox="0 0 20 22" width="100%" height="100%">
        <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z"
          fill={marcado ? '#2F7D4E' : '#FFFFFF'} stroke={marcado ? '#1E6B41' : '#B9C6BB'} strokeWidth="1.3" />
        {gengivaMarcada && (
          <path d="M3.7 4.6 C6.6 2.1 13.4 2.1 16.3 4.6 C16.8 5.6 16.5 6.6 15.8 6.8 C13 4.9 7 4.9 4.2 6.8 C3.5 6.6 3.2 5.6 3.7 4.6 Z"
            fill="#E2578A" stroke="#B23A66" strokeWidth="0.5" />
        )}
        <text x="10" y="10.4" textAnchor="middle" fontSize="6.8" fontWeight="800"
          fill={marcado ? '#FFFFFF' : '#55645A'}>{n}</text>
      </svg>
    </button>
  );
}

// marcados: dentes (números FDI); gengiva: regiões de gengiva marcadas (pelo
// número do dente mais próximo, capinha rosa); aoAlternar ausente = só leitura
export function Arcada({ marcados = [], gengiva = [], aoAlternar, compacta }) {
  const tamanho = compacta ? 26 : 34;
  const arco = (dentes, paraBaixo) => {
    const pos = posicoes(paraBaixo);
    return (
      <div className={'arcada' + (compacta ? ' compacta' : '')}>
        {dentes.map((n, i) => (
          <Dente key={n} n={n} tamanho={tamanho} x={pos[i].x} y={pos[i].y}
            marcado={marcados.includes(n)} gengivaMarcada={gengiva.includes(n)}
            aoTocar={aoAlternar ? () => aoAlternar(n) : undefined} />
        ))}
      </div>
    );
  };
  return (
    <div className="arcada-caixa">
      {arco(DENTES_SUPERIOR, false)}
      <div className="arcada-divisor"><i /><span>ARCO SUPERIOR · ARCO INFERIOR</span><i /></div>
      {arco(DENTES_INFERIOR, true)}
    </div>
  );
}
