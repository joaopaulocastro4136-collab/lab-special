// ═══════════════════════════════════════════════════════════════════════════
//  REGISTRO DO ATENDIMENTO — a "pasta" do que foi feito com o paciente
//
//  Depois que o dentista atende alguém, ele registra aqui: FOTO DO ANTES e
//  FOTO DO DEPOIS, os dentes trabalhados no quadro (mesma arcada da triagem),
//  o tipo de procedimento e o que foi feito. Quando o registro vem de um
//  atendimento, é OBRIGATÓRIO completo — o dentista só consegue chamar o
//  próximo paciente depois de preencher tudo (o app avisa na tela).
//  Esses dados alimentam a ficha do paciente e, mais pra frente, os
//  aplicativos Palmar e Colheita (resultados e gastos para quem investe).
//  Guardado em pacientes/{id}/procedimentos (fotos entram nos arquivos).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { ChevronLeft, Camera, Images } from 'lucide-react';
import { Arcada } from './dentes.jsx';
import { comprimirImagem } from './ficha.jsx';

function FotoAntesDepois({ rotulo, foto, aoTrocar, aoLimpar }) {
  // Dois caminhos para a mesma foto: TIRAR na hora (abre a câmera direto) ou
  // BUSCAR uma que já está no celular — vai que na hora do atendimento não
  // deu para tirar pelo aplicativo e a foto ficou só na galeria.
  const pegar = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await comprimirImagem(file);
      if (dataUrl.length > 900000) dataUrl = await comprimirImagem(file, 0.5, 800);
      aoTrocar(dataUrl);
    } catch (err) { /* imagem ilegível: ignora */ }
  };
  return (
    <div className="foto-ad">
      <span className="foto-ad-rotulo">{rotulo}</span>
      {foto ? (
        <div className="foto-ad-tem">
          <img src={foto} alt={rotulo} />
          <button type="button" className="btn-remover" onClick={aoLimpar}>✕</button>
        </div>
      ) : (
        <div className="foto-ad-vazia">
          <label className="foto-ad-botao">
            <Camera size={19} />
            <span>Tirar foto</span>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pegar} />
          </label>
          <label className="foto-ad-botao secundario">
            <Images size={19} />
            <span>Da galeria</span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pegar} />
          </label>
        </div>
      )}
    </div>
  );
}

export function FormRegistro({ paciente, areas, areaInicial, motivo, obrigatorio, aoCancelar, aoSalvar }) {
  const [dentes, setDentes] = useState([]);
  const [area, setArea] = useState(areaInicial || '');
  const [descricao, setDescricao] = useState('');
  const [fotoAntes, setFotoAntes] = useState('');
  const [fotoDepois, setFotoDepois] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alternar = n => setDentes(ds => ds.includes(n) ? ds.filter(x => x !== n) : [...ds, n]);

  // Obrigatório (veio de um atendimento): antes + depois + tipo + descrição
  const faltando = [];
  if (obrigatorio) {
    if (!fotoAntes) faltando.push('foto do ANTES');
    if (!fotoDepois) faltando.push('foto do DEPOIS');
    if (!area) faltando.push('tipo de procedimento');
    if (!descricao.trim()) faltando.push('o que foi feito');
  }
  const podeSalvar = !salvando && (obrigatorio
    ? faltando.length === 0
    : (descricao.trim() || dentes.length || area || fotoAntes || fotoDepois));

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>O que foi feito</h2>
      <p className="dica" style={{ marginTop: 0 }}>Paciente: <strong>{paciente?.nome}</strong></p>
      {motivo === 'chamar' && (
        <div className="erro" style={{ background: '#FBE3DA', border: '1.5px solid #E8A08C', borderRadius: 14, padding: '11px 14px' }}>
          ⚠️ Para chamar o próximo paciente, primeiro registre o atendimento de <strong>{paciente?.nome}</strong>: foto do antes, foto do depois e o que foi feito.
        </div>
      )}
      {motivo === 'fim' && (
        <p className="dica">Atendimento encerrado — registre agora, enquanto está fresquinho. Sem esse registro o app não deixa chamar o próximo paciente. 🙂</p>
      )}

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>📷 Antes e depois{obrigatorio ? ' (obrigatório)' : ''}</strong>
        <div className="antes-depois-par">
          <FotoAntesDepois rotulo="ANTES" foto={fotoAntes} aoTrocar={setFotoAntes} aoLimpar={() => setFotoAntes('')} />
          <FotoAntesDepois rotulo="DEPOIS" foto={fotoDepois} aoTrocar={setFotoDepois} aoLimpar={() => setFotoDepois('')} />
        </div>
      </div>

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

      {obrigatorio && faltando.length > 0 && (
        <div className="erro">Falta preencher: {faltando.join(' · ')}</div>
      )}
      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Voltar</button>
        <button className="btn-principal" disabled={!podeSalvar} onClick={async () => {
          setSalvando(true); setErro('');
          try {
            await aoSalvar({ dentes: [...dentes].sort((a, b) => a - b), area, descricao: descricao.trim(), fotoAntes, fotoDepois });
          } catch (e) {
            setErro('Não consegui salvar: ' + (e?.message || e));
            setSalvando(false);
          }
        }}>{salvando ? 'Salvando…' : 'Salvar registro'}</button>
      </div>
    </div>
  );
}
