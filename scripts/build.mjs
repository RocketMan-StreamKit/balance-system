import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

mkdirSync(dist, { recursive: true });
copyFileSync(join(root, 'manifest.json'), join(dist, 'manifest.json'));
copyFileSync(join(src, 'logo.svg'), join(dist, 'logo.svg'));

const { build } = await import('esbuild');

await build({
  entryPoints: [join(src, 'index.ts')],
  outfile: join(dist, 'index.js'),
  bundle: true,
  platform: 'neutral',
  format: 'iife',
});
copyFileSync(join(src, 'index.html'), join(dist, 'index.html'));
copyFileSync(join(src, 'style.css'), join(dist, 'style.css'));

await build({
  entryPoints: [join(src, 'app.ts')],
  outfile: join(dist, 'app.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
});
