import type { ComposerState, ComposerSubmission } from '@/types'
import { docToPrompt, docIsEmpty } from './promptSerialize'

export function canSubmit(state: Pick<ComposerState, 'doc' | 'recipeIds'>): boolean {
  return !docIsEmpty(state.doc) || state.recipeIds.length > 0
}

export function buildSubmission(state: ComposerState): ComposerSubmission {
  const negative = state.params.negativePrompt.trim()
  return {
    prompt: docToPrompt(state.doc, state.references),
    ...(negative ? { negativePrompt: negative } : {}),
    modelVersionId: state.modelVersionId,
    recipeIds: [...state.recipeIds],
    loras: state.loras.map(l => ({ modelId: l.versionId, weight: l.weight })),
    contextImages: state.references.map(r => r.mediaId ?? r.id),
    aspectRatio: state.params.aspectRatio,
    size: state.params.size,
    sampling: { method: state.params.sampler, steps: state.params.steps, cfgScale: state.params.cfgScale },
    ...(state.params.seed !== null ? { seed: state.params.seed } : {}),
    batchSize: state.params.batchSize,
    promptDoc: state.doc,
  }
}
