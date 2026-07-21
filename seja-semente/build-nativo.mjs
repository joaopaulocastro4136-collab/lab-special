// Gera o pacote web dos apps para as cascas nativas (iPhone).
// Rodar: node build-nativo.mjs semente   ou   node build-nativo.mjs semeador
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CSS } from './estilo.mjs';

const raiz = dirname(fileURLToPath(import.meta.url));
const qual = process.argv[2];
const APPS = {
  semente: { entrada: 'semente/app.jsx', pasta: 'nativo-central', titulo: 'Seja Semente' },
  semeador: { entrada: 'semeador/app.jsx', pasta: 'nativo-semeador', titulo: 'Semeador' },
};
const app = APPS[qual];
if (!app) { console.error('Uso: node build-nativo.mjs semente|semeador'); process.exit(1); }

const saida = join(raiz, app.pasta, 'www-bundle.js');
await esbuild.build({
  entryPoints: [join(raiz, app.entrada)],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: saida,
  logLevel: 'info',
});

const { readFileSync } = await import('fs');
const js = readFileSync(saida, 'utf8');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${app.titulo}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#2F7D4E">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>
`;

mkdirSync(join(raiz, app.pasta, 'www'), { recursive: true });
writeFileSync(join(raiz, app.pasta, 'www/index.html'), html);
console.log(`${app.pasta}/www pronto`);
