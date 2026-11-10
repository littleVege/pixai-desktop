import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StudioStore } from './store'
import { RunJournal } from './run-journal'
const stores: StudioStore[] = []
function setup() {
  const store = new StudioStore(mkdtempSync(join(tmpdir(), 'pixai-journal-'))); stores.push(store)
  return { store, journal: new RunJournal(store, 'run', 'work', () => {}, text => text.replaceAll('test-secret', '[redacted]')) }
}
afterEach(() => { for (const store of stores.splice(0)) { store.close(); rmSync(store.directory, { recursive: true, force: true }) } })
describe('durable agent journal', () => {
  it('keeps completed tool output on replay and refuses a conflicting tool identity', () => {
    const { store, journal } = setup()
    journal.startTool('same', 'generate_candidates', { count: 1 })
    journal.endTool('same', { jobs: ['original'] }, false, 10)
    journal.startTool('same', 'generate_candidates', { count: 1 })
    journal.endTool('same', { replayed: true }, false, 1)
    expect(store.get('run:tool:same')?.data.result).toContain('original')
    expect(() => journal.startTool('same', 'generate_candidates', { count: 2 })).toThrow('参数已改变')
  })
  it('flushes all text at completion and keeps separate streamed messages', () => {
    const { store, journal } = setup()
    journal.text('first', 'hello '); journal.text('first', 'world'); journal.finishText('first')
    journal.text('second', 'next'); journal.close(false)
    expect(store.list('message').map(m => m.data.text).sort()).toEqual(['hello world', 'next'])
    expect(store.list('message').every(m => m.data.status === 'complete')).toBe(true)
  })
  it('retains failures and interrupted output without exposing configured secrets', () => {
    const { store, journal } = setup()
    journal.startTool('call', 'search_models', { keyword: 'test-secret' })
    journal.endTool('call', 'error test-secret', true, 12)
    journal.text('reply', 'partial test-secret'); journal.close(true)
    expect(JSON.stringify(store.list('message'))).not.toContain('test-secret')
    expect(store.get('run:tool:call')?.data).toMatchObject({ status: 'failed', durationMs: 12 })
    expect(store.list('message').find(m => m.data.type === 'reply')?.data.status).toBe('interrupted')
  })
  it('marks unfinished text and tools interrupted on application recovery', () => {
    const { store, journal } = setup()
    journal.startTool('call', 'inspect_images', {}); journal.text('reply', 'partial')
    store.recover()
    expect(store.list('message').every(m => m.data.status === 'interrupted')).toBe(true)
  })
})
