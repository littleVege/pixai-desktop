import { describe, expect, it } from 'vitest'
import { buildSubmission, canSubmit } from './submission'
import type { ComposerState } from '@/types'

const base: ComposerState = {
  doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a cat ' }, { type: 'referenceMention', attrs: { refId: 'u1' } }] }] },
  recipeIds: ['r2', 'r1'],
  loras: [{ versionId: 'l1', weight: 0.7 }],
  references: [{ id: 'u1', url: '', source: 'upload', mediaId: 'm1' }],
  modelVersionId: 'v1',
  params: { aspectRatio: '3:4', size: '1.5k', batchSize: 4, steps: 20, cfgScale: 4, sampler: 'Euler a', seed: 42, negativePrompt: ' lowres ' },
  presetId: null,
}

describe('buildSubmission', () => {
  it('maps the state onto the v2 request shape', () => {
    const s = buildSubmission(base)
    expect(s).toMatchObject({
      prompt: 'a cat image1',
      negativePrompt: 'lowres',
      modelVersionId: 'v1',
      recipeIds: ['r2', 'r1'],
      loras: [{ modelId: 'l1', weight: 0.7 }],
      contextImages: ['m1'],
      aspectRatio: '3:4',
      size: '1.5k',
      sampling: { method: 'Euler a', steps: 20, cfgScale: 4 },
      seed: 42,
      batchSize: 4,
    })
    expect(s.promptDoc).toBe(base.doc)
  })
  it('omits seed and negative prompt when unset', () => {
    const s = buildSubmission({ ...base, params: { ...base.params, seed: null, negativePrompt: '' } })
    expect('seed' in s).toBe(false)
    expect('negativePrompt' in s).toBe(false)
  })
})

describe('canSubmit', () => {
  const empty = { type: 'doc', content: [{ type: 'paragraph' }] }
  it('needs prompt text or a recipe', () => {
    expect(canSubmit({ doc: empty, recipeIds: [] })).toBe(false)
    expect(canSubmit({ doc: empty, recipeIds: ['r'] })).toBe(true)
    expect(canSubmit({ doc: base.doc, recipeIds: [] })).toBe(true)
  })
})
