import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CreativeAgent } from './agent'
import { StudioStore } from './store'
import { StudioService } from './service'
import { promptToDoc } from '../src/lib/promptSerialize'
import { describe, expect, it } from 'vitest'
import type { Entity } from './store'
import { assertGenerationRound, runJobs } from './agent-policy'
function entity(kind: Entity['kind'], id: string, data: Entity['data']): Entity {
  return { kind, id, data, workId: 'work', createdAt: '', updatedAt: '' }
}
const run = entity('run', 'run', { rounds: 1, maxImages: 6, imagesSpent: 2, lastRevisionId: 'latest' })
const job = (data: Entity['data']) => entity('job', 'job', { runId: run.id, revisionId: 'latest', ...data })
describe('agent generation policy', () => {
  it('waits for completed results to be saved before another paid round', () => {
    const jobs = [job({ status: 'completed', saveStatus: 'downloading' })]
    expect(runJobs(jobs, run.id).pending).toBe(true)
    expect(() => assertGenerationRound(run, jobs, 2)).toThrow('等待')
  })
  it('requires inspection of the latest successful revision', () => {
    const jobs = [job({ status: 'completed', saveStatus: 'saved' })]
    expect(() => assertGenerationRound(run, jobs, 2)).toThrow('检查')
    expect(() => assertGenerationRound({ ...run, data: { ...run.data, inspectedRevisionId: 'older' } }, jobs, 2)).toThrow('检查')
    expect(() => assertGenerationRound({ ...run, data: { ...run.data, inspectedRevisionId: 'latest' } }, jobs, 2)).not.toThrow()
  })
  it('does not require visual inspection of a failed round', () => {
    expect(() => assertGenerationRound(run, [job({ status: 'failed' })], 2)).not.toThrow()
  })
  it('refuses unknown submissions and never treats them as pollable', () => {
    const jobs = [job({ status: 'unknown' })]
    expect(runJobs(jobs, run.id)).toMatchObject({ unknown: true, pending: false })
    expect(() => assertGenerationRound(run, jobs, 1)).toThrow('不明')
  })
  it('respects the image and correction caps before making partial submissions', () => {
    expect(() => assertGenerationRound({ ...run, data: { ...run.data, imagesSpent: 5 } }, [], 2)).toThrow('剩余额度')
    expect(() => assertGenerationRound({ ...run, data: { ...run.data, rounds: 3 } }, [], 1)).toThrow('修正上限')
  })
  it('ignores unrelated runs and reports no wait when there are no jobs', () => {
    expect(runJobs([], run.id)).toEqual({ own: [], pending: false, unknown: false })
    expect(() => assertGenerationRound(run, [job({ runId: 'other', status: 'waiting' })], 2)).not.toThrow()
  })
})

it('resumes a restored draft with its new goal, while preserving pending jobs and their inspection requirement', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixai-resume-'))
  const store = new StudioStore(dir)
  const credentials = () => ({ pixaiKey: '', llmKey: '', llmModel: '', llmBaseUrl: '' })
  const service = new StudioService(store, credentials, () => {})
  const agent = new CreativeAgent(store, service, credentials, () => {})
  try {
    const snapshot = { doc: promptToDoc('夜景'), references: [] }
    const work = service.createWork('站台', snapshot)
    const older = store.create('revision', { snapshot: { ...snapshot, doc: promptToDoc('日景') } }, work.id)
    const latest = store.create('revision', { snapshot }, work.id)
    const run = store.create('run', { goal: '夜景', snapshot, status: 'waiting', lastRevisionId: latest.id, imagesSpent: 2, rounds: 1, maxImages: 6 }, work.id)
    const job = store.create('job', { runId: run.id, revisionId: latest.id, status: 'waiting' }, work.id)
    store.restoreRevision(work.id, older.id, 0)
    const resumed = agent.resume(run.id)!
    expect(resumed.data).toMatchObject({ goal: '日景', status: 'waiting', imagesSpent: 2, lastRevisionId: latest.id, nextParentId: older.id })
    expect(store.list('message', work.id)[0].data).toMatchObject({ role: 'user', text: '日景' })
    store.update(job.id, { status: 'completed', saveStatus: 'saved' })
    expect(() => assertGenerationRound(resumed, store.list('job', work.id), 1)).toThrow('检查')
  } finally { agent.stop(); store.close(); rmSync(dir, { recursive: true, force: true }) }
})
