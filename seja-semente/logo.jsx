// A árvore original da logo do Seja Semente (recortada da marca oficial),
// para usar nas telas dos aplicativos. A marca não se modifica — este arquivo
// só embute a imagem como ela é.
import arvore from './icones/arvore.png';

export function ArvoreLogo({ tamanho = 120 }) {
  return <img src={arvore} width={tamanho} alt="Seja Semente" style={{ display: 'block' }} />;
}
