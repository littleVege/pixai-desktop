import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electron from 'electron'
await import('./build-electron.mjs')
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: false } })
await server.listen()
const url = server.resolvedUrls.local[0]
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } })
child.on('exit', async code => { await server.close(); process.exit(code ?? 0) })
process.on('SIGINT', () => child.kill())
