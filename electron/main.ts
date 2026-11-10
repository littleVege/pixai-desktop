import { app, BrowserWindow, ipcMain, utilityProcess, nativeImage, safeStorage, protocol, net, dialog, session } from 'electron'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { chatgpt, planResponse } from './chatgpt'
import dotenv from 'dotenv'

dotenv.config({ path: join(process.cwd(), '.env'), quiet: true })
protocol.registerSchemesAsPrivileged([{ scheme: 'studio-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
let window: BrowserWindow | null = null
let worker: ReturnType<typeof utilityProcess.fork> | undefined
let ready = false
let quitting = false
let restartDelay = 250
let restartTimer: ReturnType<typeof setTimeout> | undefined
let credentials = { chatgptModel: '', modelService: 'apiKey', pixaiKey: process.env.PIXAI_API_KEY ?? '', llmKey: process.env.LLM_MODEL_API_KEY ?? '', llmBaseUrl: process.env.LLM_MODEL_BASE_URL ?? '', llmModel: process.env.LLM_MODEL_NAME ?? '', visionBaseUrl: process.env.VISION_MODEL_BASE_URL ?? '', visionModel: process.env.VISION_MODEL_NAME ?? '', visionKey: process.env.VISION_MODEL_API_KEY ?? '' }
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

function rpc(method: string, input: unknown) {
  return new Promise((resolve, reject) => {
    if (!worker || !ready) { reject(new Error('本地服务正在恢复，请稍后重试')); return }
    const id = randomUUID()
    pending.set(id, { resolve, reject })
    worker.postMessage({ type: 'call', id, method, input })
  })
}
function showWindow() {
  if (window) { window.show(); return }
  window = new BrowserWindow({ width: 1480, height: 980, minWidth: 960, minHeight: 680, title: 'PixAI Desktop', titleBarStyle: 'hiddenInset', backgroundColor: '#ffffff', webPreferences: { preload: join(import.meta.dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.on('close', event => { if (!quitting) { event.preventDefault(); window?.hide() } })
  window.on('closed', () => { window = null })
  if (process.env.VITE_DEV_SERVER_URL) void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  else void window.loadFile(join(import.meta.dirname, '../dist/index.html'))
}
function launchWorker(directory: string) {
  const startedAt = Date.now()
  const child = utilityProcess.fork(join(import.meta.dirname, 'worker.js'), [], { env: { ...process.env, STUDIO_DATA_DIR: directory }, serviceName: 'PixAI Studio Runtime' })
  worker = child
  const requests = new Map<string, AbortController>()
  child.once('exit', () => { for (const controller of requests.values()) controller.abort() })
  child.on('message', async message => {
    if (message.type === 'cancel-plan') { requests.get(message.id)?.abort(); return }
    if (message.type === 'plan-response') {
      const controller = new AbortController()
      requests.set(message.id, controller)
      try {
        if (credentials.modelService !== 'chatgpt') throw new Error('请先选择 ChatGPT 模型服务')
        const value = await planResponse(message.body, AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]),
          event => child.postMessage({ type: 'plan-event', id: message.id, event }))
        child.postMessage({ type: 'plan-result', id: message.id, value })
      } catch (e) { if (!controller.signal.aborted) child.postMessage({ type: 'plan-result', id: message.id, error: e instanceof Error ? e.message : 'ChatGPT 请求失败' }) }
      finally { requests.delete(message.id) }
      return
    }
    if (message.type === 'resolve-proxy') {
      try {
        const url = new URL(message.url)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid network scheme')
        child.postMessage({ type: 'proxy-result', id: message.id, value: await session.defaultSession.resolveProxy(url.origin) })
      } catch { child.postMessage({ type: 'proxy-result', id: message.id, error: '系统代理解析失败' }) }
      return
    }
    if (message.type === 'ready') {
      ready = true
      child.postMessage({ type: 'credentials', value: credentials })
      if (window) window.webContents.send('studio:changed')
      else showWindow()
    }
    if (message.type === 'changed') window?.webContents.send('studio:changed')
    if (message.type === 'result') {
      const request = pending.get(message.id); pending.delete(message.id)
      if (message.error) request?.reject(new Error(message.error)); else request?.resolve(message.value)
    }
  })
  child.once('exit', () => {
    worker = undefined
    ready = false
    for (const request of pending.values()) request.reject(new Error('本地服务已中断，请检查任务状态'))
    pending.clear()
    if (!quitting) {
      if (Date.now() - startedAt > 30_000) restartDelay = 250
      restartTimer = setTimeout(() => launchWorker(directory), restartDelay)
      restartDelay = Math.min(restartDelay * 2, 30_000)
    }
  })
}

async function initialize() {
await app.whenReady()
// Route OAuth, token refresh and model discovery through the macOS system proxy.
globalThis.fetch = (input, init) => net.fetch(input instanceof URL ? input.href : input, init)
const directory = process.env.STUDIO_DATA_DIR ?? join(app.getPath('userData'), 'studio')
const credentialPath = join(app.getPath('userData'), 'credentials.bin')
if (existsSync(credentialPath)) {
  try { credentials = { ...credentials, ...JSON.parse(safeStorage.decryptString(readFileSync(credentialPath))) } } catch { /* Settings remains available for restoring credentials. */ }
}
protocol.handle('studio-asset', async request => {
  const url = new URL(request.url)
  const name = decodeURIComponent(url.pathname.slice(1))
  if (!name || name === '.' || name === '..' || name !== basename(name)) return new Response('Invalid asset', { status: 400 })
  const original = join(directory, 'assets', name)
  if (url.searchParams.get('view') !== 'thumbnail') return net.fetch(pathToFileURL(original).href)
  const cache = join(directory, 'thumbnails')
  const path = join(cache, name + '.jpg')
  if (!existsSync(path)) {
    const temp = path + '.' + randomUUID() + '.part'
    try {
      const preview = await nativeImage.createThumbnailFromPath(original, { width: 512, height: 512 })
      if (preview.isEmpty()) return net.fetch(pathToFileURL(original).href)
      await mkdir(cache, { recursive: true })
      const bitmap = nativeImage.createFromBuffer(preview.toPNG())
      const { width, height } = bitmap.getSize()
      const scale = Math.min(1, 512 / Math.max(width, height))
      const thumbnail = bitmap.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) })
      await writeFile(temp, thumbnail.toJPEG(85))
      await rename(temp, path)
    } catch { return net.fetch(pathToFileURL(original).href) }
  }
  return net.fetch(pathToFileURL(path).href)
})
launchWorker(directory)
ipcMain.handle('studio:call', async (event, { method, input }) => {
  if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Invalid caller')
  if (method === 'chatgptLogin') return chatgpt.signIn()
  if (method === 'chatgptCancel') return chatgpt.cancelSignIn()
  if (method === 'chatgptLogout') return chatgpt.disconnect()
  if (method === 'chatgptModels') return chatgpt.listModels()
  if (method === 'chatgptUsage') return (await import('electron')).shell.openExternal('https://chatgpt.com/settings/usage')
  if (method === 'settings') return { modelService: credentials.modelService, chatgptModel: credentials.chatgptModel, chatgptSession: await chatgpt.getSession(), pixaiConfigured: !!credentials.pixaiKey, llmConfigured: !!credentials.llmKey, llmBaseUrl: credentials.llmBaseUrl, llmModel: credentials.llmModel, visionBaseUrl: credentials.visionBaseUrl, visionModel: credentials.visionModel, visionConfigured: !!credentials.visionKey }
  if (method === 'exportAsset') {
    const asset = await rpc('assetInfo', input) as { filename: string }
    if (asset.filename !== basename(asset.filename)) throw new Error('图片路径无效')
    const result = await dialog.showSaveDialog(window!, { defaultPath: asset.filename, title: '导出原始图片' })
    if (result.canceled || !result.filePath) return { canceled: true }
    await copyFile(join(directory, 'assets', asset.filename), result.filePath)
    return { saved: true }
  }
  if (method === 'saveSettings') {
    const next = { ...credentials }
    if (input.modelService === 'apiKey' || input.modelService === 'chatgpt') next.modelService = input.modelService
    if (next.modelService === 'chatgpt' && (!(await chatgpt.getSession()).sharing || !input.chatgptModel?.trim())) throw new Error('请先授权使用 ChatGPT 套餐并选择模型')
    for (const key of ['chatgptModel', 'pixaiKey', 'llmKey', 'llmBaseUrl', 'llmModel', 'visionBaseUrl', 'visionModel', 'visionKey'] as const) if (typeof input?.[key] === 'string') next[key] = input[key]
    for (const value of [next.llmBaseUrl, next.visionBaseUrl]) {
      if (value && !['https:', 'http:'].includes(new URL(value).protocol)) throw new Error('模型服务地址无效')
    }
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统凭证加密不可用')
    writeFileSync(credentialPath, safeStorage.encryptString(JSON.stringify(next)), { mode: 0o600 })
    credentials = next
    worker?.postMessage({ type: 'credentials', value: credentials }); return { saved: true }
  }
  return rpc(method, input)
})
app.on('activate', showWindow)
app.on('before-quit', () => { quitting = true; clearTimeout(restartTimer); worker?.kill() })

}
void initialize().catch(error => { console.error('PixAI startup failed:', error instanceof Error ? error.message : 'unknown error'); app.exit(1) })
