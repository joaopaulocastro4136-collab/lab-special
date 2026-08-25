// Chamada de paciente — quando alguém da equipe "chama" um paciente, TODOS
// os celulares logados (central e Semeador) recebem uma tela cheia estilo
// ligação: nome e foto do paciente pulsando, toque de chamada e vibração
// (a vibração só funciona em Android — o iPhone não deixa sites vibrarem;
// lá fica a tela pulsando + som). A tela só sai quando a pessoa toca.
import { useEffect, useRef } from 'react';
import { Bolha } from './logo.jsx';

// Toque de chamada: dois bipes subindo, repetindo — feito na hora com o
// WebAudio (sem arquivo de som). Se o navegador bloquear, segue sem som.
function tocarBipe(ctx) {
  try {
    const agora = ctx.currentTime;
    for (const [t, freq] of [[0, 740], [0.22, 988]]) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, agora + t);
      vol.gain.exponentialRampToValueAtTime(0.35, agora + t + 0.03);
      vol.gain.exponentialRampToValueAtTime(0.0001, agora + t + 0.20);
      osc.connect(vol).connect(ctx.destination);
      osc.start(agora + t);
      osc.stop(agora + t + 0.25);
    }
  } catch (e) { /* sem som */ }
}

export function TelaChamada({ chamada, aoAtender }) {
  const audioRef = useRef(null);

  useEffect(() => {
    // Vibra e toca sem parar enquanto a chamada estiver na tela
    let ctx = null;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch (e) {}
    audioRef.current = ctx;
    const vibra = () => { try { navigator.vibrate?.([500, 250, 500]); } catch (e) {} };
    const toca = () => { if (ctx && ctx.state === 'running') tocarBipe(ctx); };
    vibra(); toca();
    const t = setInterval(() => { vibra(); toca(); }, 1600);
    return () => { clearInterval(t); try { navigator.vibrate?.(0); } catch (e) {} try { ctx?.close(); } catch (e) {} };
  }, [chamada?.id]);

  if (!chamada) return null;
  return (
    <div className="chamada-tela" role="alertdialog" aria-label="Chamada de paciente">
      <p className="chamada-rotulo">📣 Chamando paciente</p>
      <div className="chamada-pulso">
        <i /><i /><i />
        <Bolha nome={chamada.pacienteNome || '?'} foto={chamada.pacienteFoto} />
      </div>
      <h1>{chamada.pacienteNome}</h1>
      {chamada.pacienteCodigo && <p className="chamada-cod">{chamada.pacienteCodigo}</p>}
      <p className="chamada-quem">chamado por {chamada.chamadoPorNome || 'alguém da equipe'}</p>
      <button className="chamada-atender" onClick={() => aoAtender(chamada)}>
        ✅ OK, estou levando
      </button>
    </div>
  );
}
