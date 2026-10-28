// Production bundle for a Node app in this monorepo: workspace packages (@tunely/*) are compiled
// into the bundle (they ship TypeScript source), npm packages stay external and are installed in
// the image. Usage, from an app directory: node ../../scripts/bundle.mjs src/index.ts [more entries]
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkg = (path) => JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'));
const app = pkg(process.cwd());

// npm dependencies of the app and of every workspace package it uses, recursively.
const external = new Set();
const visit = (p) => {
  for (const name of Object.keys(p.dependencies ?? {})) {
    if (name.startsWith('@tunely/')) visit(pkg(resolve(root, 'packages', name.slice('@tunely/'.length))));
    else external.add(name);
  }
};
visit(app);

await build({
  entryPoints: process.argv.slice(2),
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  // Subpath imports (drizzle-orm/pg-core) are external too.
  external: [...external].flatMap((name) => [name, `${name}/*`]),
  // Lets bundled ESM use require() for any CommonJS dependency that needs it.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
