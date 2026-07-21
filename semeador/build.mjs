// Monta o aplicativo Semeador em dist-semeador/ (rodar: node semeador/build.mjs)
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  entryPoints: [join(raiz, 'semeador/app.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: join(raiz, 'dist-semeador/app.js'),
  logLevel: 'info',
});

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="description" content="Semeador — aplicativo do voluntário do projeto Seja Semente: avisos, escalas e confirmação de presença.">
<title>Semeador · Seja Semente</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Semeador">
<meta name="theme-color" content="#2F7D4E">
<link rel="manifest" href="manifest.webmanifest">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: #F3F6F1; font-family: 'Manrope', sans-serif; color: #1E2B22; -webkit-text-size-adjust: 100%; overflow-x: hidden; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  button { font-family: inherit; transition: transform 0.12s ease, opacity 0.12s ease; }
  button:active { transform: scale(0.96); }
  input { font-family: inherit; }
  input:focus { border-color: #2F7D4E !important; box-shadow: 0 0 0 3px rgba(47,125,78,0.16); outline: none; }

  .carregando { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-size: 48px; }

  /* ── Login ── */
  .tela-login { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 12px; }
  .login-logo { font-size: 64px; }
  .tela-login h1 { margin: 0; font-weight: 800; color: #2F7D4E; }
  .login-sub { margin: 0 0 12px; color: #5C6B60; }
  .tela-login input { width: 100%; max-width: 320px; padding: 14px 16px; border: 1.5px solid #D4DCD2; border-radius: 12px; font-size: 16px; background: #fff; }
  .faixa-demo { max-width: 320px; background: #FFF6E3; border: 1px solid #E8D5A4; color: #7A5F1E; border-radius: 12px; padding: 10px 14px; font-size: 13px; text-align: center; }
  .erro { color: #B3402A; font-size: 14px; }
  .btn-principal { width: 100%; max-width: 320px; padding: 14px; border: none; border-radius: 12px; background: #2F7D4E; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }

  /* ── Estrutura principal ── */
  .tela-principal { min-height: 100vh; display: flex; flex-direction: column; }
  header { background: #2F7D4E; color: #fff; padding: calc(env(safe-area-inset-top) + 14px) 18px 14px; }
  .header-titulo { display: flex; align-items: center; gap: 10px; }
  .logo-mini { font-size: 26px; }
  .status { font-size: 12px; opacity: 0.75; }
  .status.online { opacity: 1; color: #B9F0CD; }
  main { flex: 1; padding: 18px 16px 90px; max-width: 560px; width: 100%; margin: 0 auto; }
  main h2 { font-size: 17px; font-weight: 800; margin: 6px 0 12px; }

  .cartao { background: #fff; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(30,43,34,0.07); }
  .cartao p { margin: 8px 0 0; line-height: 1.5; font-size: 15px; }
  .cartao-topo { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .quando { font-size: 12px; color: #7B897F; white-space: nowrap; }
  .autor { margin-top: 8px; font-size: 13px; color: #7B897F; font-style: italic; }
  .vazio { text-align: center; color: #7B897F; padding: 40px 20px; }

  .linha-confirma { margin-top: 12px; }
  .btn-confirmar { padding: 10px 16px; border: none; border-radius: 10px; background: #2F7D4E; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }
  .ok { color: #2F7D4E; font-weight: 700; font-size: 14px; }
  .btn-sair { margin-top: 8px; padding: 12px 18px; border: 1.5px solid #D4DCD2; border-radius: 12px; background: #fff; color: #B3402A; font-weight: 700; cursor: pointer; }

  /* ── Barra de abas ── */
  nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: #fff; border-top: 1px solid #E2E8E0; padding-bottom: env(safe-area-inset-bottom); }
  nav button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 0 8px; border: none; background: none; font-size: 20px; color: #7B897F; cursor: pointer; }
  nav button span { font-size: 11px; font-weight: 600; }
  nav button.ativo { color: #2F7D4E; }
</style>
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`;

const manifest = {
  name: 'Semeador',
  short_name: 'Semeador',
  description: 'Aplicativo do voluntário do projeto Seja Semente',
  start_url: '.',
  display: 'standalone',
  background_color: '#2F7D4E',
  theme_color: '#2F7D4E',
  lang: 'pt-BR',
  icons: [],
};

mkdirSync(join(raiz, 'dist-semeador'), { recursive: true });
writeFileSync(join(raiz, 'dist-semeador/index.html'), html);
writeFileSync(join(raiz, 'dist-semeador/manifest.webmanifest'), JSON.stringify(manifest, null, 2));
console.log('dist-semeador pronto');
