import { randomUUID } from 'node:crypto'
import { writeFile, rename, readFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import { StudioStore } from './store'
import { createPixaiClient, mediaIdsFromOutputs, bestUrl, SUCCEEDED, FAILED } from '../server/pixai'
import { toTaskParameters, type GenerateRequest } from '../server/taskParams'
import { z } from 'zod'

export class StudioService {
  private busy = false
  private timer?: ReturnType<typeof setInterval>
  constructor(readonly store: StudioStore, private credentials: () => { pixaiKey: string }, private changed: () => void) {}
  start() {
    this.store.recover()
    this.timer = setInterval(() => void this.poll(), 3000)
    void this.poll()
  }
  stop() { if (this.timer) clearInterval(this.timer) }
  snapshot(workId?: string) {
    return {
      works: this.store.worksOverview(),
      revisions: workId ? this.store.list('revision', workId) : [],
      jobs: workId ? this.store.list('job', workId) : [],
      assets: workId ? this.store.list('asset', workId) : [],
      runs: workId ? this.store.list('run', workId) : [],
      messages: workId ? this.store.list('message', workId) : [],
      presets: this.store.list('preset'), preferences: this.store.list('preference'),
    }
  }
  createWork(title: string, draft: unknown) {
    const work = this.store.create('work', { title: title.trim() || '未命名作品', draft, draftRevision: 0 })
    this.changed(); return work
  }
  private client() {
    const key = this.credentials().pixaiKey
    if (!key) throw new Error('请先配置 PixAI API Key')
    return createPixaiClient(key)
  }
  async reconcileJob(raw: unknown) {
    const input = z.discriminatedUnion('action', [
      z.object({ jobId: z.string().min(1), action: z.literal('link'), remoteId: z.string().trim().regex(/^\d+$/, '请输入远程任务 ID') }),
      z.object({ jobId: z.string().min(1), action: z.literal('stopTracking') }),
    ]).parse(raw)
    const checkJob = () => {
      const job = this.store.get(input.jobId)
      if (!job || job.kind !== 'job' || (job.data.status !== 'unknown' && job.data.resolution !== 'tracking-stopped')) throw new Error('任务状态已更新，请刷新后重试')
      return job
    }
    checkJob()
    if (input.action === 'link') {
      const remote = await this.client().task(input.remoteId)
      if (remote.id !== input.remoteId) throw new Error('返回的远程任务 ID 不一致')
    }
    const result = this.store.db.transaction(() => {
      checkJob()
      if (input.action === 'link') {
        if (this.store.list('job').some(job => job.id !== input.jobId && job.data.remoteId === input.remoteId)) throw new Error('这个远程任务已经关联到其他任务')
        return this.store.update(input.jobId, { remoteId: input.remoteId, status: 'waiting', saveStatus: 'pending', error: null, retryAt: 0, retryAttempts: 0, resolution: 'user-linked', resolvedAt: new Date().toISOString() })
      }
      return this.store.update(input.jobId, { status: 'failed', resolution: 'tracking-stopped', error: '用户结束本地跟踪；远程状态未确认，已提交额度保留', resolvedAt: new Date().toISOString() })
    })()
    this.changed()
    return result
  }
  async importReference(input: { bytes: number[]; contentType: string; name?: string; workId?: string; scene?: unknown }) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.contentType)) throw new Error('支持 PNG、JPEG 和 WebP 图片')
    if (!Array.isArray(input.bytes) || !input.bytes.length || input.bytes.length > 30 * 1024 * 1024) throw new Error('图片大小需在 30 MB 以内')
    const id = randomUUID()
    const extension = input.contentType.split('/')[1]
    const filename = `${id}.${extension}`
    await writeFile(join(this.store.directory, 'assets', filename), Buffer.from(input.bytes))
    let sceneFilename: string | undefined
    if (input.scene) {
      sceneFilename = `${id}.json`
      const scenes = join(this.store.directory, 'scenes')
      await mkdir(scenes, { recursive: true })
      await writeFile(join(scenes, sceneFilename), JSON.stringify(input.scene))
    }
    this.store.create('asset', { filename, sceneFilename, contentType: input.contentType, source: 'upload', name: input.name }, input.workId ?? null, id)
    this.changed()
    return { id, assetId: id, filename, url: `studio-asset://local/${filename}`, source: 'upload', name: input.name }
  }
  async prepareReferences(snapshot: any) {
    const ids: string[] = []
    for (const reference of snapshot?.references ?? []) {
      if (reference.mediaId) { ids.push(reference.mediaId); continue }
      const asset = this.store.get(reference.assetId ?? reference.id)
      if (!asset || asset.kind !== 'asset') throw new Error('参考图尚未保存，请等待保存完成')
      if (asset.data.mediaId) { ids.push(String(asset.data.mediaId)); continue }
      const bytes = await readFile(join(this.store.directory, 'assets', String(asset.data.filename)))
      const media = await this.client().uploadImage(new Uint8Array(bytes), String(asset.data.contentType ?? 'image/png'))
      this.store.update(asset.id, { mediaId: media.id, width: media.width, height: media.height })
      ids.push(media.id)
    }
    return ids
  }
  async generate(workId: string, request: GenerateRequest, snapshot: unknown, options: { runId?: string; dispatchId?: string; revisionId?: string } = {}) {
    const client = this.client()
    const initialWork = this.store.get(workId)
    if (!initialWork || initialWork.kind !== 'work') throw new Error('作品不存在')
    if (options.runId && this.store.get(options.runId)?.workId !== workId) throw new Error('执行不属于当前作品')
    request = { ...request, contextImages: await this.prepareReferences(snapshot) }
    const parameters = toTaskParameters(request)
    const work = this.store.get(workId)
    if (!work || work.kind !== 'work') throw new Error('作品不存在')
    const jobId = randomUUID()
    const prepared = this.store.db.transaction(() => {
    if (options.runId) {
      const reservation = this.store.reserveGeneration(options.runId, jobId, request.batchSize, options.dispatchId ?? jobId)
      if (reservation.reused) return { reused: true, jobId: reservation.jobId }
    }
    const revision = options.revisionId ? this.store.get(options.revisionId) : this.store.create('revision', {
      snapshot, request, parentId: work.data.baseRevisionId ?? null,
    }, workId)
    if (!revision || revision.kind !== 'revision' || revision.workId !== workId) throw new Error('版本无效')
    this.store.create('job', {
      revisionId: revision.id, runId: options.runId ?? null, request, parameters,
      status: 'submitting', saveStatus: 'pending', transport: 'graphql', remoteId: null,
    }, workId, jobId)
    return { reused: false, jobId }
    })()
    if (prepared.reused) return this.store.get(prepared.jobId)
    this.changed()
    try {
      const remoteId = await client.createTask(parameters)
      this.store.update(jobId, { remoteId, status: 'waiting' })
    } catch (error) {
      this.store.update(jobId, { status: 'unknown', error: error instanceof Error ? error.message : '提交结果不明' })
      if (options.runId) this.store.update(options.runId, { status: 'paused', reason: '提交结果不明，已暂停后续生成' })
    }
    this.changed()
    return this.store.get(jobId)
  }
  private async experimentPreviews(items: { mediaId: string }[] | null) {
    return Promise.all((items ?? []).map(async ({ mediaId }) => {
      if (!/^\d+$/.test(mediaId)) throw new Error('候选图片 ID 无效')
      const prefix = `experiment-${mediaId}`
      const formats: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif', 'image/gif': 'gif' }
      for (const extension of Object.values(formats)) {
        const filename = prefix + '.' + extension
        try { await access(join(this.store.directory, 'assets', filename)); return { mediaId, filename } }
        catch { /* A different format may already be cached. */ }
      }
      const media = await this.client().media(mediaId)
      const url = media.urls.find(item => item.variant === 'THUMBNAIL')?.url ?? bestUrl(media)
      if (!url) throw new Error('候选预览暂不可用')
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      const extension = formats[response.headers.get('content-type')?.split(';')[0] ?? '']
      if (!response.ok || !extension) throw new Error('候选预览下载失败')
      const filename = prefix + '.' + extension
      const path = join(this.store.directory, 'assets', filename)
      const temporary = path + '.' + randomUUID() + '.part'
      await writeFile(temporary, new Uint8Array(await response.arrayBuffer()))
      await rename(temporary, path)
      return { mediaId, filename }
    }))
  }
  private choosing = new Set<string>()
  async chooseExperiment(raw: unknown) {
    const { jobId, choice } = z.object({ jobId: z.string(), choice: z.enum(['picked_left', 'picked_right', 'tie', 'skip']) }).parse(raw)
    const job = this.store.get(jobId)
    if (job?.kind !== 'job' || job.data.status !== 'selecting' || !job.data.remoteId || this.choosing.has(jobId)) throw new Error('任务状态已改变，请刷新后重试')
    this.choosing.add(jobId)
    try {
      await this.client().chooseExperiment(String(job.data.remoteId), choice)
      this.store.update(jobId, { status: 'waiting', experiment: null, choiceSubmitted: true, retryAt: 0 })
    } finally {
      this.choosing.delete(jobId)
      this.changed()
    }
  }
  async poll() {
    if (this.busy || !this.credentials().pixaiKey) return
    this.busy = true
    try {
      const client = this.client()
      for (const job of this.store.list('job')) {
        if (!job.data.remoteId || ['failed', 'unknown'].includes(String(job.data.status)) || job.data.saveStatus === 'saved') continue
        if (Number(job.data.retryAt ?? 0) > Date.now()) continue
        try {
          const task = await client.task(String(job.data.remoteId))
          const status = String(task.status ?? 'waiting').toLowerCase()
          const now = Date.now()
          const checked = { checkedAt: new Date(now).toISOString(), remoteUpdatedAt: task.updatedAt }
          if (FAILED.has(status)) { this.store.update(job.id, { ...checked, status: 'failed', error: `远程任务 ${status}` }); this.changed(); continue }
          const sinceUpdate = now - Date.parse(task.updatedAt || job.createdAt)
          const interval = sinceUpdate >= 3_600_000 ? 60_000 : sinceUpdate >= 600_000 ? 30_000 : sinceUpdate >= 60_000 ? 10_000 : 3_000
          // The root can remain running until the user selects one of the experiment outputs.
          // Inspect the session separately and leave the ordinary task as the authority on final output.
          if (!SUCCEEDED.has(status) && !job.data.choiceSubmitted && !this.choosing.has(job.id)
            && now >= Number(job.data.checkExperimentAt ?? 0)) {
            const session = await client.experiment(String(job.data.remoteId))
            if (this.store.get(job.id)?.data.choiceSubmitted || this.choosing.has(job.id)) continue
            if (session?.status === 'selecting') {
              this.store.update(job.id, { ...checked, status: 'selecting' })
              const [left, right] = await Promise.all([this.experimentPreviews(session.leftMedias), this.experimentPreviews(session.rightMedias)])
              if (this.store.get(job.id)?.data.choiceSubmitted || this.choosing.has(job.id)) continue
              this.store.update(job.id, { ...checked, status: 'selecting', experiment: { left, right },
                error: null, retryAttempts: 0, retryAt: now + 10000 })
              this.changed()
              continue
            }
            this.store.update(job.id, { experiment: null, checkExperimentAt: now + (session?.status === 'pending' ? 3000 : 30000) })
          }
          this.store.update(job.id, { ...checked, status: SUCCEEDED.has(status) ? 'completed' : status, outputs: task.outputs, error: null, retryAt: now + interval, retryAttempts: 0 })
          if (SUCCEEDED.has(status)) {
            this.store.update(job.id, { saveStatus: 'downloading' })
            for (const mediaId of mediaIdsFromOutputs(task.outputs)) {
              const assetId = `${job.id}-${mediaId}`
              if (this.store.get(assetId)) continue
              const media = await client.media(mediaId)
              const url = bestUrl(media)
              if (!url) throw new Error('图片下载地址暂不可用')
              const response = await fetch(url, { signal: AbortSignal.timeout(120_000) })
              if (!response.ok) throw new Error(`图片下载失败 (${response.status})`)
              const bytes = Buffer.from(await response.arrayBuffer())
              const extension = response.headers.get('content-type')?.includes('webp') ? 'webp' : response.headers.get('content-type')?.includes('jpeg') ? 'jpg' : 'png'
              const filename = `${assetId}.${extension}`
              const path = join(this.store.directory, 'assets', filename)
              await writeFile(`${path}.part`, bytes)
              await rename(`${path}.part`, path)
              this.store.create('asset', { filename, mediaId, width: media.width, height: media.height, jobId: job.id, revisionId: job.data.revisionId, source: 'generation' }, job.workId, assetId)
            }
            if (!mediaIdsFromOutputs(task.outputs).length) throw new Error('任务完成但图片尚未就绪')
            this.store.update(job.id, { saveStatus: 'saved', error: null, retryAt: 0 })
          }
          this.changed()
        } catch (error) {
          const attempts = Number(job.data.retryAttempts ?? 0) + 1
          this.store.update(job.id, { error: error instanceof Error ? error.message : '任务查询失败', retryAttempts: attempts, retryAt: Date.now() + Math.min(60_000, 3000 * 2 ** Math.min(attempts, 5)) })
          this.changed()
        }
      }
    } finally { this.busy = false }
  }
}
