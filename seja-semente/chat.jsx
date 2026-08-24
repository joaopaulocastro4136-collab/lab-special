// Chat da equipe — compartilhado entre a central Seja Semente e o Semeador.
// Todo mundo conversa no mesmo lugar (coleção `chat` do Firestore, em tempo
// real). A caixa de escrever é livre: manda texto e emoji do jeito que
// quiser, e o botão ➕ guarda os anexos para quando precisar — uma FOTO
// avulsa, um PACIENTE (para falar dele), uma PESSOA marcada (@fulana) e uma
// SUGESTÃO de procedimento — quem receber toca em "Aceitar" e o paciente já
// entra contando naquele procedimento no sistema, sem cadastro novo.
import { useState, useEffect, useRef } from 'react';
import { Bolha } from './logo.jsx';
import { comprimirImagem } from './ficha.jsx';
import { Send, Check, X, ClipboardList, AtSign, Camera, Plus, Smile } from 'lucide-react';

const EMOJIS = ['😀', '😂', '😍', '🙏', '👍', '👏', '🎉', '❤️', '😢', '😮', '💪', '🦷', '🌱', '✅', '⚠️', '📅'];

function quandoBonito(v) {
  const d = v?.toDate ? v.toDate() : v instanceof Date ? v : null;
  if (!d) return 'agora';
  const hoje = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === hoje.toDateString() ? hm : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
}

