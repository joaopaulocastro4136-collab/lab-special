// ═══════════════════════════════════════════════════════════════════════════
//  LUDO DOS DENTES 🦷🎲 — o jogo online da equipe Seja Semente
//
//  Fica na caixinha "Jogos" do Perfil (central e Semeador). Qualquer pessoa
//  logada cria uma sala ou entra numa sala aberta (até 4 jogadores); o estado
//  da partida vive no Firestore (coleção `jogos-ludo`) e todo mundo vê os
//  lances em tempo real. As peças são DENTINHOS nas cores da marca e o centro
//  do tabuleiro leva o selo Seja Semente.
//
//  Regras (Ludo clássico, simplificado):
//   · 6 no dado tira dentinho da base — e dá direito a jogar de novo
//   · cair em casa com dentinho adversário (fora das casas seguras ⚕)
//     manda ele de volta pra base
//   · vence quem levar os 4 dentinhos até o centro primeiro
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Bolha } from './logo.jsx';

// ─── As 4 cadeiras (cores da marca): TL verde, TR amarelo, BR azul, BL coral ───
export const CORES_LUDO = [
  { nome: 'Verde', cor: '#2F7D4E', claro: '#DFF0E4', escuro: '#1E6B41' },
  { nome: 'Amarelo', cor: '#F0A912', claro: '#FCEFD2', escuro: '#C4880C' },
  { nome: 'Azul', cor: '#29A0CE', claro: '#DDF1F8', escuro: '#1B7EA6' },
  { nome: 'Coral', cor: '#E24B26', claro: '#FBE3DA', escuro: '#B93A1B' },
];

// Trilha principal do tabuleiro 15×15 (52 casas, sentido horário)
const TRILHA = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
];
const SAIDAS = [0, 13, 26, 39];                       // casa de saída de cada cadeira
const SEGURAS = [0, 8, 13, 21, 26, 34, 39, 47];       // casas onde ninguém é capturado
const RETAS_FINAIS = [                                // as 5 casas coloridas até o centro
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];
const BASES = [[0, 0], [9, 0], [9, 9], [0, 9]];       // canto (em células) de cada base
const CHEGADAS = [[262, 300], [300, 262], [338, 300], [300, 338]]; // px no centro
const C = 40; // tamanho da célula em px (15 × 40 = 600)

// Posição da peça: -1 base · 0..50 trilha · 51..55 reta final · 56 chegou
const CHEGOU = 56;

function celulaDaPeca(cadeira, pos) {
  if (pos <= 50) { const [x, y] = TRILHA[(SAIDAS[cadeira] + pos) % 52]; return [x * C + C / 2, y * C + C / 2]; }
  if (pos < CHEGOU) { const [x, y] = RETAS_FINAIS[cadeira][pos - 51]; return [x * C + C / 2, y * C + C / 2]; }
  return CHEGADAS[cadeira];
}

// ─── Estado da partida (mesmo formato no Firestore e no modo demonstração) ───
function jogadorDe(u, cadeira) {
  return { uid: u.uid, nome: u.nome || 'Sem nome', avatar: u.avatar || '', fotoMini: u.fotoMini || '', cadeira };
}
export function novaSalaLudo(usuario) {
  return {
    status: 'aguardando', criadorUid: usuario.uid, criadorNome: usuario.nome || '',
    jogadores: [jogadorDe(usuario, 0)], pecas: { [usuario.uid]: [-1, -1, -1, -1] },
    vez: 0, dado: null, vencedorNome: '', vencedorUid: '',
  };
}

function podeMover(pos, valor) {
  if (pos === CHEGOU) return false;
  if (pos === -1) return valor === 6;
  return pos + valor <= CHEGOU;
}
function jogadasDe(estado, uid) {
  const valor = estado.dado?.valor;
  if (!valor) return [];
  const minhas = estado.pecas[uid] || [];
  return minhas.map((p, i) => podeMover(p, valor) ? i : -1).filter(i => i >= 0);
}

