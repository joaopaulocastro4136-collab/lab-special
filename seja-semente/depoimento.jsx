// ═══════════════════════════════════════════════════════════════════════════
//  DEPOIMENTOS — a voz de quem foi atendido
//
//  Depois do atendimento, a equipe registra o que o paciente disse (e pode
//  guardar uma foto do sorriso novo). Na Colheita esses depoimentos aparecem
//  em PRIMEIRA MÃO, antes de tudo — é o que o investidor mais quer ver: o
//  agradecimento de quem recebeu.
//  Coleção: depoimentos.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Camera, Quote, Video, Images } from 'lucide-react';
import { Bolha } from './logo.jsx';
import { comprimirImagem } from './ficha.jsx';

// O vídeo não cabe dentro do banco (uma foto cabe, um vídeo não), então ele
// vai para o depósito de arquivos do Firebase e o depoimento guarda só o
// endereço. Sobe aos pedaços, mostrando o quanto já foi.
const DEPOSITO = 'gs://seja-semente-arquivos';

export async function subirVideo(fb, arquivo, aoProgresso, guardaTarefa) {
  const mod = await import('firebase/storage');
  // Depósito próprio do projeto (o nome padrão do Firebase é um domínio
  // reservado pelo Google, que não dá para criar por fora)
  const deposito = mod.getStorage(fb.app, DEPOSITO);
  const limpo = String(arquivo.name || 'video').replace(/[^\w.-]/g, '_').slice(-40);
  const caminho = `depoimentos/${Date.now()}-${limpo}`;
  const lugar = mod.ref(deposito, caminho);
  const tarefa = mod.uploadBytesResumable(lugar, arquivo, { contentType: arquivo.type || 'video/mp4' });
  if (guardaTarefa) guardaTarefa(tarefa);
  await new Promise((pronto, deuRuim) => {
    tarefa.on('state_changed',
      p => aoProgresso && aoProgresso(Math.round((p.bytesTransferred / (p.totalBytes || 1)) * 100)),
      deuRuim, pronto);
  });
  const url = await mod.getDownloadURL(lugar);
  // Guardamos TAMBÉM o caminho: é por ele que o vídeo é apagado de verdade
  // quando o depoimento sai do ar. Sem isso, o arquivo ficaria para sempre.
  return { url, caminho };
}

// Apaga o vídeo do depósito. Chamado junto com o depoimento — se a pessoa
// tirar a autorização, o arquivo some mesmo, não só o registro.
export async function apagarVideo(fb, caminho) {
  if (!fb || !caminho) return;
  try {
    const mod = await import('firebase/storage');
    await mod.deleteObject(mod.ref(mod.getStorage(fb.app, DEPOSITO), caminho));
  } catch (e) { /* já não existia */ }
}

