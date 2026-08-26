// ═══════════════════════════════════════════════════════════════════════════
//  SUPORTE — quem somos, como falar com a gente, e as regras
//
//  A Apple exige contato publicado dentro do aplicativo (diretriz 1.2), a
//  política de privacidade acessível de dentro dele (5.1.1(i)) e regras de
//  uso onde há conteúdo escrito por gente. Esta tela junta as três coisas
//  num lugar só, em português de gente.
//
//  Compartilhada pelos quatro aplicativos.
// ═══════════════════════════════════════════════════════════════════════════
import { ChevronLeft } from 'lucide-react';

export const ONG = {
  nome: 'Seja Semente',
  cnpj: '34.296.342/0001-12',
  email: 'sejasemente@gmail.com',
  site: 'https://www.sejasemente.org',
  privacidade: 'https://www.sejasemente.org/privacidade',
  regras: 'https://www.sejasemente.org/regras',
};

export function TelaSuporte({ nomeDoApp, versao, aoVoltar }) {
  return (
    <div className="folha">
      <button className="btn-voltar" onClick={aoVoltar}><ChevronLeft size={18} /> Voltar</button>
      <h2>Ajuda e contato</h2>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>Quem faz este aplicativo</strong>
        <p style={{ margin: 0 }}>
          <b>{ONG.nome}</b> — organização sem fins lucrativos.<br />
          CNPJ {ONG.cnpj}
        </p>
        <p className="obs" style={{ margin: '8px 0 0' }}>
          {nomeDoApp} é uma ferramenta interna do projeto: serve para a equipe voluntária organizar os
          mutirões e registrar o que foi feito. Não é um serviço de saúde nem faz diagnóstico.
        </p>
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>Falar com a coordenação</strong>
        <p style={{ margin: 0 }}>
          <a href={`mailto:${ONG.email}`}>{ONG.email}</a>
        </p>
        <p className="obs" style={{ margin: '8px 0 0' }}>
          Denúncia de conteúdo, problema com a sua conta, pedido para apagar dados: escreva para esse
          endereço. A gente responde em até 24 horas.
        </p>
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>Como a gente se comporta aqui</strong>
        <p className="obs" style={{ margin: 0 }}>
          Não é permitido conteúdo ofensivo, discriminatório ou que exponha alguém. Em cada mensagem
          e em cada depoimento há um botão de denunciar e de bloquear, e a coordenação apaga o que
          violar estas regras — e tira do projeto quem insistir.
        </p>
      </div>

      <div className="cartao">
        <strong style={{ display: 'block', marginBottom: 6 }}>Os dados do paciente</strong>
        <p className="obs" style={{ margin: 0 }}>
          O que a equipe registra na ficha (nome, contato, condições de saúde, fotos do tratamento)
          fica com a equipe e serve só para o atendimento. Nada disso é usado para propaganda nem é
          vendido a ninguém. Fotos e depoimentos só saem daqui com a autorização da pessoa, que pode
          ser retirada a qualquer momento — é só pedir pelo contato acima.
        </p>
      </div>

      <a className="btn-principal" style={{ maxWidth: 'none', textAlign: 'center', textDecoration: 'none', display: 'block' }}
        href={ONG.privacidade} target="_blank" rel="noreferrer">Política de privacidade</a>
      <a className="btn-secundario" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 8 }}
        href={ONG.regras} target="_blank" rel="noreferrer">Regras de uso</a>

      <p className="obs" style={{ textAlign: 'center', marginTop: 16 }}>
        {nomeDoApp}{versao ? ` · versão ${versao}` : ''}<br />
        {ONG.site.replace('https://', '')}
      </p>
    </div>
  );
}

// O botão que leva até lá — entra no Perfil de cada aplicativo
export function BotaoSuporte({ aoAbrir }) {
  return (
    <>
      <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 4 }} onClick={aoAbrir}>
        ❓ Ajuda e contato
      </button>
      <p className="dica" style={{ marginBottom: 12 }}>
        Quem somos, como falar com a coordenação, política de privacidade e regras de uso.
      </p>
    </>
  );
}
