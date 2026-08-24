// Agenda da semana — grade de dias × horários, como agenda de clínica.
// Compartilhada: o Semeador mostra a agenda do dentista, e a central usa na
// tela de agendar (com aoEscolherDia, tocar num dia escolhe a DATA — dá para
// ver os horários de cada dentista e onde encaixa a vaga).
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ALTURA_MEIA_HORA = 28;   // altura em px de cada linha de 30 minutos
const LARGURA_DIA = 118;       // largura em px da coluna de cada dia

function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function minutosDe(hora) {
  const [h, m] = String(hora || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function horaFim(hora, dur) {
  const total = minutosDe(hora) + (dur || 30);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function AgendaSemana({ agendamentos, corDaArea, duracaoDe, aoAbrirFicha, aoEscolherDia, diaEscolhido }) {
  const hoje = dataISO();
  const domingo = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return dataISO(d); };
  const [inicio, setInicio] = useState(domingo);

  // Linha vermelha do "agora": acompanha o relógio, minuto a minuto
  const [agora, setAgora] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60 * 1000); return () => clearInterval(t); }, []);

  const soma = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return dataISO(new Date(a, m - 1, d + n)); };
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => soma(inicio, i));
  const daSemana = agendamentos.filter(g => dias.includes(g.data));
  const dur = g => g.duracaoMin || duracaoDe(g.area || g.titulo);

  // Faixa de horários: das 6h da manhã até a meia-noite, para dar para
  // agendar em qualquer horário do dia (estica se houver atendimento antes)
  let min = 6 * 60, max = 24 * 60;
  for (const g of daSemana) {
    const i = minutosDe(g.hora);
    min = Math.min(min, Math.floor(i / 30) * 30);
    max = Math.max(max, Math.ceil((i + dur(g)) / 30) * 30);
  }
  const linhas = [];
  for (let m = min; m < max; m += 30) linhas.push(m);
  const topoDe = m => (m - min) / 30 * ALTURA_MEIA_HORA;

  const [, m1, d1] = dias[0].split('-').map(Number);
  const [a2, m2, d2] = dias[6].split('-').map(Number);
  const titulo = m1 === m2
    ? `De ${d1} a ${d2} de ${MESES[m1 - 1]} de ${a2}`
    : `De ${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]} de ${a2}`;

  // Quando dois atendimentos do mesmo dia se cruzam, ficam lado a lado
  function blocosDoDia(iso) {
    const doDia = daSemana.filter(g => g.data === iso).sort((x, y) => minutosDe(x.hora) - minutosDe(y.hora));
    const fimDasFaixas = [];
    const blocos = doDia.map(g => {
      const i = minutosDe(g.hora), f = i + dur(g);
      let faixa = fimDasFaixas.findIndex(fim => fim <= i);
      if (faixa === -1) { faixa = fimDasFaixas.length; fimDasFaixas.push(f); } else fimDasFaixas[faixa] = f;
      return { g, i, f, faixa };
    });
    return { blocos, faixas: Math.max(1, fimDasFaixas.length) };
  }

  // Ao abrir (e ao trocar de semana), deixa o dia de hoje à vista — e desce
  // até o primeiro atendimento da semana (ou 8h), para a grade não abrir
  // mostrando só as horas vazias da madrugada
  const rolagem = useRef(null);
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const idx = dias.indexOf(hoje);
    el.scrollLeft = idx > 0 ? idx * LARGURA_DIA - 34 : 0;
    const primeiro = Math.min(8 * 60, ...daSemana.map(g => minutosDe(g.hora)));
    el.scrollTop = Math.max(0, topoDe(primeiro) - 4);
  }, [inicio]);

  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const mostraAgora = dias.includes(hoje) && agoraMin >= min && agoraMin <= max;

  const classeDia = (iso, base) => [
    base,
    iso === hoje ? 'hoje' : '',
    aoEscolherDia && iso === diaEscolhido ? 'escolhido' : '',
    aoEscolherDia ? 'clicavel' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className="semana-nav">
        <button type="button" className="seta" onClick={() => setInicio(soma(inicio, -7))} aria-label="Semana anterior"><ChevronLeft size={19} /></button>
        <button type="button" className="btn-hoje" onClick={() => setInicio(domingo())}>Hoje</button>
        <button type="button" className="seta" onClick={() => setInicio(soma(inicio, 7))} aria-label="Próxima semana"><ChevronRight size={19} /></button>
        <span className="semana-titulo">{titulo}</span>
      </div>
      <div className="semana-cartao">
        <div className="semana-rolagem" ref={rolagem}>
          <div className="semana-grade">
            <div className="semana-cabecalho">
              <div className="sem-canto" />
              {dias.map((iso, i) => (
                <div key={iso} className={classeDia(iso, 'sem-dia')} onClick={() => aoEscolherDia?.(iso)}>
                  <strong>{DIAS_LONGOS[i]}, <b className={iso === hoje ? 'num-hoje' : ''}>{Number(iso.slice(8))}</b></strong>
                  <span>Pacientes: {daSemana.filter(g => g.data === iso).length}</span>
                </div>
              ))}
            </div>
            <div className="semana-corpo" style={{ height: linhas.length * ALTURA_MEIA_HORA }}>
              <div className="sem-horas">
                {linhas.map(m => <div key={m} className="sem-hora">{Math.floor(m / 60)}:{String(m % 60).padStart(2, '0')}</div>)}
              </div>
              {dias.map(iso => {
                const { blocos, faixas } = blocosDoDia(iso);
                return (
                  <div key={iso} className={classeDia(iso, 'sem-col')} onClick={() => aoEscolherDia?.(iso)}>
                    {blocos.map(({ g, i, f, faixa }) => {
                      const altura = Math.max((f - i) / 30 * ALTURA_MEIA_HORA - 3, 20);
                      const curto = altura < 40; // atendimento de 30 min: tudo numa linha só
                      return (
                        <button type="button" key={g.id} className={curto ? 'sem-bloco curto' : 'sem-bloco'} style={{
                          top: topoDe(i) + 1,
                          height: altura,
                          left: `calc(${(faixa / faixas) * 100}% + 2px)`,
                          width: `calc(${100 / faixas}% - 5px)`,
                          background: corDaArea(g.area || g.titulo),
                        }} onClick={e => {
                          if (aoEscolherDia) { e.stopPropagation(); aoEscolherDia(iso); return; }
                          if (g.pacienteId) aoAbrirFicha?.(g.pacienteId);
                        }}>
                          {curto
                            ? <strong>{g.pacienteNome || g.titulo}, {g.hora}</strong>
                            : <><strong>{g.pacienteNome || g.titulo}</strong><span>{g.hora} - {horaFim(g.hora, dur(g))}</span></>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {mostraAgora && <div className="agora-linha" style={{ top: topoDe(agoraMin) }} />}
            </div>
          </div>
        </div>
      </div>
      {!aoEscolherDia && <p className="dica" style={{ marginTop: 10 }}>Toque no atendimento para abrir a ficha do paciente. Arraste para os lados para ver a semana inteira.</p>}
    </>
  );
}
