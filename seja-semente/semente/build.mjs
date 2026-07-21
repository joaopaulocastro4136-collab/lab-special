// Monta o aplicativo central Seja Semente em dist-semente/ (rodar: node semente/build.mjs)
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { paginaHTML, manifesto } from '../estilo.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  entryPoints: [join(raiz, 'semente/app.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: join(raiz, 'dist-semente/app.js'),
  logLevel: 'info',
});

const titulo = 'Seja Semente';
const descricao = 'Central do projeto Seja Semente: triagem inicial, agendamentos, avisos e equipe de voluntários.';

mkdirSync(join(raiz, 'dist-semente'), { recursive: true });
writeFileSync(join(raiz, 'dist-semente/index.html'), paginaHTML({ titulo, descricao }));
writeFileSync(join(raiz, 'dist-semente/manifest.webmanifest'), JSON.stringify(manifesto({ nome: titulo, descricao }), null, 2));
console.log('dist-semente pronto');
