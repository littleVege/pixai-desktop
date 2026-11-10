import { build } from 'esbuild'
const shared = { bundle: true, platform: 'node', target: 'node22', sourcemap: true, packages: 'external', logLevel: 'info' }
await Promise.all([
  build({ ...shared, entryPoints: ['electron/main.ts', 'electron/worker.ts'], outdir: 'dist-electron', format: 'esm' }),
  build({ ...shared, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', format: 'cjs' }),
])
