import { describe, expect, it } from 'vitest'
import { compatibleLora, resolveAgentSelection, type CatalogSelection } from './agent-selection'
import { validatePromptAssets } from './prompt-assets'
import type { ComposerState } from '../src/types'

const state: ComposerState = { doc: { type: 'doc', content: [] }, references: [], loras: [], recipeIds: [], modelVersionId: '', presetId: null, params: { aspectRatio: '1:1', size: '1k', batchSize: 1, steps: 25, cfgScale: 5, sampler: 'Euler', seed: null, negativePrompt: '' } }
const catalog: CatalogSelection[] = [
  { versionId: 'model', title: 'Model', type: 'SDXL_MODEL', usageType: 'MODEL' },
  { versionId: 'lora', title: 'Character', type: 'SDXL_MODEL', usageType: 'LORA', triggerWords: ['specific-character'] },
]
const selection = { modelVersionId: 'model', modelType: 'SDXL_MODEL', loras: [{ versionId: 'lora', weight: 0.7 }] }

describe('Agent model and LoRA selection', () => {
  it('requires catalog evidence for autonomous version IDs and model type', () => {
    expect(() => resolveAgentSelection(state, [], selection)).toThrow('搜索')
    expect(() => resolveAgentSelection(state, catalog, { ...selection, modelType: 'SD_V1_MODEL' })).toThrow('类型')
    expect(() => resolveAgentSelection(state, catalog, { ...selection, loras: [{ versionId: 'invented', weight: 0.7 }] })).toThrow('LoRA')
    expect(() => resolveAgentSelection(state, [{ ...catalog[0], usageType: 'LORA' }], selection)).toThrow('搜索')
  })
  it('checks a multi-LoRA against its advertised base models', () => {
    const multi = { ...catalog[1], type: 'MULTI_LORA', baseModelTypes: ['SDXL_MODEL'] }
    expect(resolveAgentSelection(state, [catalog[0], multi], selection).loras).toEqual(selection.loras)
    expect(() => resolveAgentSelection(state, [catalog[0], { ...multi, baseModelTypes: ['SD_V1_MODEL'] }], selection)).toThrow('不兼容')
  })
  it('freezes selected metadata and requires the newly selected trigger phrase', () => {
    const candidate = resolveAgentSelection(state, catalog, selection)
    expect(candidate.loras).toEqual(selection.loras)
    expect(candidate.promptContext?.loras[0]).toMatchObject({ title: 'Character', triggerWords: ['specific-character'] })
    expect(() => validatePromptAssets('a character', candidate)).toThrow('触发词')
    expect(() => validatePromptAssets('specific-character', candidate)).not.toThrow()
    expect(state.loras).toEqual([])
  })
  it('preserves explicit model and LoRA choices and weights', () => {
    const selected = resolveAgentSelection(state, catalog, selection)
    expect(() => resolveAgentSelection(selected, catalog, { ...selection, modelVersionId: 'another' })).toThrow('指定模型')
    expect(() => resolveAgentSelection(selected, catalog, { ...selection, loras: [] })).toThrow('指定 LoRA')
    expect(() => resolveAgentSelection(selected, catalog, { ...selection, loras: [{ versionId: 'lora', weight: 0.8 }] })).toThrow('指定 LoRA')
    expect(resolveAgentSelection(selected, [], { modelVersionId: 'model', modelType: 'SDXL_MODEL' }).loras).toEqual(selection.loras)
  })
  it('rejects incompatible types, duplicate entries and invalid weights', () => {
    expect(() => resolveAgentSelection(state, [catalog[0], { ...catalog[1], type: 'SD_V1_MODEL' }], selection)).toThrow('不兼容')
    expect(() => resolveAgentSelection(state, catalog, { ...selection, loras: [...selection.loras, ...selection.loras] })).toThrow('重复')
    expect(() => resolveAgentSelection(state, catalog, { ...selection, loras: [{ versionId: 'lora', weight: NaN }] })).toThrow('权重')
    expect(compatibleLora('USER_DIT26A_MODEL', 'USER_DIT26B_MODEL')).toBe(false)
    expect(compatibleLora('MMDIT26B_MODEL', 'USER_DIT26B_MODEL')).toBe(false)
    expect(compatibleLora('DIT7_MODEL', 'DIT7B_MODEL')).toBe(true)
    expect(compatibleLora('UNKNOWN', 'UNKNOWN')).toBe(false)
  })
})
