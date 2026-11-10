import type { ComposerState } from '../src/types'
import { docToPrompt } from '../src/lib/promptSerialize'
import type { StudioStore } from './store'

/** Describe a draft for text inference. Local files and editable 3D geometry stay in the work. */
export function describeDraft(state: Partial<ComposerState>) {
  return {
    prompt: docToPrompt(state.doc, state.references ?? []),
    modelVersionId: state.modelVersionId, promptContext: state.promptContext,
    loras: state.loras, params: state.params, lockedContents: state.lockedContents,
    recipeIds: state.recipeIds, presetId: state.presetId,
  }
}

export function searchPresets(store: StudioStore, query = '', limit = 8) {
  const keyword = query.trim().toLocaleLowerCase()
  const results = []
  for (const preset of store.list('preset')) {
    const draft = describeDraft((preset.data.snapshot ?? {}) as Partial<ComposerState>)
    const title = String(preset.data.title ?? '')
    const terms = [title, draft.prompt, draft.modelVersionId, draft.promptContext?.model?.title, ...(draft.promptContext?.loras ?? []).map(lora => lora.title)]
    if (keyword && !terms.some(term => term?.toLocaleLowerCase().includes(keyword))) continue
    results.push({ id: preset.id, title, ...draft, prompt: draft.prompt.slice(0, 1200) })
    if (results.length >= limit) break
  }
  return results
}
