// Foto ou dentinho do perfil — compartilhado entre a central e o Semeador.
// A pessoa pode colocar uma FOTO (comprimida, com uma versão mini para o
// chat) ou escolher um DENTINHO da biblioteca de avatares de dente.
import { useState } from 'react';
import { comprimirImagem } from './ficha.jsx';
import { AVATARES_DENTE, DenteAvatar, Bolha } from './logo.jsx';
import { Camera, X } from 'lucide-react';

export function SeletorAvatar({ nome, foto, avatar, aoSalvar }) {
  const [erro, setErro] = useState('');

  async function escolherFoto(e) {
    setErro('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const grande = await comprimirImagem(file, 0.7, 400);
      const mini = await comprimirImagem(file, 0.55, 96); // versão levinha para o chat
      await aoSalvar({ foto: grande, fotoMini: mini, avatar: '' });
    } catch (e2) { setErro('Não consegui ler essa imagem.'); }
  }

  return (
    <div className="seletor-avatar">
      <div className="avatar-atual">
        <Bolha nome={nome} foto={foto} avatar={avatar} />
        <label className="btn-acao" style={{ cursor: 'pointer' }}>
          <Camera size={16} /> {foto ? 'Trocar foto' : 'Foto'}
          <input type="file" accept="image/*" onChange={escolherFoto} style={{ display: 'none' }} />
        </label>
        {(foto || avatar) && (
          <button className="btn-acao vermelho" onClick={() => aoSalvar({ foto: '', fotoMini: '', avatar: '' })}><X size={14} /> Tirar</button>
        )}
      </div>
      <p className="dica" style={{ margin: '8px 0 6px' }}>Ou escolha um dentinho para ser a sua carinha:</p>
      <div className="grade-dentes">
        {AVATARES_DENTE.map(a => (
          <button key={a.id} className={avatar === a.id ? 'opcao-dente marcada' : 'opcao-dente'}
            onClick={() => aoSalvar({ avatar: a.id, foto: '', fotoMini: '' })}>
            <DenteAvatar tipo={a.id} tamanho={44} />
            <span>{a.nome.replace('Dente ', '')}</span>
          </button>
        ))}
      </div>
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}
