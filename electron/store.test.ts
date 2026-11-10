import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StudioStore } from './store'

const opened: StudioStore[] = []
function fixture() {
  const store = new StudioStore(mkdtempSync(join(tmpdir(), 'pixai-store-')))
  opened.push(store)
  const work = store.create('work', { title: 'test', draftRevision: 0 })
  const run = store.create('run', { status: 'planning', maxImages: 2, maxModelCalls: 1 }, work.id)
  return { store, work, run }
}
afterEach(() => { for (const store of opened.splice(0)) { store.close(); rmSync(store.directory, { recursive: true, force: true }) } })
describe('durable creative execution', () => {
  it('recognizes both visual tools by their persisted observations and requires every saved image in the round', () => {
    const { store, work, run } = fixture()
    store.update(run.id, { lastRevisionId: 'latest' })
    const job = store.create('job', { runId: run.id, revisionId: 'latest', status: 'completed', saveStatus: 'saved' }, work.id)
    const image = () => store.create('asset', { source: 'generation', jobId: job.id }, work.id).id
    const first = image(), second = image()
    const observe = (runId: string, assetId: string) => store.create('message', { runId, type: 'inspection', assetIds: [assetId] }, work.id)
    observe(run.id, first)
    observe('other-run', second)
    store.syncInspection(run.id)
    expect(store.get(run.id)?.data.inspectedRevisionId).toBeUndefined()
    observe(run.id, second)
    store.syncInspection(run.id)
    expect(store.get(run.id)?.data.inspectedRevisionId).toBe('latest')
  })
  it('records the specific selected image only when the draft restore commits', () => {
    const { store, work } = fixture()
    const source = store.create('revision', { snapshot: {} }, work.id)
    const asset = store.create('asset', { source: 'generation', revisionId: source.id }, work.id)
    const unrelated = store.create('asset', { source: 'generation', revisionId: 'other' }, work.id)
    expect(() => store.restoreRevision(work.id, source.id, 0, unrelated.id)).toThrow('当前生成版本')
    expect(() => store.restoreRevision(work.id, source.id, 1, asset.id)).toThrow('草稿已更新')
    expect(store.list('message', work.id)).toEqual([])
    expect(store.restoreRevision(work.id, source.id, 0, asset.id).data.selectedAssetId).toBe(asset.id)
    expect(store.list('message', work.id)[0].data).toMatchObject({ type: 'resultSelection', assetId: asset.id, revisionId: source.id })
  })
  it('saves the exact accepted and undone text alongside each draft change', () => {
    const { store, work } = fixture()
    const draft = (text: string) => ({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } })
    store.saveDraft(work.id, draft('雨'), 0)
    store.saveDraft(work.id, draft('细雨'), 1, 'accept')
    store.saveDraft(work.id, draft('雨'), 2, 'undo')
    expect(store.list('message', work.id).map(item => [item.data.action, item.data.before, item.data.after])).toEqual([
      ['undo', '细雨', '雨'], ['accept', '雨', '细雨'],
    ])
    expect(store.activePreferences()).toEqual([])
  })
  it('saves the proposed immutable revision once, even if the work changes before confirmation', () => {
    const { store, work } = fixture()
    const snapshot = { prompt: 'accepted version', lockedContents: ['雨衣'] }
    const source = store.create('revision', { snapshot }, work.id)
    const proposal = store.create('message', { type: 'saveProposal', target: 'preset', text: '雨天', sourceId: source.id, status: 'pending' }, work.id)
    store.saveDraft(work.id, { prompt: 'latest edit' }, 0)
    expect(store.list('preset')).toHaveLength(0)
    store.confirmSave(proposal.id, true)
    store.confirmSave(proposal.id, true)
    expect(store.list('preset').map(item => item.data)).toEqual([{ title: '雨天', snapshot }])
    expect(store.get(proposal.id)?.data.status).toBe('accepted')
  })
  it('keeps skipped preferences inactive and rejects presets from another work', () => {
    const { store, work } = fixture()
    const skipped = store.create('message', { type: 'saveProposal', target: 'preference', status: 'pending', text: '冷色调' }, work.id)
    store.confirmSave(skipped.id, false)
    store.confirmSave(skipped.id, true)
    expect(store.activePreferences()).toEqual([])
    const other = store.create('revision', { snapshot: {} }, 'other-work')
    const wrong = store.create('message', { type: 'saveProposal', target: 'preset', status: 'pending', sourceId: other.id }, work.id)
    expect(() => store.confirmSave(wrong.id, true)).toThrow('生成版本')
    expect(store.list('preset')).toEqual([])
  })
  it('new goals take over only active runs in the same work', () => {
    const { store, work, run } = fixture()
    const complete = store.create('run', { status: 'completed' }, work.id)
    const waiting = store.create('run', { status: 'waiting', imagesSpent: 2 }, work.id)
    const other = store.create('run', { status: 'executing' }, 'other-work')
    store.pauseActiveRuns(work.id, 'new goal', run.id)
    expect(store.get(run.id)?.data.status).toBe('planning')
    expect(store.get(waiting.id)?.data).toMatchObject({ status: 'paused', imagesSpent: 2 })
    expect(store.get(complete.id)?.data.status).toBe('completed')
    expect(store.get(other.id)?.data.status).toBe('executing')
  })
  it('only shares explicitly confirmed, active preferences with model context', () => {
    const { store } = fixture()
    store.create('preference', { text: 'unconfirmed suggestion', active: true })
    const preference = store.savePreference('  soft lighting  ')
    expect(store.activePreferences()).toEqual([{ id: preference.id, text: 'soft lighting' }])
    store.setPreferenceActive(preference.id, false)
    expect(store.activePreferences()).toEqual([])
    store.setPreferenceActive(preference.id, true)
    store.savePreference('cool colors', preference.id)
    expect(store.activePreferences()).toEqual([{ id: preference.id, text: 'cool colors' }])
  })
  it('rejects blank preferences and cannot repurpose another record as a preference', () => {
    const { store, work } = fixture()
    expect(() => store.savePreference(' ')).toThrow('偏好内容')
    expect(() => store.savePreference('x'.repeat(2001))).toThrow('偏好内容')
    expect(() => store.savePreference('new text', work.id)).toThrow('偏好不存在')
    expect(() => store.setPreferenceActive(work.id, true)).toThrow('偏好不存在')
    expect(store.get(work.id)?.data.title).toBe('test')
  })
  it('restores a complete historical draft and records the branch parent atomically', () => {
    const { store, work, run } = fixture()
    const snapshot = { prompt: 'original', scenes: { scene: { camera: 'original' } }, lockedContents: ['silver hair'] }
    const revision = store.create('revision', { snapshot }, work.id)
    const restored = store.restoreRevision(work.id, revision.id, 0)
    expect(restored.data.draft).toEqual(snapshot)
    expect(restored.data.baseRevisionId).toBe(revision.id)
    expect(restored.data.draftRevision).toBe(1)
    expect(store.get(run.id)?.data.status).toBe('paused')
    expect(store.get(revision.id)?.data.snapshot).toEqual(snapshot)
    expect(() => store.restoreRevision(work.id, revision.id, 0)).toThrow('已更新')
    expect(store.get(work.id)?.data.draftRevision).toBe(1)
  })
  it('rejects history from another work without pausing or changing the current work', () => {
    const { store, work, run } = fixture()
    const other = store.create('work', {})
    const revision = store.create('revision', { snapshot: {} }, other.id)
    expect(() => store.restoreRevision(work.id, revision.id, 0)).toThrow('当前作品')
    expect(store.get(work.id)?.data.draftRevision).toBe(0)
    expect(store.get(run.id)?.data.status).toBe('planning')
  })
  it('rejects a dispatch id reused by another run without spending its budget', () => {
    const { store, work, run } = fixture()
    store.reserveGeneration(run.id, 'first', 1, 'dispatch')
    const other = store.create('run', { status: 'planning', maxImages: 2 }, work.id)
    expect(() => store.reserveGeneration(other.id, 'second', 1, 'dispatch')).toThrow('不一致')
    expect(store.get(other.id)?.data.imagesSpent).toBeUndefined()
    expect(() => store.reserveGeneration(run.id, 'first', 2, 'dispatch')).toThrow('不一致')
  })
  it.each([null, -1, 1.5, '6'])('refuses malformed persisted budgets (%s)', value => {
    const { store, run } = fixture()
    store.update(run.id, { maxImages: value, maxModelCalls: value })
    expect(() => store.reserveGeneration(run.id, 'job', 1, 'dispatch')).toThrow('额度无效')
    expect(() => store.reserveModelCall(run.id)).toThrow('额度无效')
    expect(store.get(run.id)?.data.imagesSpent).toBeUndefined()
  })
  it('does not spend model calls while waiting or against a non-run record', () => {
    const { store, work, run } = fixture()
    store.update(run.id, { status: 'waiting' })
    expect(() => store.reserveModelCall(run.id)).toThrow('不可继续')
    expect(() => store.reserveModelCall(work.id)).toThrow('不可继续')
  })
  it('does not spend twice when a dispatch is replayed and refuses over-budget dispatches', () => {
    const { store, run } = fixture()
    expect(store.reserveGeneration(run.id, 'job-1', 2, 'tool-1').reused).toBe(false)
    expect(store.reserveGeneration(run.id, 'job-1', 2, 'tool-1').reused).toBe(true)
    expect(store.get(run.id)?.data.imagesSpent).toBe(2)
    expect(() => store.reserveGeneration(run.id, 'job-2', 1, 'tool-2')).toThrow('上限')
  })
  it('user edits pause execution and stale draft writes cannot overwrite new edits', () => {
    const { store, work, run } = fixture()
    store.saveDraft(work.id, { prompt: 'new' }, 0)
    expect(store.get(run.id)?.data.status).toBe('paused')
    expect(() => store.saveDraft(work.id, {}, 0)).toThrow('已更新')
    expect(() => store.reserveGeneration(run.id, 'job', 1, 'tool')).toThrow('暂停')
  })
  it('preserves unknown submits and budget across restart', () => {
    const { store, work, run } = fixture()
    store.create('job', { status: 'submitting' }, work.id, 'job')
    store.reserveGeneration(run.id, 'job', 1, 'tool')
    store.recover()
    expect(store.get('job')?.data.status).toBe('unknown')
    expect(store.get(run.id)?.data.imagesSpent).toBe(1)
    expect(store.get(run.id)?.data.status).toBe('paused')
  })
  it('enforces immutable revisions and the model call limit', () => {
    const { store, run } = fixture()
    const revision = store.create('revision', { prompt: 'original' })
    expect(() => store.update(revision.id, { prompt: 'changed' })).toThrow('不可修改')
    store.reserveModelCall(run.id)
    expect(() => store.reserveModelCall(run.id)).toThrow('上限')
  })
})

