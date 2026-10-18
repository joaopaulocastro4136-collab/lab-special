import esbuild from 'esbuild';
import { writeFileSync, mkdirSync, copyFileSync } from 'fs';

await esbuild.build({
  entryPoints: ['ia-app.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'dist-ia/app.js',
  logLevel: 'info',
});

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="description" content="Special IA — simulação de sorriso com inteligência artificial: adicione a foto do paciente e veja o antes e depois em segundos.">
<title>Special IA</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Special IA">
<meta name="theme-color" content="#141311">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icone-192.png">
<link rel="icon" type="image/png" href="icone-192.png">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: #141311; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; overflow-x: hidden; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; touch-action: manipulation; }
  button { transition: transform 0.12s ease, opacity 0.12s ease; }
  button:active { transform: scale(0.96); }
  input:focus, select:focus, textarea:focus { border-color: #B8935A !important; box-shadow: 0 0 0 3px rgba(184,147,90,0.16); }
</style>
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`;

const manifest = {
  name: 'Special IA',
  short_name: 'Special IA',
  description: 'Simulação de sorriso com inteligência artificial',
  start_url: '.',
  display: 'standalone',
  background_color: '#141311',
  theme_color: '#141311',
  lang: 'pt-BR',
  icons: [
    { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
  ],
};

mkdirSync('dist-ia', { recursive: true });
writeFileSync('dist-ia/index.html', html);
writeFileSync('dist-ia/manifest.webmanifest', JSON.stringify(manifest, null, 2));
copyFileSync('icones/icone-ia-192.png', 'dist-ia/icone-192.png');
copyFileSync('icones/icone-ia-512.png', 'dist-ia/icone-512.png');
console.log('dist-ia pronto');
