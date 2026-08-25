// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRO DO ATENDIMENTO — a "pasta" do que foi feito com o paciente
//
//  Depois que o dentista atende alguém, ele registra aqui: marca os dentes
//  trabalhados no quadro (mesma arcada da triagem), escolhe o procedimento e
//  escreve o que foi feito. Vira um cartão na ficha do paciente, com autor e
//  data. Se o dentista tentar CHAMAR o próximo paciente sem registrar o
//  anterior, o app lembra na hora (dá para deixar para depois).
//  Guardado em pacientes/{id}/procedimentos.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Arcada } from './dentes.jsx';

export function FormRegistro({ paciente, areas, areaInicial, motivo, aoCancelar, aoSalvar }) {
  const [dentes, setDentes] = useState([]);
  const [area, setArea] = useState(areaInicial || '');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alternar = n => setDentes(ds => ds.includes(n) ? ds.filter(x => x !== n) : [...ds, n]);
  const podeSalvar = !salvando && (descricao.trim() || dentes.length || area);

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> {motivo === 'chamar' ? 'Deixar para depois' : 'Voltar'}</button>
      <h2>O que foi feito</h2>
      <p className="dica" style={{ marginTop: 0 }}>Paciente: <strong>{paciente?.nome}</strong></p>
      {motivo === 'chamar' && (
        <div className="faixa-demo" style={{ maxWidth: 'none', textAlign: 'left' }}>
          ✍️ Antes de chamar o próximo paciente, registre o atendimento de <strong>{paciente?.nome}</strong> — leva um minutinho e fica na pasta dele. (Se preferir, toque em "Deixar para depois".)
        </div>
      )}
      {motivo === 'fim' && (
        <p className="dica">Atendimento encerrado — aproveite para registrar o que foi feito enquanto está fresquinho. 🙂</p>
      )}

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>Dentes trabalhados (toque para marcar)</strong>
        <Arcada marcados={dentes} aoAlternar={alternar} />
        {dentes.length > 0 && <p className="obs" style={{ marginTop: 6 }}>Marcados: {[...dentes].sort((a, b) => a - b).join(', ')}</p>}
      </div>

      <label className="campo">
        <span>Tipo de procedimento</span>
        <select value={area} onChange={e => setArea(e.target.value)}
          style={{ padding: '13px 12px', border: '1.5px solid #DBE3D8', borderRadius: 12, fontSize: 16, background: '#fff' }}>
          <option value="">Escolha…</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
          <option value="Outro">Outro</option>
        </select>
      </label>

      <label className="campo">
        <span>O que foi feito</span>
        <textarea rows={4} value={descricao} onChange={e => setDescricao(e.target.value)}
          placeholder="Ex.: Restauração em resina no dente 26. Anestesia local. Paciente orientado sobre os cuidados…" />
      </label>

      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>{motivo === 'chamar' ? 'Deixar para depois' : 'Cancelar'}</button>
        <button className="btn-principal" disabled={!podeSalvar} onClick={async () => {
          setSalvando(true); setErro('');
          try {
            await aoSalvar({ dentes: [...dentes].sort((a, b) => a - b), area, descricao: descricao.trim() });
          } catch (e) {
            setErro('Não consegui salvar: ' + (e?.message || e));
            setSalvando(false);
          }
        }}>{salvando ? 'Salvando…' : 'Salvar registro'}</button>
      </div>
    </div>
  );
}
