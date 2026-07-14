import esbuild from 'esbuild';

const r = await esbuild.build({
  entryPoints: ['main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'bundle-test.js',
  metafile: true,
});

const inputs = r.metafile.outputs['bundle-test.js'].inputs;
const porPacote = {};
for (const [f, v] of Object.entries(inputs)) {
  const m = f.match(/node_modules[\\/]((@[^\\/]+[\\/])?[^\\/]+)/);
  const p = m ? m[1].replace(/\\/g, '/') : 'app';
  porPacote[p] = (porPacote[p] || 0) + v.bytesInOutput;
}
for (const [p, b] of Object.entries(porPacote).sort((a, b) => b[1] - a[1])) {
  console.log(p.padEnd(20), (b / 1024).toFixed(0) + ' KB');
}