// Aplica o movimento da peça `i` do jogador da vez e devolve o novo estado
function moverPeca(estado, uid, i) {
  const valor = estado.dado?.valor;
  const jog = estado.jogadores.find(j => j.uid === uid);
  if (!valor || !jog) return estado;
  const pecas = { ...estado.pecas, [uid]: [...(estado.pecas[uid] || [])] };
  const antiga = pecas[uid][i];
  const nova = antiga === -1 ? 0 : antiga + valor;
  pecas[uid][i] = nova;

  // Captura: caiu numa casa da trilha, não-segura, com dentinho adversário
  let comeu = false;
  if (nova <= 50) {
    const abs = (SAIDAS[jog.cadeira] + nova) % 52;
    if (!SEGURAS.includes(abs)) {
      for (const outro of estado.jogadores) {
        if (outro.uid === uid) continue;
        pecas[outro.uid] = (pecas[outro.uid] || []).map(p =>
          (p >= 0 && p <= 50 && (SAIDAS[outro.cadeira] + p) % 52 === abs) ? (comeu = true, -1) : p);
      }
    }
  }

  const venceu = pecas[uid].every(p => p === CHEGOU);
  const joga_denovo = valor === 6 || comeu || nova === CHEGOU;
  return {
    ...estado, pecas, dado: null,
    vez: venceu || joga_denovo ? estado.vez : (estado.vez + 1) % estado.jogadores.length,
    status: venceu ? 'encerrado' : estado.status,
    vencedorNome: venceu ? jog.nome : estado.vencedorNome,
    vencedorUid: venceu ? jog.uid : estado.vencedorUid,
  };
}

// ─── Peça: um DENTINHO na cor do jogador (mesmo desenho do odontograma) ───
function DentePeca({ x, y, cor, escuro, destacado, aoTocar }) {
  return (
    <g transform={`translate(${x - 16}, ${y - 19}) scale(1.6)`} onClick={aoTocar}
      style={aoTocar ? { cursor: 'pointer' } : undefined} className={destacado ? 'ludo-peca-vai' : undefined}>
      {destacado && <circle cx="10" cy="11" r="12" className="ludo-brilho" />}
      <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z"
        fill={cor} stroke={escuro} strokeWidth="1.4" />
      <ellipse cx="7.6" cy="6.4" rx="1.7" ry="2.3" fill="#FFFFFF" opacity="0.5" />
    </g>
  );
}

// Dentinho pequeno cinza que marca as casas seguras (o "amuleto" do tabuleiro)
function DenteSeguro({ x, y }) {
  return (
    <g transform={`translate(${x - 8}, ${y - 9}) scale(0.8)`} opacity="0.5">
      <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z"
        fill="none" stroke="#8FA396" strokeWidth="1.6" />
    </g>
  );
}

