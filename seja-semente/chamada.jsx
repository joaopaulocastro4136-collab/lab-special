// Chamada de paciente — quando alguém da equipe "chama" um paciente, TODOS
// os celulares logados (central e Semeador) recebem uma tela cheia estilo
// ligação: nome e foto do paciente pulsando, toque de chamada e vibração
// (a vibração só funciona em Android — o iPhone não deixa sites vibrarem;
// lá fica a tela pulsando + som). A tela só sai quando a pessoa toca.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, BellRing } from 'lucide-react';
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
  // Chamada de STAFF: quem aparece grande é quem está chamando — a tela só
  // toca nos aparelhos da pessoa escolhida (paraUid), não na equipe toda
  const ehStaff = chamada.tipo === 'staff';
  return (
    <div className="chamada-tela" role="alertdialog" aria-label={ehStaff ? 'Chamada da equipe' : 'Chamada de paciente'}>
      <p className="chamada-rotulo">{ehStaff ? '📣 Chamando você' : '📣 Chamando paciente'}</p>
      <div className="chamada-pulso">
        <i /><i /><i />
        <Bolha nome={(ehStaff ? chamada.chamadoPorNome : chamada.pacienteNome) || '?'} foto={ehStaff ? chamada.chamadoPorFoto : chamada.pacienteFoto} />
      </div>
      <h1>{ehStaff ? chamada.chamadoPorNome : chamada.pacienteNome}</h1>
      {!ehStaff && chamada.pacienteCodigo && <p className="chamada-cod">{chamada.pacienteCodigo}</p>}
      <p className="chamada-quem">{ehStaff
        ? `está chamando você${chamada.paraNome ? `, ${String(chamada.paraNome).split(' ')[0]}` : ''} — vá até lá`
        : `chamado por ${chamada.chamadoPorNome || 'alguém da equipe'}`}</p>
      <button className="chamada-atender" onClick={() => aoAtender(chamada)}>
        {ehStaff ? '✅ Estou indo' : '✅ OK, estou levando'}
      </button>
    </div>
  );
}

// Escolher alguém da equipe para chamar: lista todo mundo que tem conta no
// Seja Semente (central + Semeador); o sino cria a chamada que toca só nos
// aparelhos daquela pessoa, com a mesma tela de ligação
export function TelaChamarStaff({ pessoas, aoChamar, aoVoltar }) {
  const [busca, setBusca] = useState('');
  const [chamados, setChamados] = useState([]);
  const filtro = busca.trim().toLowerCase();
  const lista = pessoas.filter(p => !filtro || (p.nome || '').toLowerCase().includes(filtro));
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>Chamar alguém da equipe</h2>
      <p className="dica" style={{ marginTop: 0 }}>Toque no sino: os celulares da pessoa tocam na hora, como uma ligação, até ela responder "Estou indo".</p>
      <input className="busca" placeholder="Pesquisar pelo nome…" value={busca} onChange={e => setBusca(e.target.value)} />
      {lista.length ? lista.map(p => (
        <div className="cartao" key={p.uid}>
          <div className="cartao-linha" style={{ alignItems: 'center' }}>
            <Bolha nome={p.nome} foto={p.foto} avatar={p.avatar} />
            <div style={{ flex: 1 }}>
              <strong>{p.nome}</strong>
              {p.detalhe && <p className="obs" style={{ margin: 0 }}>{p.detalhe}</p>}
            </div>
            {chamados.includes(p.uid)
              ? <span className="chip em-atendimento">📞 chamando…</span>
              : <button className="btn-chamar" title={'Chamar ' + p.nome} onClick={() => { aoChamar(p); setChamados(c => [...c, p.uid]); }}><BellRing size={16} strokeWidth={2.4} /></button>}
          </div>
        </div>
      )) : <p className="dica">Ninguém encontrado com esse nome.</p>}
    </div>
  );
}
