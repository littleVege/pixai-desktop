import { describe, expect, it } from 'vitest'
import { advancedOverrides, paramsDefaults, rebaseParams, resetAdvanced } from './params'

const flash = paramsDefaults({ defaults: { samplingSteps: 8, cfgScale: 1 } })
const full = paramsDefaults({ defaults: { samplingSteps: 28 } })

describe('advancedOverrides', () => {
  it('is empty at defaults', () => {
    expect(advancedOverrides(full, full)).toEqual([])
  })
  it('counts changed advanced settings only', () => {
    const p = { ...full, steps: 30, seed: 7, negativePrompt: ' lowres ', aspectRatio: '3:4' as const, batchSize: 1 as const }
    expect(advancedOverrides(p, full)).toEqual(['steps', 'seed', 'negativePrompt'])
  })
  it('ignores whitespace-only negative prompts', () => {
    expect(advancedOverrides({ ...full, negativePrompt: '   ' }, full)).toEqual([])
  })
})

describe('rebaseParams', () => {
  it('moves untouched values to the new model defaults', () => {
    const r = rebaseParams(full, full, flash)
    expect([r.steps, r.cfgScale]).toEqual([8, 1])
    expect(advancedOverrides(r, flash)).toEqual([])
  })
  it('keeps user overrides', () => {
    expect(rebaseParams({ ...full, steps: 40 }, full, flash).steps).toBe(40)
  })
})

describe('resetAdvanced', () => {
  it('restores advanced settings but keeps output settings', () => {
    const r = resetAdvanced({ ...full, steps: 40, seed: 1, negativePrompt: 'x', aspectRatio: '16:9' }, full)
    expect(advancedOverrides(r, full)).toEqual([])
    expect(r.aspectRatio).toBe('16:9')
  })
})
