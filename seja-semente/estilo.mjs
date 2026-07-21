// Visual compartilhado dos aplicativos do Seja Semente (usado pelos build.mjs)
export const CSS = `
  html, body { margin: 0; padding: 0; background: #F3F6F1; font-family: 'Manrope', sans-serif; color: #1E2B22; -webkit-text-size-adjust: 100%; overflow-x: hidden; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  button { font-family: inherit; transition: transform 0.12s ease, opacity 0.12s ease; }
  button:active { transform: scale(0.96); }
  input, select, textarea { font-family: inherit; }
  input:focus, select:focus, textarea:focus { border-color: #2F7D4E !important; box-shadow: 0 0 0 3px rgba(47,125,78,0.16); outline: none; }

  .carregando { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 48px; }

  /* ── Login ── */
  .tela-login { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 12px; }
  .login-logo { font-size: 64px; }
  .tela-login h1 { margin: 0; font-weight: 800; color: #2F7D4E; }
  .login-sub { margin: 0 0 12px; color: #5C6B60; text-align: center; }
  .tela-login input { width: 100%; max-width: 320px; padding: 14px 16px; border: 1.5px solid #D4DCD2; border-radius: 12px; font-size: 16px; background: #fff; }
  .faixa-demo { max-width: 320px; background: #FFF6E3; border: 1px solid #E8D5A4; color: #7A5F1E; border-radius: 12px; padding: 10px 14px; font-size: 13px; text-align: center; }
  .erro { color: #B3402A; font-size: 14px; }
  .btn-principal { width: 100%; max-width: 320px; padding: 14px; border: none; border-radius: 12px; background: #2F7D4E; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
  .btn-principal:disabled { opacity: 0.5; }
  .btn-google { width: 100%; max-width: 320px; padding: 13px; border: 1.5px solid #D4DCD2; border-radius: 12px; background: #fff; font-size: 16px; font-weight: 700; color: #1E2B22; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .btn-google .g { width: 24px; height: 24px; border-radius: 50%; background: conic-gradient(from -45deg, #EA4335 110deg, #4285F4 90deg 180deg, #34A853 180deg 270deg, #FBBC05 270deg); color: #fff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .separador { max-width: 320px; width: 100%; display: flex; align-items: center; gap: 10px; color: #7B897F; font-size: 13px; }
  .separador::before, .separador::after { content: ''; flex: 1; height: 1px; background: #D4DCD2; }

  /* ── Estrutura principal ── */
  .tela-principal { min-height: 100vh; display: flex; flex-direction: column; }
  header { background: #2F7D4E; color: #fff; padding: calc(env(safe-area-inset-top) + 14px) 18px 14px; }
  .header-titulo { display: flex; align-items: center; gap: 10px; }
  .logo-mini { font-size: 26px; }
  .status { font-size: 12px; opacity: 0.75; }
  .status.online { opacity: 1; color: #B9F0CD; }
  main { flex: 1; padding: 18px 16px 90px; max-width: 560px; width: 100%; margin: 0 auto; }
  main h2 { font-size: 17px; font-weight: 800; margin: 6px 0 12px; }
  .titulo-com-botao { display: flex; justify-content: space-between; align-items: center; }
  .btn-mais { border: none; border-radius: 10px; background: #2F7D4E; color: #fff; font-weight: 700; font-size: 14px; padding: 8px 14px; cursor: pointer; }

  .cartao { background: #fff; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(30,43,34,0.07); }
  .cartao p { margin: 8px 0 0; line-height: 1.5; font-size: 15px; }
  .cartao-topo { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .quando { font-size: 12px; color: #7B897F; white-space: nowrap; }
  .autor, .obs { margin-top: 8px; font-size: 13px; color: #7B897F; }
  .autor { font-style: italic; }
  .vazio { text-align: center; color: #7B897F; padding: 40px 20px; }

  .cartao.pendente { border: 1.5px solid #E8D5A4; background: #FFFDF6; }
  .btn-aprovar { flex: 2; padding: 12px; border: none; border-radius: 10px; background: #2F7D4E; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }
  .btn-recusar { flex: 1; padding: 12px; border: 1.5px solid #E5C9C2; border-radius: 10px; background: #fff; color: #B3402A; font-weight: 700; font-size: 14px; cursor: pointer; }
  .icone-aba { position: relative; }
  .bolinha { position: absolute; top: -2px; right: -6px; width: 10px; height: 10px; border-radius: 50%; background: #E0492E; border: 2px solid #fff; }

  .chip { border: none; border-radius: 999px; font-size: 12px; font-weight: 700; padding: 5px 12px; cursor: pointer; white-space: nowrap; }
  .chip.aguardando { background: #FFF1D6; color: #8A6516; }
  .chip.em-atendimento { background: #DDEBFF; color: #245A9E; }
  .chip.concluída { background: #DCF2E3; color: #226B41; }

  .linha-confirma { margin-top: 12px; }
  .btn-confirmar { padding: 10px 16px; border: none; border-radius: 10px; background: #2F7D4E; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }
  .ok { color: #2F7D4E; font-weight: 700; font-size: 14px; }
  .btn-sair { margin-top: 8px; padding: 12px 18px; border: 1.5px solid #D4DCD2; border-radius: 12px; background: #fff; color: #B3402A; font-weight: 700; cursor: pointer; }

  /* ── Formulários (folha inteira) ── */
  .folha { min-height: 100vh; max-width: 560px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 22px) 20px 30px; display: flex; flex-direction: column; gap: 12px; }
  .folha h2 { margin: 0 0 6px; color: #2F7D4E; }
  .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 700; color: #5C6B60; }
  .campo input, .campo select, .campo textarea { padding: 12px 14px; border: 1.5px solid #D4DCD2; border-radius: 12px; font-size: 16px; background: #fff; font-weight: 400; color: #1E2B22; }
  .dica { font-size: 13px; color: #7B897F; margin: 0; }
  .caixas { display: flex; flex-wrap: wrap; gap: 8px; }
  .caixa { display: flex; align-items: center; gap: 7px; padding: 9px 13px; border: 1.5px solid #D4DCD2; border-radius: 999px; background: #fff; font-size: 14px; font-weight: 600; color: #1E2B22; cursor: pointer; }
  .caixa input { accent-color: #2F7D4E; margin: 0; }
  .caixa.marcada { border-color: #2F7D4E; background: #EAF4EE; }
  .saude { margin-top: 8px !important; font-size: 14px; color: #8A5A16; background: #FFF6E3; border-radius: 8px; padding: 6px 10px; }
  .linha-botoes { display: flex; gap: 10px; margin-top: 10px; }
  .linha-botoes .btn-principal { flex: 1; }
  .btn-secundario { flex: 1; padding: 14px; border: 1.5px solid #D4DCD2; border-radius: 12px; background: #fff; font-size: 16px; font-weight: 700; color: #5C6B60; cursor: pointer; }

  /* ── Barra de abas ── */
  nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: #fff; border-top: 1px solid #E2E8E0; padding-bottom: env(safe-area-inset-bottom); }
  nav button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0 8px; border: none; background: none; font-size: 20px; color: #7B897F; cursor: pointer; }
  nav button span { font-size: 11px; font-weight: 600; }
  nav button.ativo { color: #2F7D4E; }
`;

export function paginaHTML({ titulo, descricao }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="description" content="${descricao}">
<title>${titulo}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${titulo}">
<meta name="theme-color" content="#2F7D4E">
<link rel="manifest" href="manifest.webmanifest">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`;
}

export function manifesto({ nome, descricao }) {
  return {
    name: nome,
    short_name: nome,
    description: descricao,
    start_url: '.',
    display: 'standalone',
    background_color: '#2F7D4E',
    theme_color: '#2F7D4E',
    lang: 'pt-BR',
    icons: [],
  };
}