export function Chat({ usuario, mensagens, pacientes, pessoas, areas, aoEnviar, aoAceitar, aoAbrirPaciente }) {
  const [texto, setTexto] = useState('');
  const [pacienteId, setPacienteId] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [areaSug, setAreaSug] = useState('');
  const [foto, setFoto] = useState('');
  const [verAnexos, setVerAnexos] = useState(false);
  const [verEmojis, setVerEmojis] = useState(false);
  const [vendoFoto, setVendoFoto] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [mensagens.length]);

  const paciente = pacientes.find(p => p.id === pacienteId) || null;
  const pessoa = pessoas.find(p => p.id === pessoaId) || null;

  async function escolherFoto(e) {
    setErro('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await comprimirImagem(file);
      if (dataUrl.length > 800000) dataUrl = await comprimirImagem(file, 0.5, 800);
      if (dataUrl.length > 800000) { setErro('A foto ficou grande demais — tente outra.'); return; }
      setFoto(dataUrl);
    } catch (e2) { setErro('Não consegui ler essa imagem.'); }
  }

  async function enviar() {
    if (!texto.trim() && !paciente && !foto) return;
    setEnviando(true);
    await aoEnviar({
      texto: texto.trim(),
      foto: foto || '',
      pacienteId: paciente?.id || '', pacienteNome: paciente?.nome || '', pacienteCodigo: paciente?.codigo || '',
      paraUid: pessoa?.id || '', paraNome: pessoa?.nome || '',
      sugestaoArea: paciente ? areaSug : '',
    });
    setTexto(''); setPacienteId(''); setPessoaId(''); setAreaSug(''); setFoto('');
    setVerAnexos(false); setVerEmojis(false);
    setEnviando(false);
  }

  return (
    <div className="chat">
      <div className="chat-mensagens">
        {mensagens.length === 0 && <div className="vazio">Nenhuma mensagem ainda — puxe a conversa! 🌱</div>}
        {mensagens.map(m => (
          <div key={m.id} className={'msg' + (m.autorUid === usuario.uid ? ' minha' : '')}>
            <Bolha nome={m.autorNome || '?'} />
            <div className="msg-corpo">
              <div className="msg-topo">
                <strong>{m.autorUid === usuario.uid ? 'Você' : m.autorNome}</strong>
                <span className="quando">{quandoBonito(m.criadoEm)}</span>
              </div>
              {m.paraNome && (
                <span className={'chip-mencao' + (m.paraUid && m.paraUid === usuario.uid ? ' pra-mim' : '')}>
                  <AtSign size={12} strokeWidth={2.6} /> {m.paraUid === usuario.uid ? 'para você' : m.paraNome}
                </span>
              )}
              {m.foto && (
                <button className="msg-foto" onClick={() => setVendoFoto(m.foto)} aria-label="Ver foto">
                  <img src={m.foto} alt="foto enviada" />
                </button>
              )}
              {m.texto && <p>{m.texto}</p>}
              {m.pacienteNome && (
                <button className="chip-paciente" onClick={() => m.pacienteId && aoAbrirPaciente?.(m.pacienteId)}>
                  <ClipboardList size={13} strokeWidth={2.4} /> {m.pacienteCodigo ? `${m.pacienteCodigo} · ` : ''}{m.pacienteNome}
                </button>
              )}
              {m.sugestaoArea && (m.aceitoPorNome ? (
                <span className="chip-aceito"><Check size={13} strokeWidth={3} /> {m.sugestaoArea} — aceito por {m.aceitoPorNome}{m.agendaDia ? ` · agendado ${m.agendaDia} às ${m.agendaHora}` : ''}</span>
              ) : (
                <div className="linha-sugestao">
                  <span>Incluir em <b>{m.sugestaoArea}</b>?</span>
                  <button className="btn-aceitar-chat" onClick={() => aoAceitar(m)}><Check size={14} strokeWidth={3} /> Aceitar</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      <div className="chat-caixa">
        {(paciente || pessoa || areaSug || foto) && (
          <div className="chat-selecionados">
            {foto && <span className="chip-paciente foto-presa"><img src={foto} alt="foto escolhida" /> foto <X size={12} onClick={() => setFoto('')} /></span>}
            {paciente && <span className="chip-paciente">{paciente.codigo ? `${paciente.codigo} · ` : ''}{paciente.nome} <X size={12} onClick={() => { setPacienteId(''); setAreaSug(''); }} /></span>}
            {pessoa && <span className="chip-mencao"><AtSign size={12} /> {pessoa.nome} <X size={12} onClick={() => setPessoaId('')} /></span>}
            {areaSug && <span className="chip-aceito">sugerir {areaSug} <X size={12} onClick={() => setAreaSug('')} /></span>}
          </div>
        )}
        {verAnexos && (
          <div className="chat-extras">
            <label className="btn-foto-chat">
              <Camera size={16} strokeWidth={2.4} /> Foto
              <input type="file" accept="image/*" onChange={escolherFoto} style={{ display: 'none' }} />
            </label>
            <select value={pacienteId} onChange={e => setPacienteId(e.target.value)}>
              <option value="">📋 Paciente…</option>
              {pacientes.map(p => <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} · ` : ''}{p.nome}</option>)}
            </select>
            <select value={pessoaId} onChange={e => setPessoaId(e.target.value)}>
              <option value="">@ Marcar…</option>
              {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {paciente && (
              <select value={areaSug} onChange={e => setAreaSug(e.target.value)}>
                <option value="">🦷 Sugerir…</option>
                {areas.map(a => <option key={a.nome} value={a.nome}>{a.nome}</option>)}
              </select>
            )}
          </div>
        )}
        {verEmojis && (
          <div className="chat-emojis">
            {EMOJIS.map(e => <button key={e} onClick={() => setTexto(t => t + e)}>{e}</button>)}
          </div>
        )}
        {erro && <div className="erro">{erro}</div>}
        <div className="chat-envio">
          <button className={'btn-redondo' + (verAnexos ? ' ligado' : '')} onClick={() => { setVerAnexos(!verAnexos); setVerEmojis(false); }} aria-label="Anexar">
            <Plus size={20} strokeWidth={2.6} />
          </button>
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva a mensagem…"
            onKeyDown={e => e.key === 'Enter' && enviar()} />
          <button className={'btn-redondo' + (verEmojis ? ' ligado' : '')} onClick={() => { setVerEmojis(!verEmojis); setVerAnexos(false); }} aria-label="Emoji">
            <Smile size={20} strokeWidth={2.4} />
          </button>
          <button className="btn-enviar" disabled={enviando || (!texto.trim() && !paciente && !foto)} onClick={enviar} aria-label="Enviar">
            <Send size={19} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {vendoFoto && (
        <div className="foto-cheia" onClick={() => setVendoFoto('')}>
          <button className="foto-fechar"><X size={22} /></button>
          <img src={vendoFoto} alt="foto" />
        </div>
      )}
    </div>
  );
}
