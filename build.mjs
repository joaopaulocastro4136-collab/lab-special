import esbuild from 'esbuild';
import { writeFileSync, readFileSync } from 'fs';

const result = await esbuild.build({
  entryPoints: ['main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'bundle.js',
  logLevel: 'info',
});

const js = readFileSync('bundle.js', 'utf8');
const tw = readFileSync('tw.css', 'utf8');

const html = `<title>Lab Special</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Lab Special">
<meta name="theme-color" content="#1C1B19">
<style>${tw}</style>
<style>
  html, body { margin: 0; padding: 0; background: #F5F4F0; }
  #root { min-height: 100vh; }
  * { -webkit-tap-highlight-color: transparent; }
</style>
<div id="root"></div>
<script>${js.replace(/<\/script>/gi, '<\\/script>')}</script>
`;

writeFileSync('app.html', html);
console.log('app.html gerado:', (html.length / 1024).toFixed(0) + ' KB');
