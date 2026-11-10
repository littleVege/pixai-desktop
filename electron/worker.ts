import { StudioStore } from './store'
import { StudioService } from './service'
import { CreativeAgent } from './agent'
import { installSystemNetwork } from './network'
import { searchRecipes } from './recipe-directory'
import { randomUUID } from 'node:crypto'

type Port = { on: (event: 'message', listener: (event: { data: any }) => void) => void; postMessage: (data: unknown) => void }
const port = (process as typeof process & { parentPort: Port }).parentPort
const networkPending = new Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }>()
installSystemNetwork(url => new Promise((resolve, reject) => {
  const id = randomUUID()
  const timer = setTimeout(() => { networkPending.delete(id); reject(new Error('系统代理解析超时')) }, 10_000)
  networkPending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject: error => { clearTimeout(timer); reject(error) } })
  port.postMessage({ type: 'resolve-proxy', id, url })
}))
const store = new StudioStore(process.env.STUDIO_DATA_DIR!)
let credentials = { pixaiKey: '', llmKey: '', llmBaseUrl: '', llmModel: '', visionBaseUrl: '', visionModel: '', visionKey: '' }
const changed = () => port.postMessage({ type: 'changed' })
const service = new StudioService(store, () => credentials, changed)
const streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>()
const encoder = new TextEncoder()
const planPending = new Map<string, (data: { value?: unknown; error?: string }) => void>()
const agent = new CreativeAgent(store, service, () => credentials, changed, async (_input, init) => {
  const id = randomUUID()
  const signal = AbortSignal.any([AbortSignal.timeout(95000), ...(init?.signal ? [init.signal] : [])])
  signal.throwIfAborted()
  const body = JSON.parse(String(init?.body))
  return new Promise<Response>((resolve, reject) => {
    const abort = () => { streams.get(id)?.error(signal.reason); streams.delete(id); planPending.delete(id); port.postMessage({ type: 'cancel-plan', id }); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    if (body.stream) {
      const stream = new ReadableStream<Uint8Array>({ start(controller) { streams.set(id, controller) },
        cancel() { streams.delete(id); abort() } })
      resolve(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }))
    }
    planPending.set(id, data => {
      signal.removeEventListener('abort', abort)
      planPending.delete(id)
      if (body.stream) {
        const stream = streams.get(id)
        streams.delete(id)
        if (data.error) stream?.error(new Error(data.error))
        else stream?.close()
        return
      }
      if (data.error) reject(new Error(data.error))
      else resolve(Response.json(data.value))
    })
    port.postMessage({ type: 'plan-response', id, body })
  })
})

async function call(method: string, input: any = {}) {
  switch (method) {
    case 'importReference': return service.importReference(input)
    case 'assetInfo': {
      const asset = store.get(input.assetId)
      if (!asset || asset.kind !== 'asset') throw new Error('图片不存在')
      return { filename: asset.data.filename }
    }
    case 'startAgent': {
      const run = agent.start(input)
      const cleared = store.clearSubmittedPrompt(input.workId, input.submittedRevision, run.id)
      changed()
      return { ...run, cleared }
    }
    case 'continueAgent': return agent.resume(input.runId)
    case 'enhancePrompt': return agent.enhance(input)
    case 'checkCapabilities': return agent.checkCapabilities()
    case 'snapshot': return service.snapshot(input.workId)
    case 'createWork': return service.createWork(String(input.title ?? ''), input.draft)
    case 'saveDraft': { const result = store.saveDraft(input.workId, input.draft, input.expectedRevision, input.promptAction); changed(); return result }
    case 'restoreRevision': { const result = store.restoreRevision(input.workId, input.revisionId, input.expectedRevision, input.assetId); changed(); return result }
    case 'moveWork': { const result = store.moveWork(input.workId, input.libraryState); changed(); return result }
    case 'renameWork': { const result = store.renameWork(input.workId, input.title); changed(); return result }
    case 'generate': {
      const job = await service.generate(input.workId, input.request, input.snapshot)
      const cleared = !!job?.data.remoteId && store.clearSubmittedPrompt(input.workId, input.submittedRevision)
      changed()
      return { ...job, cleared }
    }
    case 'chooseExperiment': return service.chooseExperiment(input)
    case 'reconcileJob': return service.reconcileJob(input)
    case 'savePreset': { const result = store.create('preset', { title: input.title, snapshot: input.snapshot }); changed(); return result }
    case 'savePreference': { const result = store.savePreference(input.text, input.id); changed(); return result }
    case 'confirmSave': { const result = store.confirmSave(input.messageId, input.accept); changed(); return result }
    case 'setPreferenceActive': { const result = store.setPreferenceActive(input.id, input.active); changed(); return result }
    case 'pauseRun': return agent.pause(input.runId)
    case 'searchRecipes': return searchRecipes(input, credentials.pixaiKey)
    case 'searchModels': {
      if (!credentials.pixaiKey) throw new Error('请先配置 PixAI Key')
      const query = new URLSearchParams({ usageType: input.type === 'LORA' ? 'LORA' : 'MODEL', size: '50' })
      if (input.keyword) query.set('keyword', String(input.keyword))
      if (input.baseModelType) query.set('loraBaseModelTypes', String(input.baseModelType))
      const response = await fetch(`https://api.pixai.art/v2/generation-model/search?${query}`, { headers: { Authorization: `Bearer ${credentials.pixaiKey}` }, signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`模型目录请求失败 (${response.status})`)
      return response.json()
    }
    default: throw new Error(`尚未实现的操作: ${method}`)
  }
}
port.on('message', async ({ data }) => {
  if (data.type === 'proxy-result') {
    const pending = networkPending.get(data.id); networkPending.delete(data.id)
    if (data.error) pending?.reject(new Error(data.error)); else pending?.resolve(data.value)
    return
  }
  if (data.type === 'plan-event') { streams.get(data.id)?.enqueue(encoder.encode('data: ' + JSON.stringify(data.event) + '\n\n')); return }
  if (data.type === 'plan-result') { planPending.get(data.id)?.(data); return }
  if (data.type === 'credentials') { credentials = data.value; return }
  if (data.type !== 'call') return
  try { port.postMessage({ type: 'result', id: data.id, value: await call(data.method, data.input) }) }
  catch (error) { port.postMessage({ type: 'result', id: data.id, error: error instanceof Error ? error.message : '操作失败' }) }
})
service.start()
agent.watch()
port.postMessage({ type: 'ready' })
