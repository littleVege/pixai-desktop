import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ComposerState } from '../src/types'
import { docToPrompt } from '../src/lib/promptSerialize'

export type RecordKind = 'work' | 'revision' | 'job' | 'asset' | 'run' | 'preset' | 'preference' | 'message'
export interface Entity { id: string; kind: RecordKind; workId: string | null; createdAt: string; updatedAt: string; data: Record<string, unknown> }

function budgetInteger(value: unknown, fallback: number, minimum: number) {
  const number = value === undefined ? fallback : value
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < minimum) throw new Error('执行额度无效')
  return number
}

/** One writer owns this connection; external side effects happen only after transactions commit. */
export class StudioStore {
  readonly db: Database.Database
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true })
    mkdirSync(join(directory, 'assets'), { recursive: true })
    this.db = new Database(join(directory, 'studio.sqlite'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, workId TEXT,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS entities_by_work ON entities(workId, kind, createdAt);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS dispatches (
        id TEXT PRIMARY KEY, runId TEXT NOT NULL, jobId TEXT NOT NULL,
        count INTEGER NOT NULL, createdAt TEXT NOT NULL
      );
    `)
  }
  private decode(row: unknown): Entity | undefined {
    if (!row) return undefined
    const value = row as Omit<Entity, 'data'> & { data: string }
    return { ...value, data: JSON.parse(value.data) }
  }
  get(id: string) { return this.decode(this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id)) }
  worksOverview(): Entity[] {
    const rows = this.db.prepare(`
      SELECT work.*,
        (SELECT count(*) FROM entities rev WHERE rev.kind = 'revision' AND rev.workId = work.id) AS versions,
        (SELECT json_extract(image.data, '$.filename') FROM entities image
         WHERE image.workId = work.id AND image.kind = 'asset' AND json_extract(image.data, '$.source') = 'generation'
         ORDER BY image.createdAt DESC, image.rowid DESC LIMIT 1) AS cover
      FROM entities work WHERE work.kind = 'work' ORDER BY work.updatedAt DESC, work.rowid DESC
    `).all() as Array<{ versions: number; cover: string | null }>
    return rows.map(row => {
      const work = this.decode(row)!
      return { ...work, data: { ...work.data, versionCount: row.versions, coverFilename: row.cover } }
    })
  }
  list(kind: RecordKind, workId?: string): Entity[] {
    const rows = workId === undefined
      ? this.db.prepare('SELECT * FROM entities WHERE kind = ? ORDER BY createdAt DESC, rowid DESC').all(kind)
      : this.db.prepare('SELECT * FROM entities WHERE kind = ? AND workId = ? ORDER BY createdAt DESC, rowid DESC').all(kind, workId)
    return rows.map((row: unknown) => this.decode(row)!)
  }
  create(kind: RecordKind, data: Record<string, unknown>, workId: string | null = null, id: string = randomUUID()): Entity {
    const now = new Date().toISOString()
    this.db.prepare('INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?)').run(id, kind, workId, now, now, JSON.stringify(data))
    return this.get(id)!
  }
  update(id: string, patch: Record<string, unknown>): Entity {
    const old = this.get(id)
    if (!old) throw new Error('记录不存在')
    if (old.kind === 'revision') throw new Error('历史版本不可修改')
    this.db.prepare('UPDATE entities SET data = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify({ ...old.data, ...patch }), new Date().toISOString(), id)
    return this.get(id)!
  }
  setting(key: string): unknown {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row ? JSON.parse(row.value) : undefined
  }
  setSetting(key: string, value: unknown) {
    this.db.prepare('INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value))
  }
  saveDraft(workId: string, draft: unknown, expectedRevision: number, promptAction?: 'accept' | 'undo') {
    return this.db.transaction(() => {
      const work = this.get(workId)
      if (!work || work.kind !== 'work') throw new Error('作品不存在')
      if (Number(work.data.draftRevision ?? 0) !== expectedRevision) throw new Error('草稿已更新，请重新加载')
      if (promptAction === 'accept' || promptAction === 'undo') {
        const before = (work.data.draft ?? {}) as Partial<ComposerState>
        const after = draft as Partial<ComposerState>
        this.create('message', { role: 'user', type: 'promptFeedback', action: promptAction,
          text: promptAction === 'accept' ? '接受了 Prompt 强化' : '撤销了 Prompt 强化',
          before: docToPrompt(before.doc, before.references ?? []), after: docToPrompt(after.doc, after.references ?? []),
        }, workId)
      }
      for (const run of this.list('run', workId)) {
        if (['planning', 'executing', 'waiting', 'inspecting'].includes(String(run.data.status))) {
          this.update(run.id, { status: 'paused', reason: '用户编辑了草稿' })
        }
      }
      return this.update(workId, { draft, draftRevision: expectedRevision + 1 })
    })()
  }
  restoreRevision(workId: string, revisionId: string, expectedRevision: number, assetId?: string) {
    return this.db.transaction(() => {
      const revision = this.get(revisionId)
      if (!revision || revision.kind !== 'revision' || revision.workId !== workId || !revision.data.snapshot) throw new Error('版本不属于当前作品')
      if (assetId !== undefined) {
        const asset = this.get(assetId)
        if (asset?.kind !== 'asset' || asset.workId !== workId || asset.data.source !== 'generation' || asset.data.revisionId !== revisionId) {
          throw new Error('所选图片不属于当前生成版本')
        }
        this.create('message', { role: 'user', type: 'resultSelection', text: '从这张图继续创作', assetId, revisionId }, workId)
      }
      this.saveDraft(workId, revision.data.snapshot, expectedRevision)
      for (const run of this.list('run', workId)) {
        if (run.data.status === 'paused') this.update(run.id, { nextParentId: revision.id })
      }
      return this.update(workId, { baseRevisionId: revision.id, selectedAssetId: assetId ?? null })
    })()
  }
  moveWork(workId: string, libraryState: unknown) {
    if (!['active', 'archived', 'deleted'].includes(String(libraryState))) throw new Error('无效的作品状态')
    return this.db.transaction(() => {
      if (this.get(workId)?.kind !== 'work') throw new Error('作品不存在')
      if (libraryState !== 'active') this.pauseActiveRuns(workId, libraryState === 'deleted' ? '作品已移入最近删除' : '作品已归档')
      return this.update(workId, { libraryState })
    })()
  }
  renameWork(workId: string, title: unknown) {
    const work = this.get(workId)
    if (!work || work.kind !== 'work') throw new Error('作品不存在')
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) throw new Error('作品名称须为 1–200 个字符')
    return this.update(workId, { title: title.trim() })
  }
  savePreference(text: unknown, id?: string) {
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000) throw new Error('偏好内容须为 1–2000 个字符')
    const data = { text: text.trim(), active: true, confirmedAt: new Date().toISOString() }
    if (!id) return this.create('preference', data)
    if (this.get(id)?.kind !== 'preference') throw new Error('偏好不存在')
    return this.update(id, data)
  }
  confirmSave(messageId: string, accept: boolean) {
    return this.db.transaction(() => {
      const message = this.get(messageId)
      if (message?.kind !== 'message' || message.data.type !== 'saveProposal' || typeof accept !== 'boolean') throw new Error('保存建议无效')
      if (message.data.status !== 'pending') return message
      if (!accept) return this.update(messageId, { status: 'dismissed' })
      let saved: Entity
      if (message.data.target === 'preference') {
        saved = this.savePreference(message.data.text)
      } else {
        const source = this.get(String(message.data.sourceId))
        if (!source || source.workId !== message.workId || source.kind !== 'revision' || !source.data.snapshot) throw new Error('找不到对应的生成版本')
        saved = this.create('preset', { title: message.data.text, snapshot: source.data.snapshot })
      }
      return this.update(messageId, { status: 'accepted', savedId: saved.id })
    })()
  }
  setPreferenceActive(id: string, active: unknown) {
    if (this.get(id)?.kind !== 'preference') throw new Error('偏好不存在')
    if (typeof active !== 'boolean') throw new Error('偏好状态无效')
    return this.update(id, { active })
  }
  activePreferences() {
    return this.list('preference').filter(item => item.data.active === true && typeof item.data.confirmedAt === 'string').map(item => ({ id: item.id, text: item.data.text }))
  }
  pauseActiveRuns(workId: string, reason: string, exceptId?: string) {
    for (const run of this.list('run', workId)) {
      if (run.id !== exceptId && ['planning', 'executing', 'waiting', 'inspecting'].includes(String(run.data.status))) this.update(run.id, { status: 'paused', reason })
    }
  }
  /** Stable dispatch id prevents replay from spending twice. Failed/unknown submissions retain their spend. */
  reserveGeneration(runId: string, jobId: string, count: number, dispatchId: string) {
    return this.db.transaction(() => {
      const existing = this.db.prepare('SELECT jobId, runId, count FROM dispatches WHERE id = ?').get(dispatchId) as { jobId: string; runId: string; count: number } | undefined
      if (existing) {
        if (existing.runId !== runId || existing.count !== count) throw new Error('重复请求与原提交不一致')
        return { reused: true, jobId: existing.jobId }
      }
      const run = this.get(runId)
      if (!run || run.kind !== 'run' || !['planning', 'executing'].includes(String(run.data.status))) throw new Error('执行已暂停或结束')
      if (!Number.isInteger(count) || count < 1) throw new Error('生成数量无效')
      const spent = budgetInteger(run.data.imagesSpent, 0, 0)
      if (spent + count > budgetInteger(run.data.maxImages, 6, 0)) throw new Error('已达到生成上限')
      this.db.prepare('INSERT INTO dispatches VALUES (?, ?, ?, ?, ?)').run(dispatchId, runId, jobId, count, new Date().toISOString())
      this.update(runId, { imagesSpent: spent + count })
      return { reused: false, jobId }
    })()
  }
  reserveModelCall(runId: string) {
    return this.db.transaction(() => {
      const run = this.get(runId)
      if (!run || run.kind !== 'run' || !['planning', 'executing', 'inspecting'].includes(String(run.data.status))) throw new Error('执行不可继续')
      const spent = budgetInteger(run.data.modelCalls, 0, 0)
      if (spent >= budgetInteger(run.data.maxModelCalls, 20, 1)) throw new Error('已达到模型调用上限')
      this.update(runId, { modelCalls: spent + 1 })
    })()
  }
  latestRunAssets(runId: string) {
    const run = this.get(runId)
    if (run?.kind !== 'run' || !run.workId) return []
    const jobs = this.list('job', run.workId).filter(job => job.data.runId === runId && job.data.revisionId === run.data.lastRevisionId)
    if (jobs.some(job => job.data.status !== 'failed' && job.data.saveStatus !== 'saved')) return []
    const jobIds = new Set(jobs.map(job => job.id))
    return this.list('asset', run.workId).filter(asset => asset.data.source === 'generation' && jobIds.has(String(asset.data.jobId)))
  }
  syncInspection(runId: string) {
    const assets = this.latestRunAssets(runId)
    if (!assets.length) return
    const checked = new Set(this.list('message', assets[0].workId!).filter(m => m.data.runId === runId && m.data.type === 'inspection')
      .flatMap(m => Array.isArray(m.data.assetIds) ? m.data.assetIds : []))
    if (assets.every(asset => checked.has(asset.id))) this.update(runId, { inspectedRevisionId: this.get(runId)!.data.lastRevisionId })
  }
  recover() {
    this.db.transaction(() => {
      for (const run of this.list('run')) {
        if (!['completed', 'failed', 'paused'].includes(String(run.data.status))) this.update(run.id, { status: 'paused', reason: '应用重新启动，等待继续' })
      }
      for (const job of this.list('job')) {
        if (job.data.status === 'submitting' && !job.data.remoteId) this.update(job.id, { status: 'unknown', error: '提交结果不明，请核实后继续' })
      }
      for (const message of this.list('message')) {
        if (['running', 'streaming'].includes(String(message.data.status))) this.update(message.id, { status: 'interrupted' })
      }
    })()
  }
  close() { this.db.close() }
}
