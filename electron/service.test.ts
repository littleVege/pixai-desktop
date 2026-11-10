import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StudioStore } from './store'
import { StudioService } from './service'
import type { GenerateRequest } from '../server/taskParams'

const remote = vi.hoisted(() => ({ experiment: vi.fn(), chooseExperiment: vi.fn(), createTask: vi.fn(), task: vi.fn(), media: vi.fn(), uploadImage: vi.fn() }))
vi.mock('../server/pixai', async importOriginal => ({ ...await importOriginal<typeof import('../server/pixai')>(), createPixaiClient: () => remote }))
const request: GenerateRequest = { prompt: 'silver-haired knight', modelVersionId: '2024383379556065549', modelType: 'MMDIT26B_MODEL', recipeIds: [], loras: [], contextImages: [], aspectRatio: '1:1', size: '1k', sampling: { method: 'Euler', steps: 25, cfgScale: 5 }, batchSize: 1 }
let store: StudioStore
let service: StudioService
beforeEach(() => {
  vi.resetAllMocks()
  store = new StudioStore(mkdtempSync(join(tmpdir(), 'pixai-service-')))
  service = new StudioService(store, () => ({ pixaiKey: 'test-only' }), () => {})
  remote.createTask.mockResolvedValue('remote-task')
})
afterEach(() => { service.stop(); store.close(); rmSync(store.directory, { recursive: true, force: true }) })
describe('generation lifecycle', () => {
  it('archives scene geometry alongside its rendered reference without changing the image bytes', async () => {
    const scene = { id: 'pose', figures: [{ color: 'red' }], camera: { focalLength: 50 } }
    const ref = await service.importReference({ bytes: [1, 2, 3], contentType: 'image/png', scene })
    const asset = store.get(ref.assetId)!
    expect(JSON.parse(readFileSync(join(store.directory, 'scenes', String(asset.data.sceneFilename)), 'utf8'))).toEqual(scene)
    expect([...readFileSync(join(store.directory, 'assets', ref.filename))]).toEqual([1, 2, 3])
  })
  it('resumes a partially archived batch without downloading a saved output or submitting again', async () => {
    const work = service.createWork('batch', {})
    const job = store.create('job', { remoteId: '123', status: 'running', saveStatus: 'pending' }, work.id)
    remote.task.mockResolvedValue({ status: 'completed', updatedAt: new Date().toISOString(), outputs: { batch: [{ mediaId: '10' }, { mediaId: '11' }] } })
    remote.media.mockImplementation(async (id: string) => ({ urls: [{ variant: 'PUBLIC', url: 'https://example.test/' + id }] }))
    const fetchImage = vi.fn().mockResolvedValueOnce(new Response('first')).mockRejectedValueOnce(new Error('download interrupted')).mockResolvedValueOnce(new Response('second'))
    vi.stubGlobal('fetch', fetchImage)
    try {
      await service.poll()
      expect(store.list('asset', work.id)).toHaveLength(1)
      expect(store.get(job.id)?.data).toMatchObject({ status: 'completed', saveStatus: 'downloading', retryAttempts: 1 })
      store.update(job.id, { retryAt: 0 })
      await service.poll()
      expect(store.get(job.id)?.data.saveStatus).toBe('saved')
      expect(store.list('asset', work.id)).toHaveLength(2)
      expect(remote.media.mock.calls.map(([id]) => id)).toEqual(['10', '11', '11'])
      expect(remote.createTask).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('recovers a running task waiting for an A/B choice and downloads the selected result without resubmission', async () => {
    const work = service.createWork('two candidates', {})
    const job = store.create('job', { remoteId: '123', status: 'running', saveStatus: 'pending' }, work.id)
    remote.task.mockResolvedValue({ status: 'running', updatedAt: new Date().toISOString(), outputs: {} })
    remote.experiment.mockResolvedValue({ status: 'selecting', leftMedias: [{ mediaId: '10', mediaUrl: 'https://example.test/a' }], rightMedias: [{ mediaId: '11', mediaUrl: 'https://example.test/b' }] })
    await service.poll()
    expect(store.get(job.id)?.data.status).toBe('selecting')
    expect(remote.chooseExperiment).not.toHaveBeenCalled()
    await service.chooseExperiment({ jobId: job.id, choice: 'picked_right' })
    expect(remote.chooseExperiment).toHaveBeenCalledWith('123', 'picked_right')
    remote.task.mockResolvedValue({ status: 'completed', outputs: { mediaId: '11' } })
    remote.media.mockResolvedValue({ urls: [{ variant: 'PUBLIC', url: 'https://example.test/b' }] })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('chosen')))
    try {
      await service.poll()
      expect(store.get(job.id)?.data.saveStatus).toBe('saved')
      expect(store.list('asset', work.id).map(asset => asset.data.mediaId)).toEqual(['11'])
      expect(remote.createTask).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })
  it('spaces checks of stale running tasks and resets backoff after connectivity returns', async () => {
    const work = service.createWork('long job', {})
    const job = store.create('job', { remoteId: '123', status: 'running', retryAttempts: 5 }, work.id)
    const updatedAt = new Date(Date.now() - 9 * 3_600_000).toISOString()
    remote.task.mockResolvedValue({ id: '123', status: 'running', updatedAt, outputs: {} })
    const before = Date.now()
    await service.poll()
    const data = store.get(job.id)!.data
    expect(data).toMatchObject({ status: 'running', remoteUpdatedAt: updatedAt, retryAttempts: 0, error: null })
    expect(Date.parse(String(data.checkedAt))).toBeGreaterThanOrEqual(before)
    expect(Number(data.retryAt)).toBeGreaterThanOrEqual(before + 60_000)
    await service.poll()
    expect(remote.task).toHaveBeenCalledTimes(1)
    expect(remote.createTask).not.toHaveBeenCalled()
  })
  it('links a verified remote task without resubmitting or resuming the agent', async () => {
    const work = service.createWork('work', {})
    const run = store.create('run', { status: 'paused', imagesSpent: 1, maxImages: 2 }, work.id)
    const job = store.create('job', { status: 'unknown', runId: run.id }, work.id)
    remote.task.mockResolvedValue({ id: '123', status: 'running' })
    await service.reconcileJob({ jobId: job.id, action: 'link', remoteId: '123' })
    expect(store.get(job.id)?.data).toMatchObject({ remoteId: '123', status: 'waiting', resolution: 'user-linked' })
    expect(store.get(run.id)?.data).toMatchObject({ status: 'paused', imagesSpent: 1 })
    expect(remote.createTask).not.toHaveBeenCalled()
  })
  it('keeps unknown state when lookup fails and rejects duplicate remote links', async () => {
    const work = service.createWork('work', {})
    const job = store.create('job', { status: 'unknown' }, work.id)
    remote.task.mockRejectedValueOnce(new Error('not found'))
    await expect(service.reconcileJob({ jobId: job.id, action: 'link', remoteId: '123' })).rejects.toThrow('not found')
    expect(store.get(job.id)?.data.status).toBe('unknown')
    store.create('job', { remoteId: '123', status: 'waiting' }, work.id)
    remote.task.mockResolvedValue({ id: '123' })
    await expect(service.reconcileJob({ jobId: job.id, action: 'link', remoteId: '123' })).rejects.toThrow('已经关联')
    expect(store.get(job.id)?.data.status).toBe('unknown')
  })
  it('can stop local tracking and later recover a found task without refunding', async () => {
    const work = service.createWork('work', {})
    const run = store.create('run', { status: 'paused', imagesSpent: 1 }, work.id)
    const job = store.create('job', { status: 'unknown', runId: run.id }, work.id)
    await service.reconcileJob({ jobId: job.id, action: 'stopTracking' })
    await service.poll()
    expect(remote.task).not.toHaveBeenCalled()
    expect(store.get(job.id)?.data).toMatchObject({ status: 'failed', resolution: 'tracking-stopped' })
    remote.task.mockResolvedValue({ id: '123' })
    await service.reconcileJob({ jobId: job.id, action: 'link', remoteId: '123' })
    expect(store.get(run.id)?.data.imagesSpent).toBe(1)
    expect(store.get(job.id)?.data.remoteId).toBe('123')
    expect(remote.createTask).not.toHaveBeenCalled()
  })
  it('freezes a child version after restoring an older result', async () => {
    const work = service.createWork('work', {})
    const parent = store.create('revision', { snapshot: { references: [], prompt: 'old' } }, work.id)
    store.restoreRevision(work.id, parent.id, 0)
    const snapshot = { references: [], prompt: 'new', scenes: { scene: { id: 'scene' } } }
    const job = await service.generate(work.id, request, snapshot)
    const revision = store.get(String(job?.data.revisionId))!
    snapshot.prompt = 'later edit'
    expect(revision.data).toMatchObject({ parentId: parent.id, snapshot: { prompt: 'new', scenes: snapshot.scenes } })
    expect(job?.data).toMatchObject({ remoteId: 'remote-task', status: 'waiting' })
  })
  it('keeps unknown submissions charged and never submits them again during polling', async () => {
    remote.createTask.mockRejectedValue(new Error('connection lost'))
    const work = service.createWork('work', {})
    const run = store.create('run', { status: 'planning', maxImages: 2 }, work.id)
    const job = await service.generate(work.id, request, { references: [] }, { runId: run.id, dispatchId: 'dispatch' })
    await service.poll()
    const replay = await service.generate(work.id, request, { references: [] }, { runId: run.id, dispatchId: 'dispatch' })
    expect(replay?.id).toBe(job?.id)
    expect(remote.createTask).toHaveBeenCalledTimes(1)
    expect(remote.task).not.toHaveBeenCalled()
    expect(store.get(run.id)?.data).toMatchObject({ status: 'paused', imagesSpent: 1 })
    expect(job?.data.status).toBe('unknown')
  })
  it('rejects another work’s run before uploading or spending', async () => {
    const work = service.createWork('first', {})
    const other = service.createWork('second', {})
    const run = store.create('run', { status: 'planning', maxImages: 2 }, other.id)
    await expect(service.generate(work.id, request, { references: [] }, { runId: run.id })).rejects.toThrow('当前作品')
    expect(remote.createTask).not.toHaveBeenCalled()
    expect(remote.uploadImage).not.toHaveBeenCalled()
    expect(store.list('job')).toHaveLength(0)
    expect(store.get(run.id)?.data.imagesSpent).toBeUndefined()
  })
})
