// A HISTÓRIA DO PROJETO — as palavras e as fotos do sejasemente.org,
// na estética dos aplicativos. Compartilhada entre os apps (hoje a
// Colheita abre nela; os outros podem reusar quando quiserem).
// As fotos vêm do site do projeto e ficam guardadas no nosso próprio
// servidor; se alguma faltar, o cartão continua bonito só com o texto.
import { useState } from 'react';
import { BrotoMini } from './logo.jsx';

// As fotos ficam no NOSSO servidor (copiadas do sejasemente.org) — assim
// funcionam igual no navegador e dentro do aplicativo do iPhone
const SITE = 'https://seja-semente-colheita.web.app';
const foto = (nome) => `${SITE}/${nome}`;

export const NUMEROS = [
  { valor: '+450', rotulo: 'ações realizadas' },
  { valor: '+600 mil', rotulo: 'pessoas impactadas' },
  { valor: '+500', rotulo: 'voluntários' },
];

export const PROJETOS = [
  {
    tag: '#PlanteSorrisos',
    texto: 'Uma iniciativa voltada à promoção da saúde bucal em comunidades carentes.',
    onde: ['Nordeste do Brasil', 'Quilombos de Cachoeira (Recôncavo Baiano)', 'Pernambuco', 'Bahia'],
    marca: '+20 mil atendimentos — exames preventivos, tratamentos e entrega de próteses',
    imagem: 'projeto-1.jpg',
  },
  {
    tag: '#PlanteAmor',
    texto: 'Uma ação promovida no domingo que antecede o Natal: milhares de rosas com mensagens que convidam a doar sangue, visitar creches, doar livros, ajudar orfanatos, plantar árvores e perdoar.',
    onde: ['Salvador — região da Barra'],
    marca: 'Milhares de rosas entregues, uma mensagem em cada uma',
    imagem: 'projeto-2.jpg',
  },
  {
    tag: '#SementeNasRuas',
    texto: 'Alimentação adequada, cobertores e escuta atenta para quem vive nas ruas.',
    onde: ['Salvador — toda segunda-feira', 'Petrolina — hospitais públicos'],
    marca: 'Mais de 300 pessoas atendidas por ação em Salvador',
    imagem: 'projeto-3.jpg',
  },
  {
    tag: '#SementeNosQuilombos',
    texto: 'Apoio contínuo às comunidades quilombolas.',
    onde: ['Recôncavo Baiano'],
    marca: '+4 mil cestas básicas distribuídas',
    imagem: 'projeto-4.jpg',
  },
  {
    tag: '#SementeNasComunidades',
    texto: 'Um dia inteiro de cuidado: atendimentos médicos e odontológicos, meditação, alongamento, oficina de futebol, bazar solidário, café da manhã, espaço de beleza, orientação jurídica, cadastro de MEI e casamento coletivo.',
    onde: ['Comunidades atendidas pelo projeto'],
    marca: 'Cuidado do corpo, do documento e do coração no mesmo dia',
    imagem: 'projeto-5.jpg',
  },
];

// ─── FAÇA UMA DOAÇÃO ───
// Os mesmos dados do sejasemente.org, para quem quiser contribuir sem sair
// do aplicativo: a chave Pix e a conta copiam com um toque, e a vakinha
// abre no navegador do aparelho.
export const PIX_CNPJ = '34.296.342/0001-12';
export const BANCO = { nome: 'Banco do Brasil', agencia: '1185-1', conta: '45.853-X' };
export const VAKINHA = 'https://www.vakinha.com.br/vaquinha/ajuda-para-comprar-4-cadeiras-odontologicas-portateis-para-levar-atendimento-gratuito-para-populacao-em-vulnerabilidade';

// Copia para a área de transferência; se o aparelho não deixar pelo caminho
// moderno, cai no jeito antigo (caixinha invisível + "copiar")
function copiarTexto(texto) {
  const antigo = () => {
    const cx = document.createElement('textarea');
    cx.value = texto;
    cx.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(cx);
    cx.focus(); cx.select();
    try { document.execCommand('copy'); } catch (e) {}
    cx.remove();
  };
  try {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texto).catch(antigo);
    else antigo();
  } catch (e) { antigo(); }
}

