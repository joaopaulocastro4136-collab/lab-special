// Ficha do paciente — compartilhada entre o app central e o Semeador.
// Mostra código, dados, triagem e saúde; fotos do que foi feito; e, na
// central, permite EDITAR (com confirmação), APAGAR (com confirmação) e
// COMPARTILHAR a ficha em folha A4 (imagem pronta para imprimir).
import { useState } from 'react';
import { Bolha } from './logo.jsx';
import { TriangleAlert, Camera, X, ChevronLeft, Pencil, Trash2, Printer } from 'lucide-react';

// Reduz a foto para caber no banco (máx ~1000px, JPEG)
export function comprimirImagem(file, qualidade = 0.72, max = 1000) {
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

function areasDaTriagem(t) {
  if (!t) return [];
  if (Array.isArray(t.areas)) return t.areas;
  if (t.area) return [t.area];
  return [t.especialidade, t.procedimento].filter(Boolean);
}

// Desenha a ficha em folha A4 (imagem) para imprimir/compartilhar
async function gerarFolhaA4(paciente, arquivos) {
  const W = 1240, H = 1754; // A4 em ~150dpi
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

  const verde = '#226343';
  let y = 100;
  ctx.fillStyle = verde;
  ctx.font = '700 30px Georgia, serif';
  ctx.fillText('SEJA SEMENTE', 80, y);
  ctx.font = '400 24px Georgia, serif';
  ctx.fillStyle = '#555';
  ctx.fillText('Ficha do paciente', 80, y + 34);
  ctx.strokeStyle = '#DDD'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, y + 60); ctx.lineTo(W - 80, y + 60); ctx.stroke();

  // Código no topo direito
  ctx.fillStyle = verde;
  ctx.font = '800 40px Arial, sans-serif';
  const cod = paciente.codigo || '';
  ctx.fillText(cod, W - 80 - ctx.measureText(cod).width, y);

  // Foto do rosto (se tiver)
  if (paciente.foto) {
    await new Promise(res => {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(W - 320, y + 90, 240, 240, 20);
        ctx.clip();
        ctx.drawImage(img, W - 320, y + 90, 240, 240);
        ctx.restore();
        res();
      };
      img.onerror = res;
      img.src = paciente.foto;
    });
  }

  y += 140;
  const t = paciente.triagem;
  const larguraTexto = paciente.foto ? W - 480 : W - 160;
  const linha = (rotulo, valor) => {
    if (!valor) return;
    ctx.font = '700 26px Arial, sans-serif'; ctx.fillStyle = '#777';
    ctx.fillText(rotulo.toUpperCase(), 80, y);
    y += 38;
    ctx.font = '400 32px Arial, sans-serif'; ctx.fillStyle = '#1E2B22';
    // quebra de linha simples
    const palavras = String(valor).split(' ');
    let atual = '';
    for (const p of palavras) {
      if (ctx.measureText(atual + ' ' + p).width > larguraTexto) {
        ctx.fillText(atual, 80, y); y += 40; atual = p;
      } else atual = atual ? atual + ' ' + p : p;
    }
    if (atual) { ctx.fillText(atual, 80, y); y += 58; }
  };

  linha('Nome', paciente.nome);
  linha('Idade', paciente.idade ? `${paciente.idade} anos` : '');
  linha('Telefone', paciente.telefone);
  linha('Situação', paciente.status);
  linha('Procedimentos', areasDaTriagem(t).join(', '));
  linha('Saúde', t ? [...(t.saude || []), t.outrasCondicoes].filter(Boolean).join(', ') : '');
  linha('Observações', paciente.observacoes);
  linha('Fotos registradas', arquivos.length ? `${arquivos.length} foto(s) no aplicativo` : '');

  const agora = new Date();
  ctx.font = '400 22px Arial, sans-serif'; ctx.fillStyle = '#999';
  ctx.fillText(`Impresso em ${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`, 80, H - 70);

  return c.toDataURL('image/png');
}

