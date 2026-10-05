// Gera um único arquivo HTML autocontido (dist/skyhoop.html) que roda com
// duplo clique, sem servidor: junta CSS, Three.js e todos os módulos de src/.
// Uso: npm run build   (usa esbuild via npx; só é necessário para gerar o arquivo)
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const lib = join(root, 'lib/three');

const resolveThree = {
  name: 'three-local',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(lib, 'three.module.min.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(lib, 'addons', a.path.slice('three/addons/'.length)) }));
  },
};

const out = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  plugins: [resolveThree],
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile(join(root, 'css/style.css'), 'utf8');
let html = await readFile(join(root, 'index.html'), 'utf8');

html = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace('<link rel="stylesheet" href="css/style.css" />', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n${js}</script>`);

if (html.includes('src/main.js') || html.includes('importmap')) throw new Error('index.html mudou: atualize build.mjs');
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/skyhoop.html'), html);
console.log(`dist/skyhoop.html gerado (${(html.length / 1024).toFixed(0)} KB)`);
