import { describe, expect, it } from 'vitest'
import { resolveResolution, toTaskParameters, type GenerateRequest } from './taskParams.ts'

const base: GenerateRequest = {
  prompt: 'Redraw the red figure in image1 as a knight.', modelVersionId: '2024383379556065549', modelType: 'MMDIT26B_MODEL',
  recipeIds: [], loras: [], contextImages: [], aspectRatio: '3:4', size: '1k', sampling: { method: 'Euler', steps: 25, cfgScale: 5 }, batchSize: 1,
}

describe('toTaskParameters', () => {
  it('maps a Tsubaki.3 request with the pro profile and no sampling fields', () => {
    const p = toTaskParameters({ ...base, contextImages: ['775674033753008631'] })
    expect(p).toMatchObject({ modelId: '2024383379556065549', prompts: base.prompt, width: 864, height: 1152, inferenceProfile: 'pro', batchSize: 1, contextImages: ['775674033753008631'] })
    expect(p).not.toHaveProperty('samplingSteps')
  })
  it('leaves the profile to the server for Tsubaki.3 Flash', () => {
    expect(toTaskParameters({ ...base, modelVersionId: '2050048243034896798' })).not.toHaveProperty('inferenceProfile')
  })
  it('sends sampling only for SD-family models', () => {
    expect(toTaskParameters({ ...base, modelType: 'SDXL_MODEL' })).toMatchObject({ samplingSteps: 25, samplingMethod: 'Euler', cfgScale: 5 })
  })
  it('writes LoRAs as a weight record and a parameter list', () => {
    const p = toTaskParameters({ ...base, loras: [{ modelId: '11', weight: 0.7 }] })
    expect(p.lora).toEqual({ 11: 0.7 })
    expect(p.loraParameters).toEqual([{ versionId: '11', weight: 0.7 }])
  })
  it('stringifies the seed and keeps negative prompt and recipes', () => {
    expect(toTaskParameters({ ...base, seed: 42, negativePrompt: ' blurry ', recipeIds: ['9'] })).toMatchObject({ seed: '42', negativePrompts: 'blurry', recipeIds: ['9'] })
  })
  it('rejects bad context images', () => {
    expect(() => toTaskParameters({ ...base, contextImages: ['upload-media-1'] })).toThrow(/media ids/)
    expect(() => toTaskParameters({ ...base, modelType: 'SDXL_MODEL', contextImages: ['1'] })).toThrow(/does not take/)
    expect(() => toTaskParameters({ ...base, prompt: ' ' })).toThrow(/prompt/)
  })
  it('uses the contract resolution table', () => {
    expect(resolveResolution('16:9', '1.5k')).toEqual([1536, 864])
    expect(resolveResolution('1:3', '1k')).toEqual([512, 1536])
  })
})
