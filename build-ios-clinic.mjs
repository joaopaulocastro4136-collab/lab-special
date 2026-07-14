// Gera o pacote web da Special Clinic para o app nativo (iPhone)
import esbuild from 'esbuild';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';

await esbuild.build({
  entryPoints: ['main-ios-clinic.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'clinic-native/www-bundle.js',
  logLevel: 'info',
});

const js = readFileSync('clinic-native/www-bundle.js', 'utf8');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Special Clinic</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1C1B19">
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
<script>${js.replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>
`;

mkdirSync('clinic-native/www', { recursive: true });
writeFileSync('clinic-native/www/index.html', html);
console.log('clinic-native/www/index.html gerado:', (html.length / 1024).toFixed(0) + ' KB');
