// ═══════════════════════════════════════════════════════════════════════════
//  PASTA DA PRÓTESE — o cantinho exclusivo da prótese
//
//  Só abre para quem está LIBERADO para Prótese na central (procedimentos do
//  voluntário). O dentista da prótese vê os pacientes de Prótese e AGENDA ele
//  mesmo o dia e o horário na própria agenda — sem passar pela central.
//  Na central a pasta mostra o panorama: pacientes, quem está liberado e as
//  próximas próteses marcadas.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Bolha } from './logo.jsx';
import { AgendaSemana } from './agenda-semana.jsx';

function dataBonitaISO(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-');
  return `${d}/${m}`;
}

// bloqueada=true → tela de cadeado (dentista sem Prótese nos procedimentos)
export function TelaProtese({ usuario, pacientes, agendamentos, voluntarios = [], duracao = 60, bloqueada, central, aoVoltar, aoAbrirFicha, aoAgendar, corDaArea, duracaoDe }) {
  const [agendando, setAgendando] = useState(null); // paciente escolhido
  const [escolha, setEscolha] = useState(null);     // { data, hora }

  if (bloqueada) return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>🦷 Pasta da Prótese</h2>
      <div className="cartao protese-trava">
        <span className="protese-cadeado">🔒</span>
        <strong>Esta pasta é só do time da Prótese</strong>
        <p className="dica" style={{ margin: 0 }}>Ela abre para os dentistas com <b>Prótese</b> marcada nos procedimentos, lá na central Seja Semente. Se você faz prótese, peça para a coordenação marcar no seu perfil de voluntário — aí ela destrava sozinha. 🌱</p>
      </div>
    </div>
  );

  const daProtese = pacientes.filter(p => {
    const t = p?.triagem;
    const areas = Array.isArray(t?.areas) ? t.areas : (t?.area ? [t.area] : (t?.procedimento ? [t.procedimento] : []));
    return areas.includes('Prótese');
  });
  const agsProtese = agendamentos.filter(g => g.area === 'Prótese');
  const agendamentoDe = p => agsProtese.find(g => g.pacienteId === p.id);
  const proximas = [...agsProtese].sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  const liberados = voluntarios.filter(v => (v.procedimentos || []).includes('Prótese'));

  // ── Escolhendo dia e horário na agenda do próprio dentista ──
  if (agendando) return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => { setAgendando(null); setEscolha(null); }}><ChevronLeft size={18} /> Voltar</button>
      <h2>Agendar prótese</h2>
      <p className="dica" style={{ marginTop: 0 }}>Paciente: <strong>{agendando.nome}</strong> · na SUA agenda, {usuario.nome?.split(' ')[0]}. Toque no dia e depois no horário livre.</p>
      <AgendaSemana agendamentos={agendamentos.filter(g => g.profissionalUid === usuario.uid)}
        corDaArea={corDaArea} duracaoDe={duracaoDe}
        aoEscolherHorario={(data, hora) => setEscolha({ data, hora })}
        previa={escolha ? { data: escolha.data, hora: escolha.hora, duracaoMin: duracao, titulo: `Prótese — ${agendando.nome}`, area: 'Prótese' } : null} />
      {escolha && (
        <div className="cartao" style={{ marginTop: 8 }}>
          <strong>📌 Vai ficar:</strong> {dataBonitaISO(escolha.data)} às {escolha.hora} · Prótese · {duracao} min
          <div className="linha-botoes" style={{ marginTop: 8 }}>
            <button className="btn-secundario" onClick={() => setEscolha(null)}>Trocar</button>
            <button className="btn-principal" onClick={async () => {
              await aoAgendar(agendando, escolha.data, escolha.hora);
              setAgendando(null); setEscolha(null);
            }}>Confirmar agendamento</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>🦷 Pasta da Prótese</h2>
      <p className="dica" style={{ marginTop: 0 }}>
        {central
          ? 'O panorama da prótese: pacientes, agenda e o time liberado.'
          : 'Seus pacientes de prótese — agende o retorno direto na sua agenda.'}
      </p>

      {central && (
        <div className="cartao">
          <strong style={{ display: 'block', marginBottom: 4 }}>Time liberado para Prótese</strong>
          {liberados.length
            ? liberados.map(v => <p key={v.id} className="obs" style={{ margin: '2px 0' }}>🦷 {v.nome}</p>)
            : <p className="obs" style={{ margin: 0 }}>Ninguém liberado ainda — marque Prótese nos procedimentos do voluntário.</p>}
        </div>
      )}

      <h3 style={{ margin: '6px 0 2px', fontSize: 17 }}>Pacientes de Prótese ({daProtese.length})</h3>
      {daProtese.length ? daProtese.map(p => {
        const g = agendamentoDe(p);
        return (
          <div className="cartao" key={p.id}>
            <div className="cartao-linha" style={{ alignItems: 'center' }}>
              <button className="bolha-btn" onClick={() => aoAbrirFicha?.(p.id)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>
                <Bolha nome={p.nome} foto={p.foto} />
              </button>
              <div style={{ flex: 1 }}>
                <strong>{p.nome}</strong>
                <p className="obs" style={{ margin: 0 }}>
                  {g ? <>📅 {dataBonitaISO(g.data)} às {g.hora} · com {(g.profissionalNome || '').split(' ')[0]}</> : 'sem agendamento de prótese'}
                </p>
              </div>
              {g
                ? <span className="chip concluído">agendado</span>
                : aoAgendar
                  ? <button className="btn-triagem" onClick={() => { setAgendando(p); setEscolha(null); }}>Agendar</button>
                  : <span className="chip aguardando">a agendar</span>}
            </div>
          </div>
        );
      }) : <div className="vazio">Nenhum paciente com Prótese na triagem ainda.</div>}

      {proximas.length > 0 && (
        <div className="cartao" style={{ marginTop: 6 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>📅 Próximas próteses</strong>
          {proximas.map(g => (
            <p key={g.id} className="obs" style={{ margin: '3px 0' }}>
              {dataBonitaISO(g.data)} às {g.hora} — <b>{g.pacienteNome}</b>{g.profissionalNome ? ` · ${g.profissionalNome.split(' ')[0]}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
