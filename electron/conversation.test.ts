import { searchPresets } from "./preset-context"
import { expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StudioStore } from './store'
import { conversationPage } from './conversation'
import { mediaIdsFromOutputs } from '../server/pixai'

it('recovers earlier turns after reopening while excluding unrelated works and verbose tool data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixai-memory-'))
  let store = new StudioStore(dir)
  try {
    const first = store.create('message', { role: 'user', text: 'red coat' }, 'a')
    store.create('message', { type: 'tool', result: 'long payload' }, 'a')
    const second = store.create('message', { type: 'inspection', text: 'coat is red' }, 'a')
    const other = store.create('message', { role: 'user', text: 'other conversation' }, 'b')
    store.close()
    store = new StudioStore(dir)
    const recent = conversationPage(store, 'a', undefined, 1)
    expect(recent.events.map(event => event.id)).toEqual([second.id])
    expect(conversationPage(store, 'a', recent.earlierThan!).events.map(event => event.id)).toEqual([first.id])
    expect(() => conversationPage(store, 'a', other.id)).toThrow('当前会话')
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})
it('archives individual batch results in platform order', () => {
  expect(mediaIdsFromOutputs({ mediaId: 'summary', batch: [{ mediaId: '2' }, { mediaId: '1' }, { mediaId: '2' }, { mediaId: '3', deletedAt: '2026-11-07' }] })).toEqual(['2', '1'])
})

it('finds an older named preset and gives the agent its settings without sending reference files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixai-presets-'))
  const store = new StudioStore(dir)
  try {
    store.create('preset', { title: '雨夜', snapshot: {
      modelVersionId: 'v1', params: { seed: 7281 }, lockedContents: ['薄雾'],
      references: [{ id: 'r', url: 'data:image/png;base64,local-only' }], scenes: { privateScene: {} },
    } })
    for (let i = 0; i < 9; i++) store.create('preset', { title: '其他', snapshot: {} })
    const found = searchPresets(store, '雨夜')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ modelVersionId: 'v1', params: { seed: 7281 }, lockedContents: ['薄雾'] })
    expect(JSON.stringify(found)).not.toMatch(/local-only|privateScene/)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})
