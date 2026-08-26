// Chamada de paciente — quando alguém da equipe "chama" um paciente, TODOS
// os celulares logados (central e Semeador) recebem uma tela cheia estilo
// ligação: nome e foto do paciente pulsando, toque de chamada e vibração
// (a vibração só funciona em Android — o iPhone não deixa sites vibrarem;
// lá fica a tela pulsando + som). A tela só sai quando a pessoa toca.
import { useEffect, useRef, useState } from 'react';
import { useVoz, ControlesDaVoz } from './voz.jsx';
import { ChevronLeft, BellRing } from 'lucide-react';
import { Bolha } from './logo.jsx';

// Toque de chamada: campainha insistente estilo telefone — feito na hora
// com o WebAudio (sem arquivo de som). Cada nota soa em duas oitavas ao
// mesmo tempo e no volume máximo que o WebAudio permite; o volume final é
// o dos botões laterais do celular. Se o navegador bloquear, segue sem som.
function tocarBipe(ctx) {
  try {
    const agora = ctx.currentTime;
    // "trim-trim": duas rajadas de 3 notas, como campainha de telefone fixo
    for (const [t, freq] of [[0, 740], [0.14, 988], [0.28, 740], [0.55, 740], [0.69, 988], [0.83, 740]]) {
      for (const mult of [1, 2]) {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = mult === 1 ? 'square' : 'sine';
        osc.frequency.value = freq * mult;
        vol.gain.setValueAtTime(0.0001, agora + t);
        vol.gain.exponentialRampToValueAtTime(mult === 1 ? 0.55 : 0.85, agora + t + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, agora + t + 0.13);
        osc.connect(vol).connect(ctx.destination);
        osc.start(agora + t);
        osc.stop(agora + t + 0.16);
      }
    }
  } catch (e) { /* sem som */ }
}

export function TelaChamada({ chamada, aoAtender, fb, usuario }) {
  const audioRef = useRef(null);
  // Depois de atender, a tela vira a LIGAÇÃO em si: o microfone abre e a
  // pessoa fala com quem chamou, sem precisar largar o que está fazendo.
  const [atendida, setAtendida] = useState(false);
  const voz = useVoz({
    fb, chamadaId: chamada?.id, meuUid: usuario?.uid, meuNome: usuario?.nome,
    ligado: atendida && !!fb && !!chamada?.id,
  });

  useEffect(() => { setAtendida(false); }, [chamada?.id]);

  useEffect(() => {
    // Vibra e toca sem parar enquanto a chamada estiver na tela
    if (atendida) return;   // atendeu: para de tocar, começa a falar
    let ctx = null;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch (e) {}
    audioRef.current = ctx;
    const vibra = () => { try { navigator.vibrate?.([500, 250, 500]); } catch (e) {} };
    const toca = () => { if (ctx && ctx.state === 'running') tocarBipe(ctx); };
    vibra(); toca();
    const t = setInterval(() => { vibra(); toca(); }, 1400);
    return () => { clearInterval(t); try { navigator.vibrate?.(0); } catch (e) {} try { ctx?.close(); } catch (e) {} };
  }, [chamada?.id, atendida]);

  if (!chamada) return null;
  // Chamada de STAFF: quem aparece grande é quem está chamando — a tela só
  // toca nos aparelhos da pessoa escolhida (paraUid), não na equipe toda.
  // Com "motivo" (chamada de grupo), o título vem grande: "Almoço na cantina"
  const ehStaff = chamada.tipo === 'staff';
  return (
    <div className="chamada-tela" role="alertdialog" aria-label={ehStaff ? 'Chamada da equipe' : 'Chamada de paciente'}>
      <p className="chamada-rotulo">{ehStaff ? '📣 Chamando você' : '📣 Chamando paciente'}</p>
      <div className="chamada-pulso">
        <i /><i /><i />
        <Bolha nome={(ehStaff ? chamada.chamadoPorNome : chamada.pacienteNome) || '?'} foto={ehStaff ? chamada.chamadoPorFoto : chamada.pacienteFoto} />
      </div>
      <h1>{ehStaff ? (chamada.motivo || chamada.chamadoPorNome) : chamada.pacienteNome}</h1>
      {!ehStaff && chamada.pacienteCodigo && <p className="chamada-cod">{chamada.pacienteCodigo}</p>}
      <p className="chamada-quem">{ehStaff
        ? (chamada.motivo
          ? `${chamada.chamadoPorNome || 'A equipe'} está chamando você${chamada.paraNome ? `, ${String(chamada.paraNome).split(' ')[0]}` : ''}`
          : `está chamando você${chamada.paraNome ? `, ${String(chamada.paraNome).split(' ')[0]}` : ''} — vá até lá`)
        : `chamado por ${chamada.chamadoPorNome || 'alguém da equipe'}`}</p>
      {atendida ? (
        <ControlesDaVoz voz={voz} rotuloDesligar="Encerrar" aoDesligar={() => aoAtender(chamada)} />
      ) : (
        <button className="chamada-atender" onClick={() => { setAtendida(true); aoAtender(chamada, true); }}>
          {ehStaff ? '✅ Atender' : '✅ Atender e ir buscar'}
        </button>
      )}
    </div>
  );
}

