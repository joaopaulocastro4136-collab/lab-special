// Monta o aplicativo Semeador em dist-semeador/ (rodar: node semeador/build.mjs)
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { paginaHTML, manifesto } from '../estilo.mjs';

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

const titulo = 'Semeador';
const descricao = 'Semeador — aplicativo do voluntário do projeto Seja Semente: avisos, escalas, agenda e confirmação de presença.';

mkdirSync(join(raiz, 'dist-semeador'), { recursive: true });
writeFileSync(join(raiz, 'dist-semeador/index.html'), paginaHTML({ titulo: titulo + ' · Seja Semente', descricao }));
writeFileSync(join(raiz, 'dist-semeador/manifest.webmanifest'), JSON.stringify(manifesto({ nome: titulo, descricao }), null, 2));
console.log('dist-semeador pronto');
