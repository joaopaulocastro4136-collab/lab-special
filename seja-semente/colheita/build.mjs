// Monta o aplicativo Colheita (investidores) em dist-colheita/ (rodar: node colheita/build.mjs)
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { paginaHTML, manifesto, CSS } from '../estilo.mjs';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

await esbuild.build({
  entryPoints: [join(raiz, 'colheita/app.jsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  loader: { '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: join(raiz, 'dist-colheita/app.js'),
  logLevel: 'info',
});

const titulo = 'Colheita';
const descricao = 'Prestação de contas do projeto Seja Semente para quem investiu: os sorrisos transformados, o relatório de cada ação e as notas fiscais.';

mkdirSync(join(raiz, 'dist-colheita'), { recursive: true });
writeFileSync(join(raiz, 'dist-colheita/index.html'), paginaHTML({ titulo, descricao }));
writeFileSync(join(raiz, 'dist-colheita/manifest.webmanifest'), JSON.stringify(manifesto({ nome: titulo, descricao }), null, 2));
writeFileSync(join(raiz, 'dist-colheita/app.css'), CSS);
console.log('dist-colheita pronto');
