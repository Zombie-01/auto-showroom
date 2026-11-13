// Produces .vercel/output (Vercel Build Output API v3): static web app + one Node function for /api/*.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const out = '.vercel/output';
const fn = `${out}/functions/api.func`;
rmSync(out, { recursive: true, force: true });

execSync('npm run build -w @showroom/web', { stdio: 'inherit' });
cpSync('apps/web/dist', `${out}/static`, { recursive: true });

mkdirSync(fn, { recursive: true });
await build({
  entryPoints: ['apps/api/src/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['@electric-sql/pglite', 'drizzle-orm/pglite', 'drizzle-orm/pglite/*', 'pg-native'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
cpSync('apps/api/drizzle', `${fn}/drizzle`, { recursive: true });
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: 'module' }));
writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs20.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30, regions: ['sin1'],
}, null, 2));

writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/(draco|basis)/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/api(/.*)?$', dest: '/api' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html', headers: { 'cache-control': 'no-cache' } },
  ],
}, null, 2));
console.log('Vercel build output ready');
