// Agenda da semana — grade de dias × horários, como agenda de clínica.
// Compartilhada: o Semeador mostra a agenda do dentista; a central usa na
// tela de agendar com três poderes a mais (todos opcionais):
//   aoEscolherHorario(dia, hora) — tocar num quadradinho escolhe dia E hora
//   previa                       — bloco tracejado mostrando onde vai cair
//   aoMoverAgendamento(g, d, h)  — segurar e ARRASTAR um paciente muda ele
//                                  de horário/dia (só a central move)
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ALTURA_MEIA_HORA = 28;   // altura em px de cada linha de 30 minutos
const LARGURA_DIA = 118;       // largura em px da coluna de cada dia
const LARGURA_HORAS = 50;      // largura da coluna das horas

function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function minutosDe(hora) {
  const [h, m] = String(hora || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function hm(total) {
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function horaFim(hora, dur) {
  return hm(minutosDe(hora) + (dur || 30));
}

export function AgendaSemana({ agendamentos, corDaArea, duracaoDe, aoAbrirFicha, aoEscolherDia, diaEscolhido, aoEscolherHorario, previa, aoMoverAgendamento, diasDeAcao = [] }) {
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

  // ─── Arrastar e soltar: segurar um paciente e levar para outro lugar ───
  const corpoRef = useRef(null);
  const arrastoRef = useRef(null);
  const [arrasto, setArrasto] = useState(null); // {id, g, x0, y0, dx, dy, mexeu}
  const soltouAgoraRef = useRef(false); // engole o clique que vem depois do arrasto
  const setArr = a => { arrastoRef.current = a; setArrasto(a); };
  const arrastavel = !!aoMoverAgendamento;

  function pontoParaDiaHora(cx, cy) {
    const r = corpoRef.current.getBoundingClientRect();
    const idx = Math.max(0, Math.min(6, Math.floor((cx - r.left - LARGURA_HORAS) / LARGURA_DIA)));
    const linha = Math.max(0, Math.min(linhas.length - 1, Math.floor((cy - r.top) / ALTURA_MEIA_HORA)));
    return { iso: dias[idx], hora: hm(min + linha * 30) };
  }

  const escolherTocando = (iso, e, alvo) => {
    if (soltouAgoraRef.current) { soltouAgoraRef.current = false; return; }
    if (aoEscolherHorario) {
      const r = alvo.getBoundingClientRect();
      const linha = Math.max(0, Math.min(linhas.length - 1, Math.floor((e.clientY - r.top) / ALTURA_MEIA_HORA)));
      aoEscolherHorario(iso, hm(min + linha * 30));
      return;
    }
    aoEscolherDia?.(iso);
  };

  const classeDia = (iso, base) => [
    base,
    iso === hoje ? 'hoje' : '',
    diasDeAcao.includes(iso) ? 'de-acao' : '',
    (aoEscolherDia || aoEscolherHorario) && iso === diaEscolhido ? 'escolhido' : '',
    (aoEscolherDia || aoEscolherHorario) ? 'clicavel' : '',
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
                <div key={iso} className={classeDia(iso, 'sem-dia')} onClick={() => { if (!soltouAgoraRef.current) (aoEscolherDia || aoEscolherHorario) && (aoEscolherDia ? aoEscolherDia(iso) : aoEscolherHorario(iso, previa?.hora || '08:00')); else soltouAgoraRef.current = false; }}>
                  <strong>{DIAS_LONGOS[i]}, <b className={iso === hoje ? 'num-hoje' : ''}>{Number(iso.slice(8))}</b></strong>
                  <span>Pacientes: {daSemana.filter(g => g.data === iso).length}</span>
                </div>
              ))}
            </div>
            <div className="semana-corpo" ref={corpoRef} style={{ height: linhas.length * ALTURA_MEIA_HORA }}>
              <div className="sem-horas">
                {linhas.map(m => <div key={m} className="sem-hora">{Math.floor(m / 60)}:{String(m % 60).padStart(2, '0')}</div>)}
              </div>
              {dias.map(iso => {
                const { blocos, faixas } = blocosDoDia(iso);
                return (
                  <div key={iso} className={classeDia(iso, 'sem-col')} onClick={e => escolherTocando(iso, e, e.currentTarget)}>
                    {blocos.map(({ g, i, f, faixa }) => {
                      const altura = Math.max((f - i) / 30 * ALTURA_MEIA_HORA - 3, 20);
                      const curto = altura < 40; // atendimento de 30 min: tudo numa linha só
                      const arrastando = arrasto?.id === g.id && arrasto.mexeu;
                      return (
                        <button type="button" key={g.id}
                          className={(curto ? 'sem-bloco curto' : 'sem-bloco') + (arrastavel ? ' arrastavel' : '')}
                          style={{
                            top: topoDe(i) + 1,
                            height: altura,
                            left: `calc(${(faixa / faixas) * 100}% + 2px)`,
                            width: `calc(${100 / faixas}% - 5px)`,
                            background: corDaArea(g.area || g.titulo),
                            ...(arrastando ? { transform: `translate(${arrasto.dx}px, ${arrasto.dy}px)`, zIndex: 30, opacity: 0.88, boxShadow: '0 12px 26px rgba(20,30,24,0.4)' } : {}),
                          }}
                          onPointerDown={arrastavel ? (e => { e.currentTarget.setPointerCapture(e.pointerId); setArr({ id: g.id, g, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, mexeu: false }); }) : undefined}
                          onPointerMove={arrastavel ? (e => {
                            const a = arrastoRef.current;
                            if (!a || a.id !== g.id) return;
                            const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
                            setArr({ ...a, dx, dy, mexeu: a.mexeu || Math.hypot(dx, dy) > 8 });
                          }) : undefined}
                          onPointerUp={arrastavel ? (e => {
                            const a = arrastoRef.current;
                            setArr(null);
                            if (a && a.id === g.id && a.mexeu) {
                              soltouAgoraRef.current = true;
                              const destino = pontoParaDiaHora(e.clientX, e.clientY);
                              aoMoverAgendamento(a.g, destino.iso, destino.hora);
                            }
                          }) : undefined}
                          onPointerCancel={arrastavel ? (() => setArr(null)) : undefined}
                          onClick={e => {
                            if (soltouAgoraRef.current) { soltouAgoraRef.current = false; e.stopPropagation(); return; }
                            if (aoEscolherHorario) { e.stopPropagation(); aoEscolherHorario(iso, g.hora); return; }
                            if (aoEscolherDia) { e.stopPropagation(); aoEscolherDia(iso); return; }
                            if (g.pacienteId) aoAbrirFicha?.(g.pacienteId);
                          }}>
                          {curto
                            ? <strong>{g.pacienteNome || g.titulo}, {g.hora}</strong>
                            : <><strong>{g.pacienteNome || g.titulo}</strong><span>{g.hora} - {horaFim(g.hora, dur(g))}</span></>}
                        </button>
                      );
                    })}
                    {previa && previa.data === iso && (() => {
                      const i = minutosDe(previa.hora);
                      const altura = Math.max((previa.duracaoMin || 30) / 30 * ALTURA_MEIA_HORA - 3, 20);
                      return (
                        <div className="sem-bloco previa" style={{ top: topoDe(i) + 1, height: altura, left: 2, right: 3 }}>
                          <strong>{previa.titulo || 'Novo'}</strong>
                          <span>{previa.hora}</span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              {mostraAgora && <div className="agora-linha" style={{ top: topoDe(agoraMin) }} />}
            </div>
          </div>
        </div>
      </div>
      {!aoEscolherDia && !aoEscolherHorario && <p className="dica" style={{ marginTop: 10 }}>Toque no atendimento para abrir a ficha do paciente. Arraste para os lados para ver a semana inteira.</p>}
    </>
  );
}