// ─── A tela de quem CHAMOU: fica na ligação esperando atenderem ───
export function TelaChamando({ chamada, fb, usuario, aoDesligar }) {
  const voz = useVoz({
    fb, chamadaId: chamada?.id, meuUid: usuario?.uid, meuNome: usuario?.nome,
    ligado: !!fb && !!chamada?.id,
  });
  if (!chamada) return null;
  const outros = voz.participantes.filter(p => p.uid !== usuario?.uid);
  const titulo = chamada.motivo || chamada.paraNome || chamada.pacienteNome || 'Chamando';
  return (
    <div className="chamada-tela" role="alertdialog" aria-label="Ligação em andamento">
      <p className="chamada-rotulo">📞 Você está chamando</p>
      <div className="chamada-pulso">
        <i /><i /><i />
        <Bolha nome={titulo} foto={chamada.pacienteFoto || ''} />
      </div>
      <h1>{titulo}</h1>
      <p className="chamada-quem">
        {outros.length
          ? `${outros.map(p => String(p.nome || '').split(' ')[0]).join(', ')} ${outros.length > 1 ? 'entraram' : 'entrou'} na ligação`
          : 'Tocando… assim que atenderem, vocês se falam.'}
      </p>
      <ControlesDaVoz voz={voz} rotuloDesligar="Encerrar" aoDesligar={aoDesligar} />
    </div>
  );
}

// ─── Chamada de GRUPO (convocação): a central cria uma chamada com título
// ("Almoço na cantina"), escolhe as pessoas e o celular de cada uma toca
// como ligação com o título na tela. Quem já foi chamado fica marcado ───
export function TelaConvocacoes({ convocacoes, aoCriar, aoAbrir, aoExcluir, aoVoltar }) {
  const [titulo, setTitulo] = useState('');
  const criar = () => { if (titulo.trim()) { aoCriar(titulo.trim()); setTitulo(''); } };
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>Chamadas de grupo</h2>
      <p className="dica" style={{ marginTop: 0 }}>Crie uma chamada (ex.: "Almoço na cantina"), escolha as pessoas, e o celular delas toca como ligação com o título na tela.</p>
      <div className="cartao" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ flex: 1, minWidth: 0 }} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Chamar para quê? Ex.: Almoço na cantina" onKeyDown={e => e.key === 'Enter' && criar()} />
        <button className="btn-mais" disabled={!titulo.trim()} onClick={criar}>Criar</button>
      </div>
      {convocacoes.length ? convocacoes.map(c => (
        <div className="cartao" key={c.id} onClick={() => aoAbrir(c)} style={{ cursor: 'pointer' }}>
          <div className="cartao-topo">
            <strong>📣 {c.titulo}</strong>
            <button className="btn-remover" title="Excluir" onClick={(e) => { e.stopPropagation(); aoExcluir(c); }}>✕</button>
          </div>
          <p className="obs" style={{ margin: 0 }}>{Object.keys(c.chamados || {}).length} pessoa(s) chamada(s) · toque para abrir e chamar</p>
        </div>
      )) : <p className="dica">Nenhuma chamada de grupo criada ainda.</p>}
    </div>
  );
}

export function TelaConvocacao({ convocacao, pessoas, aoChamar, aoExcluir, aoVoltar }) {
  const [marcados, setMarcados] = useState([]);
  const chamados = convocacao.chamados || {};
  const pendentes = pessoas.filter(p => !chamados[p.uid]);
  const alterna = (uid) => setMarcados(m => (m.includes(uid) ? m.filter(x => x !== uid) : [...m, uid]));
  const chamar = () => { aoChamar(pendentes.filter(p => marcados.includes(p.uid))); setMarcados([]); };
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>📣 {convocacao.titulo}</h2>
      <p className="dica" style={{ marginTop: 0 }}>Marque as pessoas e toque em chamar — o celular de cada uma toca como ligação, com "{convocacao.titulo}" na tela e o botão "Estou indo".</p>
      <h3 style={{ margin: '12px 0 8px' }}>Ainda não chamados</h3>
      {pendentes.length ? pendentes.map(p => (
        <label key={p.uid} className={marcados.includes(p.uid) ? 'caixa marcada' : 'caixa'} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, width: '100%' }}>
          <input type="checkbox" checked={marcados.includes(p.uid)} onChange={() => alterna(p.uid)} />
          <Bolha nome={p.nome} foto={p.foto} avatar={p.avatar} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{p.nome}</strong>
            {p.detalhe && <span className="obs" style={{ display: 'block' }}>{p.detalhe}</span>}
          </span>
        </label>
      )) : <p className="dica">Todo mundo já foi chamado 🎉</p>}
      {pendentes.length > 0 && (
        <button className="btn-principal" style={{ maxWidth: 'none', marginTop: 6 }} disabled={!marcados.length} onClick={chamar}>
          🔔 Chamar marcados{marcados.length ? ` (${marcados.length})` : ''}
        </button>
      )}
      {Object.keys(chamados).length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Já chamados</h3>
          {Object.entries(chamados).map(([uid, c]) => (
            <div className="cartao" key={uid}>
              <div className="cartao-linha" style={{ alignItems: 'center' }}>
                <Bolha nome={c.nome} />
                <strong style={{ flex: 1 }}>{c.nome}</strong>
                <span className="chip em-atendimento">✓ chamado</span>
              </div>
            </div>
          ))}
        </>
      )}
      <button className="btn-sair" style={{ width: '100%' }} onClick={aoExcluir}>🗑 Excluir esta chamada de grupo</button>
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
