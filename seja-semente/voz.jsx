// ═══════════════════════════════════════════════════════════════════════════
//  A VOZ DA LIGAÇÃO
//
//  Quando alguém chama, os dois lados se FALAM. Antes o celular só tocava e
//  a pessoa tinha que ir atrás; agora dá para dizer "estou na sala 2, sobe
//  aqui" sem largar o paciente.
//
//  Também é o que sustenta a tela cheia de ligação no iPhone: a Apple só
//  permite aquele recurso para chamada de voz de verdade.
//
//  COMO FUNCIONA, em português:
//  - Cada pessoa na ligação escreve um "recado" no banco dizendo como falar
//    com ela (endereço, formato de áudio). Isso é o `sinais`.
//  - A outra ponta lê esse recado, responde com o dela, e daí em diante a
//    voz vai DIRETO de um celular para o outro — não passa pelo banco.
//  - Numa chamada de grupo, cada um se liga com cada um: todo mundo ouve
//    todo mundo. Por isso o grupo é limitado a 6 pessoas falando ao mesmo
//    tempo — acima disso o celular não dá conta.
//
//  Se o microfone falhar (a pessoa negou, o aparelho não deixa), a chamada
//  NÃO morre: a tela continua tocando e o botão de atender continua ali,
//  como sempre foi. A voz é um ganho, nunca um bloqueio.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';

const MAX_NA_LIGACAO = 6;

// Servidores públicos que ajudam dois celulares a se acharem na internet
const SERVIDORES = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// O par de nomes que identifica um caminho de recado entre duas pessoas
const trilha = (de, para) => `${de}__${para}`;

