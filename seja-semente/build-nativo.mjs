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
</head>
<body>
<div id="root"></div>
<script>${ponte}</script>
<script type="text/x-plano-b" id="plano-b">${planoB}</script>
<script>
// Busca o app mais novo da hospedagem e GUARDA uma cópia no aparelho.
// Sem internet: usa a última versão guardada; se nunca baixou nenhuma,
// entra a cópia de fábrica embutida nesta casca. A trava window.__appJaSubiu
// (dentro do próprio app) garante que ele nunca sobe duas vezes.
(function () {
  var SITE = '${app.site}';
  function roda(js) {
    var s = document.createElement('script');
    s.textContent = js;
    document.body.appendChild(s); // executa na hora
  }
  function subiu() { return window.__appJaSubiu || document.getElementById('root').childElementCount > 0; }
  function planoB() {
    if (subiu()) return;
    var guardado = null;
    try { guardado = localStorage.getItem('casca-app'); } catch (e) {}
    if (guardado) { try { roda(guardado); } catch (e) {} }   // última versão baixada
    if (subiu()) return;
    roda(document.getElementById('plano-b').textContent);    // cópia de fábrica
  }
  // Estilos: aplica o mais novo que tiver guardado e busca o novo por fora
  try {
    var cssGuardado = localStorage.getItem('casca-css');
    if (cssGuardado) { var e1 = document.createElement('style'); e1.textContent = cssGuardado; document.head.appendChild(e1); }
  } catch (e) {}
  var cortaCss = new AbortController();
  setTimeout(function () { cortaCss.abort(); }, 8000);
  fetch(SITE + '/app.css', { signal: cortaCss.signal, cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (css) {
      if (!css) return;
      try { localStorage.setItem('casca-css', css); } catch (e) {}
      var e2 = document.createElement('style'); e2.textContent = css; document.head.appendChild(e2);
    }).catch(function () {});
  // O app: rede → guardado no aparelho → cópia de fábrica
  var corta = new AbortController();
  var vigia = setTimeout(function () { corta.abort(); }, 8000);
  fetch(SITE + '/app.js', { signal: corta.signal, cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('resposta ' + r.status); return r.text(); })
    .then(function (js) {
      clearTimeout(vigia);
      try { localStorage.setItem('casca-app', js); } catch (e) {}
      if (!subiu()) roda(js);
    })
    .catch(function () { clearTimeout(vigia); planoB(); });
})();
</script>
</body>
</html>
`;

mkdirSync(join(raiz, app.pasta, 'www'), { recursive: true });
writeFileSync(join(raiz, app.pasta, 'www/index.html'), html);
console.log(`${app.pasta}/www pronto (casca viva → ${app.site})`);
