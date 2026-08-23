// Gera a CASCA VIVA dos apps para o iPhone (rodar: node build-nativo.mjs
// semente|semeador). A casca guarda só a ponte nativa (login Google pela
// tela do aparelho) e, ao abrir, busca o código do app direto da hospedagem
// (https://…web.app/app.js, publicado sem cache pelo hospedar.mjs) — assim
// toda novidade publicada chega no aplicativo instalado NA HORA, sem passar
// pelo TestFlight de novo. Se estiver sem internet, entra o plano B: uma
// cópia completa do app embutida na própria casca no dia em que foi compilada.
import esbuild from 'esbuild';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CSS } from './estilo.mjs';

const raiz = dirname(fileURLToPath(import.meta.url));
const qual = process.argv[2];
const APPS = {
  semente: { pasta: 'nativo-central', titulo: 'Seja Semente', site: 'https://seja-semente-app.web.app' },
  semeador: { pasta: 'nativo-semeador', titulo: 'Semeador', site: 'https://seja-semente-semeador.web.app' },
};
const app = APPS[qual];
if (!app) { console.error('Uso: node build-nativo.mjs semente|semeador'); process.exit(1); }

async function montar(entrada, saida) {
  await esbuild.build({
    entryPoints: [join(raiz, entrada)],
    bundle: true,
    minify: true,
    format: 'iife',
    jsx: 'automatic',
    loader: { '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: saida,
    logLevel: 'info',
  });
  // </script> dentro do código fecharia a página no meio — escapa
  return readFileSync(saida, 'utf8').replace(/<\/script>/gi, '<\\/script>');
}

const ponte = await montar(`${qual}/nativo.jsx`, join(raiz, app.pasta, 'www-ponte.js'));
const planoB = await montar(`${qual}/app.jsx`, join(raiz, app.pasta, 'www-plano-b.js'));

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${app.titulo}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#2F7D4E">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<style>${CSS}</style>
<link rel="stylesheet" href="${app.site}/app.css">
</head>
<body>
<div id="root"></div>
<script>${ponte}</script>
<script type="text/x-plano-b" id="plano-b">${planoB}</script>
<script>
// Busca o app mais novo da hospedagem; sem internet, sobe a cópia embutida.
// (a trava window.__appJaSubiu, dentro do próprio app, impede subir duas vezes)
(function () {
  function planoB() {
    // Só entra se o app da hospedagem não subiu mesmo: nada de tela dupla
    if (window.__appJaSubiu || document.getElementById('root').childElementCount) return;
    var local = document.createElement('script');
    local.textContent = document.getElementById('plano-b').textContent;
    document.body.appendChild(local);
  }
  var remoto = document.createElement('script');
  remoto.src = '${app.site}/app.js';
  remoto.onerror = planoB;
  setTimeout(planoB, 8000); // internet lenta demais também cai no plano B
  document.body.appendChild(remoto);
})();
</script>
</body>
</html>
`;

mkdirSync(join(raiz, app.pasta, 'www'), { recursive: true });
writeFileSync(join(raiz, app.pasta, 'www/index.html'), html);
console.log(`${app.pasta}/www pronto (casca viva → ${app.site})`);
