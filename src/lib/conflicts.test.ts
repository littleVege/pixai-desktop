import { describe, expect, it } from 'vitest'
import { conflicts } from './conflicts'
import type { Params, Reference } from '@/types'

const params = (negativePrompt = ''): Params => ({ aspectRatio: '1:1', size: '1k', batchSize: 1, steps: 28, cfgScale: 5, sampler: 'Euler', seed: null, negativePrompt })
const ref: Reference = { id: 'r', url: '', source: 'upload' }

describe('conflicts', () => {
  it('has no conflicts with only a prompt', () => {
    expect(conflicts({ loras: [], references: [], params: params('bad hands') })).toEqual({ referencesIgnored: false, negativePromptIgnored: false })
  })
  it('LoRA overrides references', () => {
    expect(conflicts({ loras: [{ versionId: 'l', weight: 0.7 }], references: [ref], params: params() }).referencesIgnored).toBe(true)
  })
  it('effective references override the negative prompt', () => {
    expect(conflicts({ loras: [], references: [ref], params: params('bad hands') }).negativePromptIgnored).toBe(true)
  })
  it('ignored references do not also ignore the negative prompt', () => {
    const c = conflicts({ loras: [{ versionId: 'l', weight: 1 }], references: [ref], params: params('bad hands') })
    expect(c).toEqual({ referencesIgnored: true, negativePromptIgnored: false })
  })
})
