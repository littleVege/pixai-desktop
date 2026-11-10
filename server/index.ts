import Fastify from 'fastify'
import { createPixaiClient, mediaIdsFromOutputs, bestUrl, PixaiError, FAILED, SUCCEEDED } from './pixai.ts'
import { RequestError, toTaskParameters, type GenerateRequest } from './taskParams.ts'

/**
 * Demo backend for the Composer prototype: proxies generation to PixAI with the key from .env,
 * so the key never reaches the browser. Listens on localhost only.
 */
const PORT = Number(process.env.PORT ?? 8787)
const apiKey = process.env.PIXAI_API_KEY ?? ''
const pixai = createPixaiClient(apiKey)
const app = Fastify({ logger: { level: 'info', redact: ['req.headers.authorization'] }, bodyLimit: 15 * 1024 * 1024 })

app.addContentTypeParser(['image/png', 'image/jpeg', 'image/webp'], { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof RequestError) return reply.code(400).send({ error: err.message })
  if (err instanceof PixaiError) return reply.code(err.status).send({ error: err.message })
  app.log.error(err)
  const status = typeof (err as { statusCode?: number }).statusCode === 'number' ? (err as { statusCode: number }).statusCode : 500
  return reply.code(status).send({ error: err instanceof Error ? err.message : 'Internal error' })
})

app.addHook('preHandler', async (req, reply) => {
  if (req.url.startsWith('/api/') && req.url !== '/api/health' && !apiKey) return reply.code(503).send({ error: 'PIXAI_API_KEY is not set in .env' })
})

app.get('/api/health', async () => ({ ok: true, hasKey: apiKey.length > 0 }))

/** Upload one image (raw body) and return its PixAI media id. */
app.post('/api/media', async (req, reply) => {
  const body = req.body
  if (!(body instanceof Buffer) || body.length === 0) return reply.code(400).send({ error: 'Send the image bytes as image/png, image/jpeg or image/webp' })
  const info = await pixai.uploadImage(new Uint8Array(body), req.headers['content-type'] ?? 'image/png')
  return { mediaId: info.id, width: info.width, height: info.height }
})

app.post<{ Body: GenerateRequest }>('/api/generate', async req => {
  const parameters = toTaskParameters(req.body)
  const taskId = await pixai.createTask(parameters)
  req.log.info({ taskId, modelId: parameters.modelId, contextImages: parameters.contextImages }, 'task created')
  return { taskId, parameters }
})

app.get<{ Params: { id: string } }>('/api/tasks/:id', async req => {
  const task = await pixai.task(req.params.id)
  const status = String(task.status ?? '').toLowerCase()
  const ids = mediaIdsFromOutputs(task.outputs)
  const failed = FAILED.has(status)
  const done = !failed && (SUCCEEDED.has(status) || ids.length > 0)
  const images = done ? await Promise.all(ids.map(async id => ({ mediaId: id, url: bestUrl(await pixai.media(id)) }))) : []
  const error = failed ? String((task.outputs as { task_status_msg?: unknown } | null)?.task_status_msg ?? status) : undefined
  return { id: task.id, status, done, failed, error, images }
})

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy
app.log.info({ hasKey: apiKey.length > 0, proxy: proxy ? 'from HTTPS_PROXY' : 'none', envProxy: process.env.NODE_USE_ENV_PROXY ?? process.execArgv.includes('--use-env-proxy') }, 'config')
app.listen({ port: PORT, host: '127.0.0.1' }).catch(err => { app.log.error(err); process.exit(1) })