function DadoFace({ valor, tamanho = 44 }) {
  const P = { 1: [[24, 24]], 2: [[13, 13], [35, 35]], 3: [[13, 13], [24, 24], [35, 35]], 4: [[13, 13], [35, 13], [13, 35], [35, 35]], 5: [[13, 13], [35, 13], [24, 24], [13, 35], [35, 35]], 6: [[13, 12], [35, 12], [13, 24], [35, 24], [13, 36], [35, 36]] };
  return (
    <svg viewBox="0 0 48 48" width={tamanho} height={tamanho}>
      <rect x="2" y="2" width="44" height="44" rx="10" fill="#FFFFFF" stroke="#2F7D4E" strokeWidth="2.5" />
      {(P[valor] || []).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.4" fill="#2F7D4E" />)}
    </svg>
  );
}

// ─── O tabuleiro completo em SVG ───
function Tabuleiro({ estado, meuUid, minhaVez, aoTocarPeca }) {
  const jogaveis = minhaVez ? jogadasDe(estado, meuUid) : [];
  return (
    <svg viewBox="0 0 600 600" className="ludo-tabuleiro">
      <rect x="0" y="0" width="600" height="600" rx="22" fill="#FFFFFF" stroke="#CBD8CD" strokeWidth="2" />

      {/* As 4 bases coloridas nos cantos, com 4 vaguinhas cada */}
      {BASES.map(([bx, by], cad) => {
        const T = CORES_LUDO[cad];
        return (
          <g key={cad}>
            <rect x={bx * C} y={by * C} width={6 * C} height={6 * C} rx="20" fill={T.cor} />
            <rect x={bx * C + 34} y={by * C + 34} width={6 * C - 68} height={6 * C - 68} rx="16" fill="#FFFFFF" />
            {[[85, 85], [155, 85], [85, 155], [155, 155]].map(([dx, dy], k) => (
              <circle key={k} cx={bx * C + dx} cy={by * C + dy} r="27" fill={T.claro} stroke={T.cor} strokeWidth="2" />
            ))}
          </g>
        );
      })}

      {/* Trilha (52 casas) — saída na cor do jogador, casas seguras com dentinho */}
      {TRILHA.map(([x, y], i) => {
        const saidaDe = SAIDAS.indexOf(i);
        return (
          <g key={i}>
            <rect x={x * C} y={y * C} width={C} height={C}
              fill={saidaDe >= 0 ? CORES_LUDO[saidaDe].cor : '#FFFFFF'} stroke="#D5DFD6" strokeWidth="1.4" />
            {saidaDe < 0 && SEGURAS.includes(i) && <DenteSeguro x={x * C + C / 2} y={y * C + C / 2} />}
          </g>
        );
      })}

      {/* Retas finais coloridas até o centro */}
      {RETAS_FINAIS.map((casas, cad) => casas.map(([x, y], k) => (
        <rect key={cad + '-' + k} x={x * C} y={y * C} width={C} height={C}
          fill={CORES_LUDO[cad].claro} stroke={CORES_LUDO[cad].cor} strokeWidth="1.6" />
      )))}

      {/* Centro: os 4 triângulos + o selo Seja Semente */}
      <g>
        <polygon points="240,240 300,300 240,360" fill={CORES_LUDO[0].cor} />
        <polygon points="240,240 360,240 300,300" fill={CORES_LUDO[1].cor} />
        <polygon points="360,240 360,360 300,300" fill={CORES_LUDO[2].cor} />
        <polygon points="240,360 300,300 360,360" fill={CORES_LUDO[3].cor} />
        <circle cx="300" cy="300" r="50" fill="#FFFFFF" stroke="#2F7D4E" strokeWidth="3" />
        <g transform="translate(281, 260) scale(1.95)">
          <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z"
            fill="#2F7D4E" stroke="#1E6B41" strokeWidth="1" />
          <ellipse cx="7.6" cy="6.4" rx="1.7" ry="2.3" fill="#FFFFFF" opacity="0.55" />
        </g>
        <text x="300" y="328" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#2F7D4E">Seja Semente</text>
      </g>

      {/* Os dentinhos de todo mundo (base → trilha → reta final → centro) */}
      {estado.jogadores.map(j => {
        const T = CORES_LUDO[j.cadeira];
        const [bx, by] = BASES[j.cadeira];
        const vagas = [[85, 85], [155, 85], [85, 155], [155, 155]];
        // Peças na mesma casa ficam levemente afastadas para dar de ver todas
        const naCasa = {};
        return (estado.pecas[j.uid] || []).map((pos, i) => {
          const minha = j.uid === meuUid;
          const jogavel = minha && jogaveis.includes(i);
          let x, y;
          if (pos === -1) { [x, y] = [bx * C + vagas[i][0], by * C + vagas[i][1]]; }
          else {
            [x, y] = celulaDaPeca(j.cadeira, pos);
            const chave = x + ',' + y;
            const k = naCasa[chave] = (naCasa[chave] || 0) + 1;
            x += (k - 1) * 8; y -= (k - 1) * 5;
          }
          return <DentePeca key={j.uid + '-' + i} x={x} y={y} cor={T.cor} escuro={T.escuro}
            destacado={jogavel} aoTocar={jogavel ? () => aoTocarPeca(i) : undefined} />;
        });
      })}
    </svg>
  );
}

// ─── A mesa: jogadores, dado e tabuleiro (funciona online e na demonstração) ───
function MesaLudo({ estado, meuUid, aoAtualizar, aoSair, aoJogarDeNovo, rotulo }) {
  const n = estado.jogadores.length;
  const daVez = estado.jogadores[estado.vez % Math.max(n, 1)];
  const minhaVez = estado.status === 'jogando' && daVez?.uid === meuUid;
  const jogaveis = minhaVez ? jogadasDe(estado, meuUid) : [];
  const semJogada = minhaVez && estado.dado && !jogaveis.length;

  // Rolou e não tem jogada? A vez passa sozinha depois de mostrar o dado
  useEffect(() => {
    if (!semJogada) return;
    const t = setTimeout(() => aoAtualizar({ ...estado, dado: null, vez: (estado.vez + 1) % n }), 1600);
    return () => clearTimeout(t);
  }, [estado]); // eslint-disable-line

  function rolar() {
    if (!minhaVez || estado.dado) return;
    aoAtualizar({ ...estado, dado: { valor: 1 + Math.floor(Math.random() * 6), uid: meuUid } });
  }
  function tocarPeca(i) {
    if (!minhaVez || !estado.dado) return;
    aoAtualizar(moverPeca(estado, meuUid, i));
  }

  return (
    <div className="folha ludo-mesa">
      <button className="btn-voltar" onClick={aoSair}><ChevronLeft size={18} /> Voltar</button>
      <h2 style={{ marginBottom: 2 }}>🦷 Ludo dos Dentes</h2>
      {rotulo && <p className="dica" style={{ margin: '0 0 8px' }}>{rotulo}</p>}

      <div className="ludo-jogadores">
        {estado.jogadores.map(j => {
          const T = CORES_LUDO[j.cadeira];
          const emCasa = (estado.pecas[j.uid] || []).filter(p => p === CHEGOU).length;
          return (
            <div key={j.uid} className={'ludo-jog' + (estado.status === 'jogando' && daVez?.uid === j.uid ? ' vez' : '')}
              style={{ borderColor: T.cor, background: T.claro }}>
              <Bolha nome={j.nome} foto={j.fotoMini} avatar={j.avatar} />
              <span className="ludo-jog-nome">{j.uid === meuUid ? 'Você' : (j.nome || '').split(' ')[0]}</span>
              <span className="ludo-jog-pts" style={{ color: T.escuro }}>🦷 {emCasa}/4</span>
            </div>
          );
        })}
      </div>

      {estado.status === 'encerrado' ? (
        <div className="ludo-banner">
          🏆 <strong>{estado.vencedorUid === meuUid ? 'Você venceu!' : `${estado.vencedorNome} venceu!`}</strong>
          {aoJogarDeNovo && <button className="btn-principal" style={{ maxWidth: 'none', marginTop: 8 }} onClick={aoJogarDeNovo}>Jogar de novo</button>}
        </div>
      ) : (
        <div className="ludo-controle">
          {estado.dado
            ? <button className="ludo-dado" disabled><DadoFace valor={estado.dado.valor} /></button>
            : <button className={'ludo-dado' + (minhaVez ? ' pulsa' : '')} onClick={rolar} disabled={!minhaVez}>🎲</button>}
          <div className="ludo-fala">
            {minhaVez
              ? (semJogada ? 'Nenhuma jogada possível — passando a vez…'
                : estado.dado ? (jogaveis.length ? `Deu ${estado.dado.valor}! Toque num dentinho brilhando para mover.` : '…')
                : 'Sua vez! Toque no dado para jogar. 🎲')
              : `Vez de ${(daVez?.nome || '').split(' ')[0]}…`}
            {!estado.dado && minhaVez && <span className="obs" style={{ display: 'block' }}>Tirou 6? Sai da base e joga de novo!</span>}
          </div>
        </div>
      )}

      <Tabuleiro estado={estado} meuUid={meuUid} minhaVez={minhaVez && !!estado.dado} aoTocarPeca={tocarPeca} />
      <p className="dica" style={{ marginTop: 8 }}>Casas com dentinho cinza são seguras — ali ninguém é capturado. 🛡</p>
    </div>
  );
}

// ─── Modo online: salas no Firestore, todo mundo logado pode jogar ───
function LudoOnline({ usuario, fb, aoVoltar }) {
  const [salas, setSalas] = useState([]);
  const [salaId, setSalaId] = useState(null);
  const [sala, setSala] = useState(null);

  useEffect(() => {
    const { collection, query, orderBy, limit, onSnapshot } = fb.fns;
    return onSnapshot(query(collection(fb.db, 'jogos-ludo'), orderBy('criadoEm', 'desc'), limit(15)),
      snap => setSalas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  useEffect(() => {
    if (!salaId) { setSala(null); return; }
    const { doc, onSnapshot } = fb.fns;
    return onSnapshot(doc(fb.db, 'jogos-ludo', salaId), snap => setSala(snap.exists() ? { id: snap.id, ...snap.data() } : null));
  }, [salaId]);

  async function criarSala() {
    const { collection, addDoc, serverTimestamp } = fb.fns;
    const ref = await addDoc(collection(fb.db, 'jogos-ludo'), { ...novaSalaLudo(usuario), criadoEm: serverTimestamp() }).catch(() => null);
    if (ref) setSalaId(ref.id);
  }
  function gravar(s, campos) {
    const { doc, updateDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'jogos-ludo', s.id), { ...campos, atualizadoEm: serverTimestamp() }).catch(() => {});
  }
  function entrarSala(s) {
    if (s.jogadores.some(j => j.uid === usuario.uid)) { setSalaId(s.id); return; }
    if (s.status !== 'aguardando' || s.jogadores.length >= 4) { setSalaId(s.id); return; } // só assistir
    gravar(s, {
      jogadores: [...s.jogadores, jogadorDe(usuario, s.jogadores.length)],
      pecas: { ...s.pecas, [usuario.uid]: [-1, -1, -1, -1] },
    });
    setSalaId(s.id);
  }
  function atualizar(novo) {
    gravar(sala, { jogadores: novo.jogadores, pecas: novo.pecas, vez: novo.vez, dado: novo.dado, status: novo.status, vencedorNome: novo.vencedorNome, vencedorUid: novo.vencedorUid });
  }
  function jogarDeNovo() {
    const pecas = {}; sala.jogadores.forEach(j => { pecas[j.uid] = [-1, -1, -1, -1]; });
    gravar(sala, { pecas, vez: 0, dado: null, status: 'jogando', vencedorNome: '', vencedorUid: '' });
  }

  if (sala) {
    const souJogador = sala.jogadores.some(j => j.uid === usuario.uid);
    if (sala.status === 'aguardando') {
      return (
        <div className="folha ludo-mesa">
          <button className="btn-voltar" onClick={() => setSalaId(null)}><ChevronLeft size={18} /> Voltar</button>
          <h2>🦷 Ludo dos Dentes</h2>
          <div className="cartao">
            <strong>Sala de {sala.criadorNome.split(' ')[0]}</strong>
            <p className="dica" style={{ margin: '4px 0 10px' }}>Esperando a equipe… ({sala.jogadores.length}/4). Quando estiver todo mundo, é só começar!</p>
            <div className="ludo-jogadores" style={{ marginBottom: 10 }}>
              {sala.jogadores.map(j => (
                <div key={j.uid} className="ludo-jog" style={{ borderColor: CORES_LUDO[j.cadeira].cor, background: CORES_LUDO[j.cadeira].claro }}>
                  <Bolha nome={j.nome} foto={j.fotoMini} avatar={j.avatar} />
                  <span className="ludo-jog-nome">{j.uid === usuario.uid ? 'Você' : (j.nome || '').split(' ')[0]}</span>
                </div>
              ))}
            </div>
            {souJogador && sala.jogadores.length >= 2 && (
              <button className="btn-principal" style={{ maxWidth: 'none' }} onClick={() => gravar(sala, { status: 'jogando' })}>▶ Começar o jogo</button>
            )}
            {souJogador && sala.jogadores.length < 2 && <p className="obs">Precisa de pelo menos 2 jogadores. Avisa a equipe no chat! 💬</p>}
          </div>
        </div>
      );
    }
    return <MesaLudo estado={sala} meuUid={souJogador ? usuario.uid : '(assistindo)'}
      aoAtualizar={atualizar} aoSair={() => setSalaId(null)}
      aoJogarDeNovo={souJogador ? jogarDeNovo : null}
      rotulo={souJogador ? null : 'Você está assistindo a esta partida 👀'} />;
  }

  const abertas = salas.filter(s => s.status !== 'encerrado');
  return (
    <div className="folha ludo-mesa">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>🦷 Ludo dos Dentes</h2>
      <p className="dica">Jogo online da equipe — crie uma sala e chame os colegas, ou entre numa sala aberta. Até 4 jogadores por partida.</p>
      <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 12 }} onClick={criarSala}>+ Criar sala</button>
      {abertas.length ? abertas.map(s => (
        <button key={s.id} className="cartao sala-cartao" onClick={() => entrarSala(s)}>
          <div className="cartao-linha" style={{ alignItems: 'center' }}>
            <Bolha nome={s.criadorNome} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <strong>Sala de {(s.criadorNome || '').split(' ')[0]}</strong>
              <p className="obs" style={{ margin: 0 }}>{s.jogadores.map(j => (j.nome || '').split(' ')[0]).join(' · ')}</p>
            </div>
            <span className={'chip ' + (s.status === 'aguardando' ? 'aguardando' : 'em-atendimento')}>
              {s.status === 'aguardando' ? `${s.jogadores.length}/4 · entrar` : 'jogando'}
            </span>
          </div>
        </button>
      )) : <div className="vazio">Nenhuma sala aberta agora — crie a primeira! 🎲</div>}
    </div>
  );
}

// ─── Modo demonstração (sem Firebase): passa-e-joga no mesmo aparelho ───
function LudoDemo({ usuario, aoVoltar }) {
  const [estado, setEstado] = useState(() => {
    const s = novaSalaLudo(usuario);
    const convidado = { uid: 'demo-convidado', nome: 'Convidado' };
    return { ...s, status: 'jogando', jogadores: [...s.jogadores, jogadorDe(convidado, 1)], pecas: { ...s.pecas, 'demo-convidado': [-1, -1, -1, -1] } };
  });
  const daVez = estado.jogadores[estado.vez % estado.jogadores.length];
  function jogarDeNovo() {
    const pecas = {}; estado.jogadores.forEach(j => { pecas[j.uid] = [-1, -1, -1, -1]; });
    setEstado({ ...estado, pecas, vez: 0, dado: null, status: 'jogando', vencedorNome: '', vencedorUid: '' });
  }
  // Sem internet configurada dá para treinar: os dois jogadores no mesmo aparelho
  return <MesaLudo estado={estado} meuUid={daVez.uid} aoAtualizar={setEstado} aoSair={aoVoltar}
    aoJogarDeNovo={jogarDeNovo} rotulo="Modo demonstração: passa-e-joga no mesmo aparelho" />;
}

// ─── A caixinha de Jogos do Perfil ───
export function TelaJogos({ usuario, fb, aoVoltar }) {
  const [jogo, setJogo] = useState(null);
  if (jogo === 'ludo') return fb
    ? <LudoOnline usuario={usuario} fb={fb} aoVoltar={() => setJogo(null)} />
    : <LudoDemo usuario={usuario} aoVoltar={() => setJogo(null)} />;
  return (
    <div className="folha ludo-mesa">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>🎮 Jogos</h2>
      <p className="dica">Um cantinho de descanso para a equipe entre um paciente e outro. 🌱</p>
      <button className="cartao jogo-cartao" onClick={() => setJogo('ludo')}>
        <span className="jogo-icone">
          <svg viewBox="0 0 60 60" width="52" height="52">
            <rect x="1" y="1" width="58" height="58" rx="10" fill="#FFFFFF" stroke="#CBD8CD" strokeWidth="2" />
            <rect x="4" y="4" width="20" height="20" rx="6" fill="#2F7D4E" />
            <rect x="36" y="4" width="20" height="20" rx="6" fill="#F0A912" />
            <rect x="36" y="36" width="20" height="20" rx="6" fill="#29A0CE" />
            <rect x="4" y="36" width="20" height="20" rx="6" fill="#E24B26" />
            <g transform="translate(21.5, 20.5) scale(0.9)">
              <path d="M6.6 2.8 C3.9 2.8 2.6 5.2 3 8.2 C3.5 11.6 4.8 19.8 6.8 19.8 C8.9 19.8 7.9 13.9 10 13.9 C12.1 13.9 11.1 19.8 13.2 19.8 C15.2 19.8 16.5 11.6 17 8.2 C17.4 5.2 16.1 2.8 13.4 2.8 C12.2 3.6 7.8 3.6 6.6 2.8 Z"
                fill="#FFFFFF" stroke="#2F7D4E" strokeWidth="1.6" />
            </g>
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>
          <strong>Ludo dos Dentes</strong>
          <p className="obs" style={{ margin: 0 }}>Jogo online da equipe — até 4 jogadores 🦷🎲</p>
        </span>
      </button>
    </div>
  );
}
