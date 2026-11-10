import { describe, expect, it } from 'vitest'
import { validatePromptAssets } from './prompt-assets'
import { buildPromptContext } from '../src/lib/promptContext'
import type { ComposerState, Model } from '../src/types'
const state: ComposerState = { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'referenceMention', attrs: { refId: 'reference' } }] }] }, references: [{ id: 'reference', url: 'studio-asset://local/test.png', source: 'upload' }], loras: [{ versionId: 'lora', weight: 0.7 }], modelVersionId: 'model', recipeIds: [], params: { aspectRatio: '1:1', size: '1k', batchSize: 1, steps: 25, cfgScale: 5, sampler: 'Euler', seed: null, negativePrompt: '' }, presetId: null }
const model: Model = { id: 'parent', versionId: 'model', title: 'Test model', type: 'MMDIT26B_MODEL', cover: '', refCount: 0, likedCount: 0, defaults: {} }
const context = buildPromptContext(state, [model], [{ id: 'parent-lora', versionId: 'lora', title: 'Character', triggerWords: 'specific-character', cover: '', refCount: 0, likedCount: 0 }])
describe('prompt asset context', () => {
  it('preserves only the selected model and LoRA metadata across catalog cache loss', () => {
    expect(buildPromptContext({ ...state, promptContext: context }, [], [])).toEqual(context)
    expect(buildPromptContext({ ...state, modelVersionId: 'different', loras: [], promptContext: context }, [], [])).toMatchObject({ model: undefined, loras: [], guidance: { style: 'unknown', verification: 'provisional' } })
  })
  it('rejects missing reference markers and trigger phrases before submission', () => {
    const snapshot = { ...state, promptContext: context }
    expect(() => validatePromptAssets('specific-character in rain', snapshot)).toThrow('image1')
    expect(() => validatePromptAssets('image1 in rain', snapshot)).toThrow('specific-character')
    expect(() => validatePromptAssets('Specific-Character, pose from image1', snapshot)).not.toThrow()
  })
  it('does not require triggers from removed or zero-weight LoRAs', () => {
    expect(() => validatePromptAssets('image1', { ...state, loras: [], promptContext: context })).not.toThrow()
    expect(() => validatePromptAssets('image1', { ...state, loras: [{ versionId: 'lora', weight: 0 }], promptContext: context })).not.toThrow()
  })
})