export function useVoz({ fb, chamadaId, meuUid, meuNome, ligado }) {
  const [participantes, setParticipantes] = useState([]);
  const [mudo, setMudo] = useState(false);
  const [estado, setEstado] = useState('parado'); // parado | pedindo | ligado | sem-microfone
  const meuAudio = useRef(null);
  const ligacoes = useRef(new Map());   // uid → RTCPeerConnection
  const caixas = useRef(new Map());     // uid → <audio> tocando a voz daquela pessoa
  const limpezas = useRef([]);

  // Liga e desliga o próprio microfone
  function alternarMudo() {
    const novo = !mudo;
    setMudo(novo);
    for (const faixa of meuAudio.current?.getAudioTracks?.() || []) faixa.enabled = !novo;
  }

  useEffect(() => {
    if (!ligado || !fb || !chamadaId || !meuUid) return;
    let vivo = true;
    const { collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, addDoc, getDocs, query } = fb.fns;
    const salaRef = collection(fb.db, 'chamadas', chamadaId, 'participantes');
    const sinaisRef = collection(fb.db, 'chamadas', chamadaId, 'sinais');

    // Toca a voz que chega de uma pessoa
    function caixaDe(uid) {
      if (caixas.current.has(uid)) return caixas.current.get(uid);
      const el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      document.body.appendChild(el);
      caixas.current.set(uid, el);
      return el;
    }

    // Monta a conversa com UMA pessoa
    function conversaCom(outroUid, euComeco) {
      if (ligacoes.current.has(outroUid)) return ligacoes.current.get(outroUid);
      const pc = new RTCPeerConnection({ iceServers: SERVIDORES });
      ligacoes.current.set(outroUid, pc);

      for (const faixa of meuAudio.current?.getTracks?.() || []) pc.addTrack(faixa, meuAudio.current);
      pc.ontrack = (e) => { caixaDe(outroUid).srcObject = e.streams[0]; };

      const meuCaminho = doc(sinaisRef, trilha(meuUid, outroUid));
      const meusPedacos = collection(meuCaminho, 'pedacos');
      pc.onicecandidate = (e) => {
        if (e.candidate) addDoc(meusPedacos, e.candidate.toJSON()).catch(() => {});
      };

      (async () => {
        try {
          if (euComeco) {
            const oferta = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(oferta);
            setDoc(meuCaminho, { tipo: 'oferta', sdp: oferta.sdp, de: meuUid, para: outroUid, em: serverTimestamp() }).catch(() => {});
          }
        } catch (e) { /* a outra ponta tenta */ }
      })();

      // Escuta o que a outra pessoa manda para mim
      const caminhoDela = doc(sinaisRef, trilha(outroUid, meuUid));
      const paraRecado = onSnapshot(caminhoDela, async (snap) => {
        const d = snap.data();
        if (!d || !vivo) return;
        try {
          if (d.tipo === 'oferta' && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
            const resposta = await pc.createAnswer();
            await pc.setLocalDescription(resposta);
            setDoc(meuCaminho, { tipo: 'resposta', sdp: resposta.sdp, de: meuUid, para: outroUid, em: serverTimestamp() }).catch(() => {});
          } else if (d.tipo === 'resposta' && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp });
          }
        } catch (e) { /* recado fora de ordem: a outra ponta repete */ }
      });

      const paraPedacos = onSnapshot(collection(caminhoDela, 'pedacos'), (snap) => {
        for (const mudanca of snap.docChanges()) {
          if (mudanca.type !== 'added') continue;
          pc.addIceCandidate(new RTCIceCandidate(mudanca.doc.data())).catch(() => {});
        }
      });

      limpezas.current.push(paraRecado, paraPedacos);
      return pc;
    }

    (async () => {
      setEstado('pedindo');
      // 1. O microfone
      try {
        meuAudio.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch (e) {
        // Sem microfone a chamada continua valendo — só não tem voz
        if (vivo) setEstado('sem-microfone');
        meuAudio.current = null;
      }
      if (!vivo) return;

      // 2. Entro na sala
      const euNaSala = doc(salaRef, meuUid);
      setDoc(euNaSala, { nome: meuNome || '', entrouEm: serverTimestamp() }).catch(() => {});
      if (meuAudio.current) setEstado('ligado');

      // 3. Acompanho quem está na sala e converso com cada um.
      //    Quem chega DEPOIS é que começa a conversa — assim os dois lados
      //    não falam ao mesmo tempo e se atrapalham.
      const paraSala = onSnapshot(salaRef, (snap) => {
        if (!vivo) return;
        const gente = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setParticipantes(gente);
        const outros = gente.filter(p => p.uid !== meuUid).slice(0, MAX_NA_LIGACAO - 1);
        for (const p of outros) {
          if (!ligacoes.current.has(p.uid)) conversaCom(p.uid, meuUid > p.uid);
        }
        // Quem saiu, para de tocar
        for (const [uid, pc] of ligacoes.current) {
          if (gente.some(p => p.uid === uid)) continue;
          try { pc.close(); } catch (e) { /* já fechada */ }
          ligacoes.current.delete(uid);
          const el = caixas.current.get(uid);
          if (el) { el.srcObject = null; el.remove(); caixas.current.delete(uid); }
        }
      });
      limpezas.current.push(paraSala);
    })();

    return () => {
      vivo = false;
      for (const parar of limpezas.current) { try { parar(); } catch (e) { /* nada */ } }
      limpezas.current = [];
      for (const [, pc] of ligacoes.current) { try { pc.close(); } catch (e) { /* nada */ } }
      ligacoes.current.clear();
      for (const [, el] of caixas.current) { try { el.srcObject = null; el.remove(); } catch (e) { /* nada */ } }
      caixas.current.clear();
      for (const faixa of meuAudio.current?.getTracks?.() || []) { try { faixa.stop(); } catch (e) { /* nada */ } }
      meuAudio.current = null;
      // Saio da sala e levo meus recados comigo
      try {
        deleteDoc(doc(collection(fb.db, 'chamadas', chamadaId, 'participantes'), meuUid)).catch(() => {});
        getDocs(query(collection(fb.db, 'chamadas', chamadaId, 'sinais')))
          .then(s => { for (const d of s.docs) if (d.id.startsWith(meuUid + '__')) deleteDoc(d.ref).catch(() => {}); })
          .catch(() => {});
      } catch (e) { /* nada */ }
      setEstado('parado');
      setParticipantes([]);
    };
  }, [ligado, chamadaId, meuUid]);

  return { participantes, mudo, alternarMudo, estado, cheia: participantes.length >= MAX_NA_LIGACAO };
}

// ─── Os botões que aparecem durante a ligação, iguais nos dois lados ───
export function ControlesDaVoz({ voz, aoDesligar, rotuloDesligar = 'Desligar' }) {
  const semVoz = voz.estado === 'sem-microfone';
  return (
    <div className="voz-controles">
      {semVoz ? (
        <p className="voz-aviso">🔇 Sem microfone neste aparelho — a chamada continua valendo, mas sem voz.</p>
      ) : (
        <p className="voz-aviso">
          {voz.estado === 'pedindo' ? 'Ligando o microfone…'
            : voz.participantes.length > 1
              ? `🔊 Falando com ${voz.participantes.length - 1} pessoa${voz.participantes.length > 2 ? 's' : ''}`
              : '🔊 Esperando alguém atender…'}
        </p>
      )}
      <div className="voz-botoes">
        {!semVoz && (
          <button className={voz.mudo ? 'voz-botao mudo' : 'voz-botao'} onClick={voz.alternarMudo}>
            {voz.mudo ? '🔇 Sem som' : '🎙 Microfone'}
          </button>
        )}
        <button className="voz-botao desligar" onClick={aoDesligar}>📴 {rotuloDesligar}</button>
      </div>
      {voz.cheia && <p className="voz-aviso">A ligação está cheia ({MAX_NA_LIGACAO} pessoas). Quem entrar agora ouve quando alguém sair.</p>}
    </div>
  );
}