export function FichaPaciente({ paciente, arquivos, aoVoltar, aoSalvarArquivo, podeEditar, aoSalvarEdicao, aoApagar, aoEditarTriagem }) {
  const [novaFoto, setNovaFoto] = useState(null);
  const [legenda, setLegenda] = useState('');
  const [vendo, setVendo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(null); // {nome, idade, telefone, observacoes}
  const [folhaA4, setFolhaA4] = useState(null);

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

  async function salvarEdicao() {
    if (!window.confirm(`Salvar as alterações de ${editando.nome || paciente.nome}?`)) return;
    setSalvando(true);
    try {
      await aoSalvarEdicao(editando);
      setEditando(null);
    } catch (e) {
      setErro('Não consegui salvar: ' + (e?.message || e));
    }
    setSalvando(false);
  }

  async function apagar() {
    if (!window.confirm(`Deseja apagar ${paciente.nome}?\n\nEssa ação não pode ser desfeita.`)) return;
    await aoApagar();
  }

  async function compartilharA4() {
    setErro('');
    const dataUrl = await gerarFolhaA4(paciente, arquivos);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `ficha-${paciente.codigo || paciente.nome}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ficha ${paciente.nome}` });
        return;
      }
    } catch (e) { /* cai para a visualização */ }
    setFolhaA4(dataUrl);
  }

  if (!paciente) return null;
  const t = paciente.triagem;
  const areas = areasDaTriagem(t);

  // ── Modo edição ──
  if (editando) return (
    <div className="folha">
      <h2>Editar — {paciente.nome}</h2>
      {paciente.codigo && <p className="dica">Código: {paciente.codigo}</p>}
      <label className="campo"><span>Nome</span><input value={editando.nome} onChange={e => setEditando({ ...editando, nome: e.target.value })} /></label>
      <label className="campo"><span>Idade</span><input value={editando.idade} onChange={e => setEditando({ ...editando, idade: e.target.value })} inputMode="numeric" /></label>
      <label className="campo"><span>Telefone</span><input value={editando.telefone} onChange={e => setEditando({ ...editando, telefone: e.target.value })} inputMode="tel" /></label>
      <label className="campo"><span>Observações</span><textarea rows={3} value={editando.observacoes} onChange={e => setEditando({ ...editando, observacoes: e.target.value })} /></label>
      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
        <button className="btn-principal" disabled={salvando || !editando.nome.trim()} onClick={salvarEdicao}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
      </div>
    </div>
  );

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <div className="cartao">
        <div className="cartao-linha">
          <Bolha nome={paciente.nome} foto={paciente.foto} />
          <div>
            <div className="cartao-topo">
              <strong style={{ fontSize: 18 }}>{paciente.nome}</strong>
              {paciente.codigo && <span className="chip concluído">{paciente.codigo}</span>}
            </div>
            <p className="obs">{[paciente.idade ? `${paciente.idade} anos` : '', paciente.telefone].filter(Boolean).join(' · ')}</p>
            {areas.length > 0 && <p>{areas.join(' · ')}{t?.profissionalNome ? ` · com ${t.profissionalNome}` : ''}</p>}
            {t && (t.saude?.length > 0 || t.outrasCondicoes) && (
              <p className="saude"><TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{[...(t.saude || []), t.outrasCondicoes].filter(Boolean).join(', ')}</p>
            )}
            {paciente.observacoes && <p className="obs">{paciente.observacoes}</p>}
            {!t && <p className="obs">Ainda sem triagem.</p>}
          </div>
        </div>
      </div>

      <div className="linha-acoes">
        {podeEditar && <button className="btn-acao" onClick={() => setEditando({ nome: paciente.nome || '', idade: paciente.idade || '', telefone: paciente.telefone || '', observacoes: paciente.observacoes || '' })}><Pencil size={16} /> Editar</button>}
        {podeEditar && aoEditarTriagem && <button className="btn-acao" onClick={aoEditarTriagem}><Pencil size={16} /> Triagem</button>}
        <button className="btn-acao" onClick={compartilharA4}><Printer size={16} /> Ficha A4</button>
        {podeEditar && <button className="btn-acao vermelho" onClick={apagar}><Trash2 size={16} /> Apagar</button>}
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

      {folhaA4 && (
        <div className="foto-cheia" onClick={() => setFolhaA4(null)}>
          <button className="foto-fechar"><X size={22} /></button>
          <img src={folhaA4} alt="Ficha A4" style={{ background: '#fff' }} />
          <div className="foto-info"><span>Segure na imagem para salvar ou compartilhar · pronta para imprimir em A4</span></div>
        </div>
      )}
    </div>
  );
}
