import type { Model, Params } from '@/types'

/** Defaults for a model: model-driven sampling values, everything else fixed. */
export function paramsDefaults(model?: Pick<Model, 'defaults'>): Params {
  const d = model?.defaults ?? {}
  return {
    aspectRatio: '1:1',
    size: '1k',
    batchSize: 4,
    steps: d.samplingSteps ?? 28,
    cfgScale: d.cfgScale ?? 5,
    sampler: d.samplingMethod ?? 'Euler',
    seed: null,
    negativePrompt: '',
  }
}

/** Settings that live behind the gear; the gear badge counts how many differ from the model defaults. */
export const ADVANCED_KEYS = ['steps', 'cfgScale', 'sampler', 'seed', 'negativePrompt'] as const
export type AdvancedKey = (typeof ADVANCED_KEYS)[number]

export function advancedOverrides(params: Params, defaults: Params): AdvancedKey[] {
  return ADVANCED_KEYS.filter(k =>
    k === 'negativePrompt' ? params.negativePrompt.trim() !== defaults.negativePrompt.trim() : params[k] !== defaults[k],
  )
}

/** On model switch, values still at the old model's default follow the new model; user overrides are kept. */
export function rebaseParams(params: Params, from: Params, to: Params): Params {
  return {
    ...params,
    steps: params.steps === from.steps ? to.steps : params.steps,
    cfgScale: params.cfgScale === from.cfgScale ? to.cfgScale : params.cfgScale,
    sampler: params.sampler === from.sampler ? to.sampler : params.sampler,
  }
}

export function resetAdvanced(params: Params, defaults: Params): Params {
  return { ...params, steps: defaults.steps, cfgScale: defaults.cfgScale, sampler: defaults.sampler, seed: null, negativePrompt: '' }
}