export function FacaUmaDoacao() {
  const [copiado, setCopiado] = useState('');
  const copiar = (chave, texto) => { copiarTexto(texto); setCopiado(chave); setTimeout(() => setCopiado(c => (c === chave ? '' : c)), 2200); };
  return (
    <>
      <h2 style={{ fontSize: 21, marginTop: 20 }}>Faça uma doação</h2>
      <p className="dica" style={{ marginTop: 0 }}>Cada contribuição vira atendimento, cesta e sorriso. Toque para copiar.</p>

      <div className="cartao cartao-doacao">
        <span className="marca-doacao">Pix</span>
        <p className="obs" style={{ margin: 0 }}>Nossa chave é o CNPJ</p>
        <div className="chave-doacao">{PIX_CNPJ}</div>
        <button className="btn-principal" style={{ maxWidth: 'none' }} onClick={() => copiar('pix', PIX_CNPJ)}>
          {copiado === 'pix' ? '✓ Chave copiada' : 'Copiar chave Pix'}
        </button>
      </div>

      <div className="cartao cartao-doacao">
        <span className="marca-doacao banco">{BANCO.nome}</span>
        <div className="linha-conta">
          <button type="button" onClick={() => copiar('ag', BANCO.agencia)}>
            <span>Agência</span><strong>{BANCO.agencia}</strong>
            <em>{copiado === 'ag' ? 'copiada ✓' : 'copiar'}</em>
          </button>
          <button type="button" onClick={() => copiar('cc', BANCO.conta)}>
            <span>Conta corrente</span><strong>{BANCO.conta}</strong>
            <em>{copiado === 'cc' ? 'copiada ✓' : 'copiar'}</em>
          </button>
        </div>
        <p className="obs" style={{ margin: 0 }}>Seja Semente · CNPJ {PIX_CNPJ}</p>
      </div>

      <a className="cartao cartao-vakinha" href={VAKINHA} target="_blank" rel="noreferrer">
        <div>
          <strong>Acesse nossa vakinha</strong>
          <p className="obs" style={{ margin: '3px 0 0' }}>Ajude a comprar 4 cadeiras odontológicas portáteis para levar atendimento gratuito a quem mais precisa.</p>
        </div>
        <span className="seta-vakinha">↗</span>
      </a>
    </>
  );
}

// A seção inteira, pronta para entrar em qualquer aba de "início"
export function SobreOProjeto({ Logo }) {
  return (
    <>
      <div className="capa-projeto">
        {Logo ? <Logo tamanho={64} /> : null}
        <h1>Seja Semente</h1>
        <div className="divisor-broto"><i /><BrotoMini tamanho={17} cor="rgba(255,255,255,0.55)" /><i /></div>
        <p>Somos uma organização sem fins lucrativos comprometida a ajudar pessoas desfavorecidas na nossa comunidade.</p>
      </div>

      <div className="grade-numeros">
        {NUMEROS.map(n => (
          <div className="cartao-numero" key={n.rotulo}><strong>{n.valor}</strong><span>{n.rotulo}</span></div>
        ))}
        <div className="cartao-numero destaque"><strong>1 gesto</strong><span>já muda uma vida</span></div>
      </div>

      <div className="cartao">
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.55 }}>
          <em>“Acreditamos que através de pequenos gestos podemos fazer uma grande diferença na vida de cada um.”</em>
        </p>
      </div>
      <p className="dica" style={{ marginTop: 4 }}>
        Nosso objetivo é criar uma comunidade mais justa e solidária, onde todos possam ter acesso a
        serviços básicos de saúde e alimentação, além de informações e recursos que possam ajudá-los
        a melhorar suas vidas.
      </p>

      <h2 style={{ fontSize: 21, marginTop: 18 }}>Nossas ações</h2>
      {PROJETOS.map(p => (
        <article className="cartao cartao-foto" key={p.tag}>
          <img src={foto(p.imagem)} alt={p.tag} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div className="cartao-foto-corpo">
            <strong className="tag-projeto">{p.tag}</strong>
            <p style={{ margin: '6px 0 0' }}>{p.texto}</p>
            <p className="obs" style={{ margin: '8px 0 0' }}>🌱 {p.marca}</p>
            <div className="chips-onde">
              {p.onde.map(o => <span className="chip triado" key={o}>{o}</span>)}
            </div>
          </div>
        </article>
      ))}

      <div className="cartao" style={{ border: '1.5px solid #37935B', textAlign: 'center' }}>
        <strong style={{ display: 'block', fontSize: 17 }}>Junte-se a nós nessa missão e ajude a fazer a diferença!</strong>
        <p className="obs" style={{ margin: '8px 0 0' }}>
          sejasemente.org · @sejasemente<br />CNPJ 34.296.342/0001-12
        </p>
      </div>

      <FacaUmaDoacao />
    </>
  );
}
