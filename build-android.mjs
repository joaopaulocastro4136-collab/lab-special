import esbuild from 'esbuild';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';

await esbuild.build({
  entryPoints: ['main-android-cloud.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: {
    'process.env.NODE_ENV': '"production"',
    // Carimbo de versão visível no app (a fábrica passa VERSAO_APP; local fica "dev")
    '__VERSAO_APP__': JSON.stringify(process.env.VERSAO_APP || 'dev'),
  },
  outfile: 'www-bundle.js',
  logLevel: 'info',
});

const js = readFileSync('www-bundle.js', 'utf8');
const tw = readFileSync('tw.css', 'utf8');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Lab Special</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1C1B19">
<style>${tw}</style>
<style>
  html, body { margin: 0; padding: 0; background: #F5F4F0; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; }
  .rounded-2xl { box-shadow: 0 1px 2px rgba(28,27,25,0.03), 0 12px 32px -20px rgba(28,27,25,0.14); }
  button { transition: transform 0.12s ease, opacity 0.12s ease, background 0.15s ease; }
  button:active { transform: scale(0.96); }
  input, select, textarea { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
  input:focus, select:focus, textarea:focus { border-color: #B8935A !important; box-shadow: 0 0 0 3px rgba(184,147,90,0.16); }
</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>
`;

mkdirSync('www', { recursive: true });
writeFileSync('www/index.html', html);
console.log('www/index.html gerado:', (html.length / 1024).toFixed(0) + ' KB');
