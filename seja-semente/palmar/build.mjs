// Monta o aplicativo Palmar (gestão) em dist-palmar/ (rodar: node palmar/build.mjs)
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { paginaHTML, manifesto, CSS } from '../estilo.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  entryPoints: [join(raiz, 'palmar/app.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: join(raiz, 'dist-palmar/app.js'),
  logLevel: 'info',
});

const titulo = 'Palmar';
const descricao = 'Gestão do projeto Seja Semente: ações, equipe, estoque, valores e chamadas.';

mkdirSync(join(raiz, 'dist-palmar'), { recursive: true });
writeFileSync(join(raiz, 'dist-palmar/index.html'), paginaHTML({ titulo, descricao }));
writeFileSync(join(raiz, 'dist-palmar/manifest.webmanifest'), JSON.stringify(manifesto({ nome: titulo, descricao }), null, 2));
writeFileSync(join(raiz, 'dist-palmar/app.css'), CSS);
console.log('dist-palmar pronto');
