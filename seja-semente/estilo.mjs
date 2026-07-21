// Visual compartilhado dos aplicativos do Seja Semente (usado pelos build.mjs)
export const CSS = `
  html, body { margin: 0; padding: 0; background: #F2F5EF; font-family: 'Manrope', sans-serif; color: #1E2B22; -webkit-text-size-adjust: 100%; overflow-x: hidden; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  button { font-family: inherit; transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease; }
  button:active { transform: scale(0.96); }
  input, select, textarea { font-family: inherit; }
  input:focus, select:focus, textarea:focus { border-color: #2F7D4E !important; box-shadow: 0 0 0 4px rgba(47,125,78,0.14); outline: none; }

  .carregando { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 48px; }

  /* ── Login ── */
  .tela-login { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px; gap: 13px;
    background: radial-gradient(900px 480px at 50% -120px, #DCEFE3 0%, #F2F5EF 62%); }
  .tela-login h1 { margin: 2px 0 0; font-weight: 800; font-size: 30px; letter-spacing: -0.5px; color: #226343; }
  .login-sub { margin: 0 0 14px; color: #5C6B60; text-align: center; font-size: 15px; }
  .tela-login input { width: 100%; max-width: 330px; padding: 15px 17px; border: 1.5px solid #DBE3D8; border-radius: 14px; font-size: 16px; background: #fff; box-shadow: 0 2px 8px rgba(30,43,34,0.04); }
  .faixa-demo { max-width: 330px; background: #FFF6E3; border: 1px solid #EEDCAC; color: #7A5F1E; border-radius: 14px; padding: 10px 14px; font-size: 13px; text-align: center; }
  .erro { color: #B3402A; font-size: 14px; }
  .btn-principal { width: 100%; max-width: 330px; padding: 15px; border: none; border-radius: 14px;
    background: linear-gradient(135deg, #37935B 0%, #226343 100%); color: #fff; font-size: 16px; font-weight: 800; cursor: pointer;
    box-shadow: 0 8px 20px rgba(47,125,78,0.32); }
  .btn-principal:disabled { opacity: 0.5; box-shadow: none; }
  .btn-google { width: 100%; max-width: 330px; padding: 14px; border: 1.5px solid #DBE3D8; border-radius: 14px; background: #fff; font-size: 16px; font-weight: 800; color: #1E2B22; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 14px rgba(30,43,34,0.07); }
  .btn-google .g { width: 26px; height: 26px; border-radius: 50%; background: conic-gradient(from -45deg, #EA4335 110deg, #4285F4 90deg 180deg, #34A853 180deg 270deg, #FBBC05 270deg); color: #fff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; }
  .separador { max-width: 330px; width: 100%; display: flex; align-items: center; gap: 10px; color: #7B897F; font-size: 13px; }
  .separador::before, .separador::after { content: ''; flex: 1; height: 1px; background: #DBE3D8; }

  /* ── Estrutura principal ── */
  .tela-principal { min-height: 100vh; display: flex; flex-direction: column; }
  header { background: linear-gradient(135deg, #37935B 0%, #1F5B38 100%); color: #fff;
    padding: calc(env(safe-area-inset-top) + 18px) 20px 22px; border-radius: 0 0 26px 26px;
    box-shadow: 0 10px 26px rgba(31,91,56,0.28); }
  .header-titulo { display: flex; align-items: center; gap: 13px; }
  .logo-bolha { width: 48px; height: 48px; border-radius: 16px; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.14); }
  .logo-mini { font-size: 26px; }
  header strong { font-size: 19px; font-weight: 800; letter-spacing: -0.3px; }
  .status { font-size: 12.5px; opacity: 0.85; margin-top: 1px; }
  .status.online { opacity: 1; color: #B9F0CD; font-weight: 700; }
  main { flex: 1; padding: 20px 16px 110px; max-width: 560px; width: 100%; margin: 0 auto; }
  main h2 { font-size: 20px; font-weight: 800; margin: 8px 0 14px; letter-spacing: -0.3px; }
  .titulo-com-botao { display: flex; justify-content: space-between; align-items: center; }
  .btn-mais { border: none; border-radius: 13px; background: linear-gradient(135deg, #37935B, #226343); color: #fff; font-weight: 800; font-size: 14px; padding: 10px 17px; cursor: pointer; box-shadow: 0 6px 14px rgba(47,125,78,0.32); }

  /* ── Cartões ── */
  .cartao { background: #fff; border-radius: 18px; padding: 15px 16px; margin-bottom: 14px;
    box-shadow: 0 6px 18px rgba(30,43,34,0.07); border: 1px solid rgba(30,43,34,0.05); }
  .cartao p { margin: 8px 0 0; line-height: 1.55; font-size: 15px; }
  .cartao-linha { display: flex; gap: 12px; align-items: flex-start; }
  .cartao-linha > div:last-child { flex: 1; min-width: 0; }
  .bolha { width: 46px; height: 46px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; color: #fff; flex: none; letter-spacing: 0.5px; }
  .bolha.suave { font-size: 21px; }
  .cartao-topo { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .cartao-topo strong { font-size: 16.5px; font-weight: 800; letter-spacing: -0.2px; }
  .quando { font-size: 12px; color: #7B897F; white-space: nowrap; font-weight: 700; }
  .autor, .obs { margin-top: 7px !important; font-size: 13.5px; color: #7B897F; }
  .autor { font-style: italic; }
  .vazio { text-align: center; color: #7B897F; padding: 46px 20px; background: #fff; border-radius: 18px; border: 1.5px dashed #D6DED3; }

  .cartao.pendente { border: 1.5px solid #EEDCAC; background: #FFFDF6; }
  .btn-aprovar { flex: 2; padding: 13px; border: none; border-radius: 12px; background: linear-gradient(135deg, #37935B, #226343); color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 5px 12px rgba(47,125,78,0.28); }
  .btn-recusar { flex: 1; padding: 13px; border: 1.5px solid #E9CFC7; border-radius: 12px; background: #fff; color: #B3402A; font-weight: 800; font-size: 14px; cursor: pointer; }
  .icone-aba { position: relative; }
  .bolinha { position: absolute; top: -2px; right: -6px; width: 10px; height: 10px; border-radius: 50%; background: #E0492E; border: 2px solid #fff; }

  .chip { border: none; border-radius: 999px; font-size: 12px; font-weight: 800; padding: 6px 13px; cursor: pointer; white-space: nowrap; }
  .chip.aguardando { background: #FFECC7; color: #8A6516; }
  .chip.em-atendimento { background: #D8E9FF; color: #245A9E; }
  .chip.concluída, .chip.concluído { background: #D6F1E0; color: #1E6B41; }

  .linha-confirma { margin-top: 12px; }
  .btn-confirmar { padding: 11px 18px; border: none; border-radius: 12px; background: linear-gradient(135deg, #37935B, #226343); color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: 0 5px 12px rgba(47,125,78,0.28); }
  .ok { color: #2F7D4E; font-weight: 800; font-size: 14px; }
  .btn-sair { margin-top: 10px; padding: 13px 18px; border: 1.5px solid #DBE3D8; border-radius: 14px; background: #fff; color: #B3402A; font-weight: 800; cursor: pointer; box-shadow: 0 3px 10px rgba(30,43,34,0.05); }

  /* ── Formulários (folha inteira) ── */
  .folha { min-height: 100vh; max-width: 560px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 24px) 20px 34px; display: flex; flex-direction: column; gap: 13px;
    background: radial-gradient(700px 340px at 50% -80px, #DCEFE3 0%, #F2F5EF 60%); }
  .folha h2 { margin: 0 0 6px; color: #226343; font-size: 23px; font-weight: 800; letter-spacing: -0.4px; }
  .campo { display: flex; flex-direction: column; gap: 7px; font-size: 13px; font-weight: 800; color: #55645A; }
  .campo input, .campo select, .campo textarea { padding: 13px 15px; border: 1.5px solid #DBE3D8; border-radius: 14px; font-size: 16px; background: #fff; font-weight: 400; color: #1E2B22; box-shadow: 0 2px 8px rgba(30,43,34,0.04); }
  .dica { font-size: 13px; color: #7B897F; margin: 0; }
  .caixas { display: flex; flex-wrap: wrap; gap: 8px; }
  .caixa { display: flex; align-items: center; gap: 7px; padding: 10px 14px; border: 1.5px solid #DBE3D8; border-radius: 999px; background: #fff; font-size: 14px; font-weight: 700; color: #1E2B22; cursor: pointer; box-shadow: 0 2px 6px rgba(30,43,34,0.04); }
  .caixa input { accent-color: #2F7D4E; margin: 0; }
  .caixa.marcada { border-color: #2F7D4E; background: #E5F3EA; box-shadow: 0 2px 8px rgba(47,125,78,0.18); }
  .saude { margin-top: 9px !important; font-size: 14px; color: #8A5A16; background: #FFF3D9; border-radius: 11px; padding: 8px 12px; }
  .linha-botoes { display: flex; gap: 10px; margin-top: 10px; }
  .linha-botoes .btn-principal { flex: 1; max-width: none; }
  .btn-secundario { flex: 1; padding: 15px; border: 1.5px solid #DBE3D8; border-radius: 14px; background: #fff; font-size: 16px; font-weight: 800; color: #55645A; cursor: pointer; }

  /* ── Barra de abas flutuante ── */
  nav { position: fixed; left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); display: flex; gap: 4px;
    background: rgba(255,255,255,0.96); backdrop-filter: blur(10px); border-radius: 24px; padding: 8px;
    box-shadow: 0 12px 34px rgba(30,43,34,0.20); max-width: 560px; margin: 0 auto; }
  nav button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 9px 0 8px; border: none; background: none; font-size: 21px; color: #8A968D; cursor: pointer; border-radius: 17px; }
  nav button span:last-child { font-size: 11px; font-weight: 800; }
  nav button.ativo { color: #226343; background: #E5F3EA; }
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