it('archives, trashes and restores a work without losing its history or restarting its agent', () => {
  const { store, work, run } = fixture()
  const message = store.create('message', { role: 'user', text: '保留草图' }, work.id)
  for (const state of ['archived', 'deleted', 'active']) {
    store.moveWork(work.id, state)
    expect(store.worksOverview()[0].data.libraryState).toBe(state)
  }
  expect(store.list('message', work.id)).toEqual([message])
  expect(store.get(run.id)?.data.status).toBe('paused')
  expect(() => store.moveWork(message.id, 'deleted')).toThrow()
})

it('consumes the submitted text without pausing the run or erasing a later edit', () => {
  const { store, work, run } = fixture()
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }] }
  store.update(work.id, { draft: { doc, references: ['ref'] } })
  expect(store.clearSubmittedPrompt(work.id, 0, run.id)).toBe(true)
  expect(store.get(work.id)?.data.draft).toEqual({ doc: { type: 'doc', content: [{ type: 'paragraph' }] }, references: ['ref'] })
  expect(store.get(run.id)?.data.status).toBe('planning')
  store.saveDraft(work.id, { doc }, 0)
  expect(store.clearSubmittedPrompt(work.id, 0)).toBe(false)
  expect(store.get(work.id)?.data.draft).toEqual({ doc })
})
