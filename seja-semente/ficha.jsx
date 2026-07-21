// Ficha do paciente — compartilhada entre o app central e o Semeador.
// Mostra os dados, a triagem e a saúde do paciente, e a seção de fotos e
// arquivos: o dentista fotografa o que foi feito, põe legenda e salva.
// As fotos são comprimidas no aparelho e guardadas no banco (Firestore).
import { useState } from 'react';
import { Bolha } from './logo.jsx';
import { TriangleAlert, Camera, X, ChevronLeft } from 'lucide-react';

// Reduz a foto para caber no banco (máx ~1000px, JPEG)
function comprimirImagem(file, qualidade = 0.72, max = 1000) {
  return new Promise((res, rej) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = rej;
      img.src = leitor.result;
    };
    leitor.onerror = rej;
    leitor.readAsDataURL(file);
  });
}

export function FichaPaciente({ paciente, arquivos, aoVoltar, aoSalvarArquivo }) {
  const [novaFoto, setNovaFoto] = useState(null);
  const [legenda, setLegenda] = useState('');
  const [vendo, setVendo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function escolher(e) {
    setErro('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await comprimirImagem(file);
      if (dataUrl.length > 900000) dataUrl = await comprimirImagem(file, 0.5, 800);
      if (dataUrl.length > 900000) { setErro('A foto ficou grande demais — tente outra.'); return; }
      setNovaFoto(dataUrl);
    } catch (e2) {
      setErro('Não consegui ler essa imagem.');
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvarArquivo(novaFoto, legenda.trim());
      setNovaFoto(null);
      setLegenda('');
    } catch (e) {
      setErro('Não consegui salvar: ' + (e?.message || e));
    }
    setSalvando(false);
  }

  if (!paciente) return null;
  const t = paciente.triagem;

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="cartao">
        <div className="cartao-linha">
          <Bolha nome={paciente.nome} />
          <div>
            <strong style={{ fontSize: 18 }}>{paciente.nome}</strong>
            <p className="obs">{[paciente.idade ? `${paciente.idade} anos` : '', paciente.telefone].filter(Boolean).join(' · ')}</p>
            {t && <p>{[t.especialidade, t.procedimento].filter(Boolean).join(' · ')}{t.profissionalNome ? ` · com ${t.profissionalNome}` : ''}</p>}
            {t && (t.saude?.length > 0 || t.outrasCondicoes) && (
              <p className="saude"><TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{[...(t.saude || []), t.outrasCondicoes].filter(Boolean).join(', ')}</p>
            )}
            {paciente.observacoes && <p className="obs">{paciente.observacoes}</p>}
            {!t && <p className="obs">Ainda sem triagem.</p>}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '10px 0 4px' }}>Fotos e arquivos</h2>

      {novaFoto ? (
        <div className="cartao">
          <img src={novaFoto} alt="nova foto" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
          <div className="campo" style={{ marginTop: 10 }}>
            <span>Legenda (o que foi feito)</span>
            <input value={legenda} onChange={e => setLegenda(e.target.value)} placeholder="Ex.: Extração do dente 36 concluída" />
          </div>
          <div className="linha-botoes">
            <button className="btn-secundario" onClick={() => { setNovaFoto(null); setLegenda(''); }}>Cancelar</button>
            <button className="btn-principal" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar foto'}</button>
          </div>
        </div>
      ) : (
        <label className="btn-foto">
          <Camera size={20} /> Adicionar foto
          <input type="file" accept="image/*" onChange={escolher} style={{ display: 'none' }} />
        </label>
      )}
      {erro && <div className="erro">{erro}</div>}

      {arquivos.length ? (
        <div className="grade-fotos">
          {arquivos.map(a => (
            <button key={a.id} className="foto-mini" onClick={() => setVendo(a)}>
              <img src={a.dataUrl} alt={a.legenda || 'foto'} />
            </button>
          ))}
        </div>
      ) : !novaFoto && <p className="dica">Nenhuma foto ainda — registre aqui o que for feito.</p>}

      {vendo && (
        <div className="foto-cheia" onClick={() => setVendo(null)}>
          <button className="foto-fechar"><X size={22} /></button>
          <img src={vendo.dataUrl} alt={vendo.legenda || 'foto'} />
          {(vendo.legenda || vendo.autorNome) && (
            <div className="foto-info">
              {vendo.legenda && <strong>{vendo.legenda}</strong>}
              {vendo.autorNome && <span>por {vendo.autorNome}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
