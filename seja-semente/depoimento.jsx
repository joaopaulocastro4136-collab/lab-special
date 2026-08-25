// ═══════════════════════════════════════════════════════════════════════════
//  DEPOIMENTOS — a voz de quem foi atendido
//
//  Depois do atendimento, a equipe registra o que o paciente disse (e pode
//  guardar uma foto do sorriso novo). Na Colheita esses depoimentos aparecem
//  em PRIMEIRA MÃO, antes de tudo — é o que o investidor mais quer ver: o
//  agradecimento de quem recebeu.
//  Coleção: depoimentos.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { ChevronLeft, Camera, Quote } from 'lucide-react';
import { Bolha } from './logo.jsx';
import { comprimirImagem } from './ficha.jsx';

// Formulário: quem falou, o que disse e (se quiser) a foto do sorriso
export function FormDepoimento({ pacientes = [], pacienteInicial = null, aoCancelar, aoSalvar }) {
  const [pacienteId, setPacienteId] = useState(pacienteInicial?.id || '');
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState('');
  const [autoriza, setAutoriza] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const paciente = pacientes.find(p => p.id === pacienteId) || pacienteInicial || null;

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>💬 Novo depoimento</h2>
      <p className="dica" style={{ marginTop: 0 }}>Escreva o que o paciente falou depois do atendimento. Isso aparece em primeiro lugar na Colheita, para quem apoia o projeto ver o resultado de perto. 💚</p>

      {!pacienteInicial && (
        <label className="campo">
          <span>De quem é o depoimento</span>
          <select value={pacienteId} onChange={e => setPacienteId(e.target.value)}
            style={{ padding: '13px 12px', border: '1.5px solid #DBE3D8', borderRadius: 12, fontSize: 16, background: '#fff' }}>
            <option value="">Escolha o paciente…</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      )}
      {paciente && (
        <div className="cartao">
          <div className="cartao-linha" style={{ alignItems: 'center' }}>
            <Bolha nome={paciente.nome} foto={paciente.foto} />
            <strong>{paciente.nome}</strong>
          </div>
        </div>
      )}

      <label className="campo">
        <span>O que a pessoa disse</span>
        <textarea rows={5} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Ex.: Faz anos que eu tinha vergonha de sorrir. Hoje eu saí daqui rindo à toa. Obrigada de coração a todos vocês." />
      </label>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>📷 Foto do sorriso (opcional)</strong>
        {foto ? (
          <div className="foto-ad-tem">
            <img src={foto} alt="sorriso" />
            <button type="button" className="btn-remover" onClick={() => setFoto('')}>✕</button>
          </div>
        ) : (
          <label className="foto-ad-botao">
            <Camera size={20} />
            <span>Tirar / escolher</span>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  let d = await comprimirImagem(file);
                  if (d.length > 900000) d = await comprimirImagem(file, 0.5, 800);
                  setFoto(d);
                } catch (err) { setErro('Não consegui ler essa imagem.'); }
              }} />
          </label>
        )}
      </div>

      <label className={autoriza ? 'caixa marcada' : 'caixa'} onClick={() => setAutoriza(!autoriza)} style={{ alignSelf: 'flex-start' }}>
        ✅ A pessoa autorizou mostrar este depoimento
      </label>
      <p className="dica" style={{ margin: '4px 0 10px' }}>Sem a autorização o depoimento fica guardado, mas não aparece para quem apoia o projeto.</p>

      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={salvando || !texto.trim() || !paciente} onClick={async () => {
          setSalvando(true); setErro('');
          try {
            await aoSalvar({
              texto: texto.trim(), foto,
              pacienteId: paciente.id, pacienteNome: paciente.nome || '',
              pacienteFoto: paciente.fotoMini || '', autorizado: autoriza,
            });
          } catch (e) {
            setErro('Não consegui salvar: ' + (e?.message || e));
            setSalvando(false);
          }
        }}>{salvando ? 'Salvando…' : 'Salvar depoimento'}</button>
      </div>
    </div>
  );
}

// Cartão bonito do depoimento (usado na Colheita e na lista da equipe)
export function CartaoDepoimento({ depoimento: d, destaque, aoTocar }) {
  const Tag = aoTocar ? 'button' : 'div';
  return (
    <Tag className={'depoimento' + (destaque ? ' destaque' : '')} onClick={aoTocar}
      style={aoTocar ? { cursor: 'pointer', width: '100%', textAlign: 'left', font: 'inherit' } : undefined}>
      <Quote className="depo-aspas" size={destaque ? 30 : 22} strokeWidth={2.4} />
      <p className="depo-texto">{d.texto}</p>
      <div className="depo-quem">
        <Bolha nome={d.pacienteNome} foto={d.foto || d.pacienteFoto} />
        <span>
          <strong>{String(d.pacienteNome || '').split(' ')[0]}</strong>
          {d.autorNome && <i>registrado por {String(d.autorNome).split(' ')[0]}</i>}
        </span>
      </div>
    </Tag>
  );
}

// Lista da equipe (central e Semeador): ver e adicionar depoimentos
export function TelaDepoimentos({ depoimentos = [], pacientes = [], aoNovo, aoExcluir, aoVoltar }) {
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao">
        <h2>💬 Depoimentos</h2>
        <button className="btn-mais" onClick={aoNovo}>+ Novo</button>
      </div>
      <p className="dica" style={{ marginTop: 0 }}>A voz de quem foi atendido. Aparece em primeiro lugar na Colheita, para quem apoia ver o resultado. 💚</p>
      {depoimentos.length ? depoimentos.map(d => (
        <div key={d.id} style={{ position: 'relative' }}>
          <CartaoDepoimento depoimento={d} />
          {aoExcluir && (
            <button className="btn-remover" style={{ position: 'absolute', top: 10, right: 10 }}
              onClick={() => { if (window.confirm('Apagar este depoimento?')) aoExcluir(d); }}>✕</button>
          )}
          {!d.autorizado && <p className="obs" style={{ margin: '2px 0 10px' }}>⚠ sem autorização — não aparece na Colheita</p>}
        </div>
      )) : <div className="vazio">Nenhum depoimento ainda — toque em + Novo depois de um atendimento bonito. 🌱</div>}
    </div>
  );
}
