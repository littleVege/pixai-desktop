// Crash only the utility process belonging to this isolated Electron main process.
import { app, BrowserWindow, nativeImage, net } from 'electron'
import Database from 'better-sqlite3'
import { rmSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'

async function main() {
  const entry = pathToFileURL(resolve('dist-electron/main.js')).href
  const dir = await mkdtemp(join(tmpdir(), 'pixai-crash-recovery-'))
  process.chdir(dir)
  app.setPath('userData', dir)
  process.env.STUDIO_DATA_DIR = dir
  for (const key of ['PIXAI_API_KEY', 'LLM_MODEL_API_KEY', 'VISION_MODEL_API_KEY']) process.env[key] = ''
  delete process.env.VITE_DEV_SERVER_URL

  async function until(read) {
    const expires = Date.now() + 15000
    while (Date.now() < expires) {
      const value = await read()
      if (value) return value
      await delay(100)
    }
    throw new Error('Local runtime did not recover in time')
  }
  const runtime = () => app.getAppMetrics().find(metric => metric.name === 'PixAI Studio Runtime')
  const ready = (window) => window.webContents.executeJavaScript('window.studio?.snapshot()?.then(() => true)').catch(() => false)
  let code = 1
  try {
    await import(entry)
    const window = await until(() => BrowserWindow.getAllWindows()[0])
    await until(() => ready(window))
    const image = nativeImage.createFromBitmap(Buffer.alloc(800 * 400 * 4, 255), { width: 800, height: 400 })
    const original = image.toPNG()
    await writeFile(join(dir, 'assets', 'preview.png'), original)
    const cached = await net.fetch('studio-asset://local/preview.png?view=thumbnail')
    const thumb = nativeImage.createFromBuffer(Buffer.from(await cached.arrayBuffer()))
    console.log("Thumbnail response", cached.status, cached.headers.get("content-type"), thumb.getSize())
    assert.ok(thumb.getSize().width > 0 && thumb.getSize().width <= 512)
    const full = await net.fetch('studio-asset://local/preview.png')
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), original)
    const first = await until(runtime)
    const db = new Database(join(dir, 'studio.sqlite'))
    try {
      const put = db.prepare('INSERT INTO entities (id,kind,workId,createdAt,updatedAt,data) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)')
      put.run('work', 'work', null, JSON.stringify({ draftRevision: 1, title: '恢复验证' }))
      put.run('run', 'run', 'work', JSON.stringify({ status: 'waiting', imagesSpent: 2, modelCalls: 3 }))
      put.run('known', 'job', 'work', JSON.stringify({ runId: 'run', status: 'waiting', remoteId: '1001' }))
      put.run('uncertain', 'job', 'work', JSON.stringify({ runId: 'run', status: 'submitting' }))
      window.hide()
      process.kill(first.pid, 'SIGKILL')
      await until(() => { const next = runtime(); return next && next.pid !== first.pid })
      const snapshot = await until(async () => {
        try {
          const data = await window.webContents.executeJavaScript('window.studio.snapshot({workId:"work"})')
          return data.runs[0]?.data.status === 'paused' && data
        } catch { return false }
      })
      assert.equal(snapshot.runs[0].data.imagesSpent, 2)
      assert.equal(snapshot.runs[0].data.modelCalls, 3)
      assert.equal(snapshot.jobs.length, 2)
      assert.equal(snapshot.jobs.find(job => job.id === 'known').data.remoteId, '1001')
      assert.equal(snapshot.jobs.find(job => job.id === 'uncertain').data.status, 'unknown')
      assert.equal(window.isVisible(), false)
      console.log('PASS: utility process replaced, original window IPC reconnected, hidden window preserved, uncertain submission paused and budgets retained')
      code = 0
    } finally { db.close() }
  } catch (error) { console.error(error.message) }
  app.once('will-quit', () => { rmSync(dir, { recursive: true, force: true }); app.exit(code) })
  app.quit()
}

void main().catch(error => { console.error(error.message); app.exit(1) })