// Formulário: quem falou, o que disse e (se quiser) a foto ou o VÍDEO do sorriso
export function FormDepoimento({ pacientes = [], pacienteInicial = null, fb = null, aoCancelar, aoSalvar }) {
  const [pacienteId, setPacienteId] = useState(pacienteInicial?.id || '');
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState('');
  const [video, setVideo] = useState(null);          // o arquivo escolhido
  const [videoPrevia, setVideoPrevia] = useState(''); // para assistir antes de salvar
  const [enviando, setEnviando] = useState(-1);      // % do envio do vídeo
  const tarefaVideo = useRef(null);                  // para cancelar se sair
  useEffect(() => () => { try { tarefaVideo.current?.cancel(); } catch (e) { /* já acabou */ } }, []);
  // Consentimento NUNCA vem pronto: quem marca é a pessoa da equipe,
  // depois de perguntar ao paciente. Sem isso o depoimento não sai daqui.
  const [autoriza, setAutoriza] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function pegarFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let d = await comprimirImagem(file);
      if (d.length > 900000) d = await comprimirImagem(file, 0.5, 800);
      setFoto(d);
    } catch (err) { setErro('Não consegui ler essa imagem.'); }
  }

  function pegarVideo(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    // 80 MB: um recado de celular cabe folgado, e sobe rápido no 4G
    if (f.size > 80 * 1024 * 1024) { setErro('Esse vídeo é grande demais (máximo 80 MB). Grave um mais curto — um recado de meio minuto cabe folgado.'); return; }
    setErro('');
    setVideo(f);
    setVideoPrevia(URL.createObjectURL(f));
  }
  function tirarVideo() {
    if (videoPrevia) URL.revokeObjectURL(videoPrevia);
    setVideo(null); setVideoPrevia('');
  }
  const paciente = pacientes.find(p => p.id === pacienteId) || pacienteInicial || null;

  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoCancelar}><ChevronLeft size={18} /> Voltar</button>
      <h2>💬 Novo depoimento</h2>
      <p className="dica" style={{ marginTop: 0 }}>O depoimento é a pessoa falando. Grave o vídeo logo depois do atendimento — é o que aparece em primeiro lugar na Colheita, para quem apoia o projeto ver o resultado de perto. 💚</p>

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

      <div className="cartao" style={{ border: '1.5px solid #37935B' }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>🎥 O vídeo do depoimento</strong>
        <p className="dica" style={{ margin: '0 0 8px' }}>Grave a pessoa falando, na hora, ou pegue o vídeo que já está no celular. É isto que o depoimento é.</p>
        {videoPrevia ? (
          <div className="video-depo">
            <video src={videoPrevia} controls playsInline preload="metadata" />
            <button type="button" className="btn-remover" onClick={tirarVideo}>✕</button>
          </div>
        ) : (
          <div className="foto-ad-vazia">
            <label className="foto-ad-botao">
              <Video size={19} />
              <span>Gravar vídeo</span>
              <input type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={pegarVideo} />
            </label>
            <label className="foto-ad-botao secundario">
              <Images size={19} />
              <span>Da galeria</span>
              <input type="file" accept="video/*" style={{ display: 'none' }} onChange={pegarVideo} />
            </label>
          </div>
        )}
        {enviando >= 0 && (
          <div className="barra-envio"><i style={{ width: enviando + '%' }} /><span>Enviando o vídeo… {enviando}%</span></div>
        )}
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>📷 Foto do sorriso (opcional)</strong>
        <p className="dica" style={{ margin: '0 0 8px' }}>Uma foto parada, para aparecer onde o vídeo não toca.</p>
        {foto ? (
          <div className="foto-ad-tem">
            <img src={foto} alt="sorriso" />
            <button type="button" className="btn-remover" onClick={() => setFoto('')}>✕</button>
          </div>
        ) : (
          <div className="foto-ad-vazia">
            <label className="foto-ad-botao">
              <Camera size={19} />
              <span>Tirar foto</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pegarFoto} />
            </label>
            <label className="foto-ad-botao secundario">
              <Images size={19} />
              <span>Da galeria</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pegarFoto} />
            </label>
          </div>
        )}
      </div>

      <label className="campo">
        <span>Resumo do que a pessoa disse (opcional)</span>
        <textarea rows={3} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Ex.: Faz anos que eu tinha vergonha de sorrir. Hoje eu saí daqui rindo à toa." />
      </label>
      <p className="dica" style={{ margin: '-4px 0 10px' }}>Ajuda quem prefere ler, e aparece junto do vídeo.</p>

      <label className={autoriza ? 'caixa marcada' : 'caixa'} onClick={() => setAutoriza(!autoriza)} style={{ alignSelf: 'flex-start' }}>
        ✅ A pessoa autorizou mostrar este depoimento
      </label>
      <p className="dica" style={{ margin: '4px 0 10px' }}>Sem a autorização o depoimento não é guardado. Pergunte à pessoa antes de marcar.</p>

      {!video && <div className="erro">Falta o vídeo — é ele que faz o depoimento.</div>}
      {video && !autoriza && <div className="erro">Marque a autorização da pessoa — sem ela o depoimento não pode ser guardado.</div>}
      {erro && <div className="erro">{erro}</div>}
      <div className="linha-botoes">
        <button className="btn-secundario" disabled={enviando >= 0} onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={salvando || !paciente || !video || !autoriza} onClick={async () => {
          setSalvando(true); setErro('');
          try {
            let videoUrl = '';
            let videoCaminho = '';
            if (video && fb) {
              setEnviando(0);
              const subiu = await subirVideo(fb, video, setEnviando, t => { tarefaVideo.current = t; });
              videoUrl = subiu.url; videoCaminho = subiu.caminho;
              tarefaVideo.current = null;
              setEnviando(-1);
            }
            await aoSalvar({
              texto: texto.trim(), foto, videoUrl, videoCaminho,
              // primeiro nome só: o cartão é mostrado a quem apoia o projeto
              pacienteId: paciente.id, pacienteNome: String(paciente.nome || '').trim().split(/\s+/)[0] || '',
              pacienteFoto: paciente.fotoMini || '', autorizado: autoriza,
            });
          } catch (e) {
            setEnviando(-1);
            setErro('Não consegui salvar: ' + (e?.message || e));
            setSalvando(false);
          }
        }}>{enviando >= 0 ? `Enviando… ${enviando}%` : (salvando ? 'Salvando…' : 'Salvar depoimento')}</button>
      </div>
    </div>
  );
}

// Cartão bonito do depoimento (usado na Colheita e na lista da equipe)
export function CartaoDepoimento({ depoimento: d, destaque, aoTocar, aoDenunciar }) {
  const Tag = aoTocar ? 'button' : 'div';
  return (
    <Tag className={'depoimento' + (destaque ? ' destaque' : '')} onClick={aoTocar}
      style={aoTocar ? { cursor: 'pointer', width: '100%', textAlign: 'left', font: 'inherit' } : undefined}>
      <Quote className="depo-aspas" size={destaque ? 30 : 22} strokeWidth={2.4} />
      {d.videoUrl && (
        <div className="video-depo" onClick={e => e.stopPropagation()}>
          <video src={d.videoUrl} controls playsInline preload="metadata" />
        </div>
      )}
      {d.texto && <p className="depo-texto">{d.texto}</p>}
      {aoDenunciar && (
        <button className="depo-denunciar" onClick={e => { e.stopPropagation(); aoDenunciar(d); }}>🚩 Denunciar</button>
      )}
      <div className="depo-quem">
        <Bolha nome={String(d.pacienteNome || '').split(' ')[0]} foto={d.foto || d.pacienteFoto} />
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
      <p className="dica" style={{ marginTop: 0 }}>A voz de quem foi atendido, em vídeo. Aparece em primeiro lugar na Colheita, para quem apoia ver o resultado. 💚</p>
      {depoimentos.length ? depoimentos.map(d => (
        <div key={d.id} style={{ position: 'relative' }}>
          <CartaoDepoimento depoimento={d} />
          {aoExcluir && (
            <button className="btn-remover" style={{ position: 'absolute', top: 10, right: 10 }}
              onClick={() => { if (window.confirm('Apagar este depoimento?')) aoExcluir(d); }}>✕</button>
          )}
          {!d.autorizado && <p className="obs" style={{ margin: '2px 0 10px' }}>⚠ sem autorização — não aparece na Colheita</p>}
        </div>
      )) : <div className="vazio">Nenhum depoimento ainda — grave um vídeo depois de um atendimento bonito. 🌱</div>}
    </div>
  );
}
