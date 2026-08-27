// ═══════════════════════════════════════════════════════════════════════════
//  A REDE DE SEGURANÇA
//
//  Um erro em qualquer tela derrubava o aplicativo inteiro e deixava a
//  pessoa olhando para uma tela BRANCA, sem botão nenhum — só fechando e
//  abrindo de novo. Isso é o pior que pode acontecer no meio de um mutirão,
//  e é também o que a análise da Apple mais rápido encontra.
//
//  Agora, se alguma tela quebrar, aparece um recado com o que houve e dois
//  caminhos: voltar ao começo ou recarregar. O resto do aplicativo continua
//  de pé, e o erro fica anotado para a gente consertar.
// ═══════════════════════════════════════════════════════════════════════════
import { Component } from 'react';

export class RedeDeSeguranca extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // Fica no registro do aparelho para o próximo diagnóstico
    try {
      localStorage.setItem('ultimo-erro', JSON.stringify({
        quando: new Date().toISOString(),
        recado: String(erro?.message || erro),
        onde: String(info?.componentStack || '').split('\n').slice(0, 4).join(' · '),
      }));
    } catch (e) { /* sem espaço: paciência */ }
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="tela-login">
        <h1 style={{ fontSize: 26 }}>Algo travou aqui</h1>
        <p className="missao">
          Uma tela do aplicativo deu problema. Nada do que você fez foi perdido — o que já tinha sido
          salvo continua salvo. Toque abaixo para começar de novo.
        </p>
        <button className="btn-principal" onClick={() => window.location.reload()}>Recarregar o aplicativo</button>
        <p className="obs" style={{ marginTop: 14, maxWidth: 320, textAlign: 'center' }}>
          Se acontecer de novo, manda um print desta tela:<br />
          <b>{String(this.state.erro?.message || this.state.erro).slice(0, 200)}</b>
        </p>
      </div>
    );
  }
}
