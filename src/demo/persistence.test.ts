import { describe, expect, it } from 'vitest'
import { MAX_SUBMISSIONS, stripMentionUrls, reviveDraft, reviveScenes, reviveSubmissions, serializeSubmissions, type SubmissionEntry } from './persistence'
import { createScene } from '@/lib/reference-scene/scene'
import type { ComposerSubmission } from '@/types'

const submission = (prompt: string): ComposerSubmission => ({
  prompt, modelVersionId: 'v1', recipeIds: [], loras: [], contextImages: [], aspectRatio: '1:1', size: '1k',
  sampling: {}, batchSize: 1, promptDoc: { type: 'doc', content: [] },
})

describe('submissions', () => {
  it('round-trips through JSON with dates revived and the editor doc rebuilt from the prompt', () => {
    const at = new Date('2026-10-13T08:00:00Z')
    const list: SubmissionEntry[] = [{ id: 1, at, s: submission('a cat\non a roof'), gen: { phase: 'done', taskId: 't1', images: [{ mediaId: 'm1', url: 'https://x/1.png' }] } }]
    const back = reviveSubmissions(JSON.parse(JSON.stringify(serializeSubmissions(list))))
    expect(back).toHaveLength(1)
    expect(back[0].at.getTime()).toBe(at.getTime())
    expect(back[0].gen).toEqual(list[0].gen)
    expect(back[0].s.promptDoc.content).toHaveLength(2)
  })

  it('does not store the editor document', () => {
    expect('promptDoc' in serializeSubmissions([{ id: 1, at: new Date(), s: submission('x') }])[0].s).toBe(false)
  })

  it('marks tasks interrupted while uploading as failed and keeps running ones', () => {
    const raw = [
      { id: 1, at: new Date().toISOString(), s: submission('a'), gen: { phase: 'uploading' } },
      { id: 2, at: new Date().toISOString(), s: submission('b'), gen: { phase: 'running', taskId: 't2', status: 'queued' } },
    ]
    const [a, b] = reviveSubmissions(raw)
    expect(a.gen?.phase).toBe('failed')
    expect(b.gen).toEqual({ phase: 'running', taskId: 't2', status: 'queued' })
  })

  it('skips malformed entries and caps the list', () => {
    const good = (i: number) => ({ id: i, at: new Date().toISOString(), s: submission(String(i)) })
    const raw = [null, { id: 'x' }, { id: 3, at: 'not a date', s: submission('z') }, ...Array.from({ length: MAX_SUBMISSIONS + 5 }, (_, i) => good(i))]
    expect(reviveSubmissions(raw)).toHaveLength(MAX_SUBMISSIONS)
    expect(reviveSubmissions('garbage')).toEqual([])
  })

  it('serialises at most the requested number of entries', () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ id: i, at: new Date(), s: submission(String(i)) }))
    expect(serializeSubmissions(list, 3)).toHaveLength(3)
  })
})

describe('reviveDraft', () => {
  const known = { modelVersionIds: new Set(['v1']), recipeIds: new Set(['r1']), loraVersionIds: new Set(['l1']) }

  it('keeps known ids and persistent images, drops the rest', () => {
    const d = reviveDraft({
      doc: { type: 'doc', content: [] },
      recipeIds: ['r1', 'gone'],
      loras: [{ versionId: 'l1', weight: 0.7 }, { versionId: 'gone', weight: 1 }],
      references: [
        { id: 'a', url: 'data:image/png;base64,AAA', source: 'scene', sceneId: 's1' },
        { id: 'b', url: 'blob:http://localhost/123', source: 'upload' },
        { id: 'c', url: 'https://cdn/x.webp', source: 'generation' },
      ],
      modelVersionId: 'unknown-model',
      presetId: null,
      maxLoras: 15,
    }, known)
    expect(d.recipeIds).toEqual(['r1'])
    expect(d.loras).toEqual([{ versionId: 'l1', weight: 0.7 }])
    expect(d.references?.map(r => r.id)).toEqual(['a', 'c'])
    expect('modelVersionId' in d).toBe(false)
    expect(d.maxLoras).toBe(15)
  })

  it('returns nothing for junk', () => {
    expect(reviveDraft(null, known)).toEqual({})
    expect(reviveDraft({ doc: { type: 'paragraph' } }, known)).toEqual({})
  })
})

describe('reviveScenes', () => {
  it('keeps well-formed scenes that a Reference still points at', () => {
    const a = createScene()
    const b = createScene()
    const raw = { [a.id]: a, [b.id]: b, broken: { id: 'broken', figures: 'no' } }
    expect(Object.keys(reviveScenes(JSON.parse(JSON.stringify(raw)), new Set([a.id, 'broken'])))).toEqual([a.id])
  })
})

describe('stripMentionUrls', () => {
  it('blanks mention image URLs and leaves everything else', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'pose of ' }, { type: 'referenceMention', attrs: { refId: 'a', label: '1', url: 'data:image/png;base64,AAAA' } }] }] }
    const out = stripMentionUrls(doc)
    expect(out.content?.[0].content?.[1].attrs).toEqual({ refId: 'a', label: '1', url: '' })
    expect(out.content?.[0].content?.[0]).toEqual({ type: 'text', text: 'pose of ' })
    expect(doc.content[0].content[1].attrs?.url).toMatch(/^data:/)
  })
})
