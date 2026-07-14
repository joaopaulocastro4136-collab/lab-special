import esbuild from 'esbuild';
import { writeFileSync, mkdirSync, copyFileSync, readFileSync } from 'fs';

await esbuild.build({
  entryPoints: ['clinic-app.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'dist-clinic/app.js',
  logLevel: 'info',
});

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Special Clinic</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Special Clinic">
<meta name="theme-color" content="#1C1B19">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icone-192.png">
<link rel="icon" type="image/png" href="icone-192.png">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: #F5F4F0; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
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
  name: 'Special Clinic',
  short_name: 'Special Clinic',
  description: 'Acompanhe seus trabalhos no Laboratório Special',
  start_url: '.',
  display: 'standalone',
  background_color: '#1C1B19',
  theme_color: '#1C1B19',
  lang: 'pt-BR',
  icons: [
    { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
  ],
};

mkdirSync('dist-clinic', { recursive: true });
writeFileSync('dist-clinic/index.html', html);
writeFileSync('dist-clinic/manifest.webmanifest', JSON.stringify(manifest, null, 2));
copyFileSync('icones/ic_launcher-xxxhdpi.png', 'dist-clinic/icone-192.png');
copyFileSync('icones/icone-512.png', 'dist-clinic/icone-512.png');
console.log('dist-clinic pronto');
