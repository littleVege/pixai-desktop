import { app, utilityProcess } from 'electron'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

// Exercise the actual Electron utility-process transport and native database.
// Uses disposable local data and never submits an external request.
async function main() {
const directory = await mkdtemp(join(tmpdir(), 'pixai-electron-smoke-'))
let worker
let sequence = 0
const pending = new Map()
const deadline = setTimeout(() => { console.error('Electron runtime smoke timed out'); worker?.kill(); app.exit(1) }, 25_000)
function call(method, input) {
  return new Promise((resolve, reject) => {
    const id = String(++sequence)
    pending.set(id, { resolve, reject })
    worker.postMessage({ type: 'call', id, method, input })
  })
}
function launchWorker() {
  return new Promise((resolveReady, rejectReady) => {
    worker = utilityProcess.fork(resolve('dist-electron/worker.js'), [], { env: { ...process.env, STUDIO_DATA_DIR: directory }, stdio: 'pipe', serviceName: 'PixAI Runtime Smoke' })
    worker.stderr.on('data', bytes => process.stderr.write(bytes))
    worker.on('exit', code => { if (code) rejectReady(new Error(`Runtime exited ${code}`)) })
    worker.on('message', message => {
      if (message.type === 'ready') { console.log('Smoke stage: utility ready'); resolveReady() }
      if (message.type === 'result') {
        const request = pending.get(message.id); pending.delete(message.id)
        if (message.error) request?.reject(new Error(message.error)); else request?.resolve(message.value)
      }
    })
  })
}
async function stopWorker() {
  await new Promise(resolveExit => { worker.once('exit', resolveExit); worker.kill() })
}
console.log('Smoke stage: waiting for Electron app ready')
await app.whenReady()
console.log('Smoke stage: app ready')
try {
  await launchWorker()
  const work = await call('createWork', { title: 'Runtime smoke', draft: { references: [], scenes: {} } })
  await call('saveDraft', { workId: work.id, draft: { references: [], scenes: { sample: { id: 'sample' } }, prompt: 'saved across process restart' }, expectedRevision: 0 })
  await stopWorker()
  await launchWorker()
  const snapshot = await call('snapshot', { workId: work.id })
  assert.equal(snapshot.works[0].data.draftRevision, 1)
  assert.equal(snapshot.works[0].data.draft.prompt, 'saved across process restart')
  assert.equal(snapshot.works[0].data.draft.scenes.sample.id, 'sample')
  assert.equal(snapshot.jobs.length, 0)
  await stopWorker()
  console.log('PASS: Electron utility IPC, native SQLite, draft and scene persistence across runtime restart')
  clearTimeout(deadline)
  await rm(directory, { recursive: true, force: true })
  app.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Runtime smoke failed')
  clearTimeout(deadline)
  worker?.kill()
  app.exit(1)
}

}
void main().catch(error => { console.error(error.message); app.exit(1) })
