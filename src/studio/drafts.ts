import { selectState, useComposerStore } from '@/store/composerStore'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import type { ComposerState, Reference } from '@/types'
import { studio } from './api'
import { models, loras, findRecipe } from '@/mock/data'
import { buildPromptContext } from '@/lib/promptContext'

export function currentDraft() {
  const state = selectState(useComposerStore.getState())
  return { ...state, recipeMetadata: state.recipeIds.flatMap(id => findRecipe(id) ?? state.recipeMetadata?.find(r => r.id === id) ?? []), promptContext: buildPromptContext(state, models, loras), scenes: useReferenceSceneStore.getState().scenes }
}
const imports = new WeakMap<Reference, { workId: string; result: Promise<Reference> }>()

async function importReference(reference: Reference, workId: string, scene?: NonNullable<ComposerState['scenes']>[string]): Promise<Reference> {
  const response = await fetch(reference.url)
  if (!response.ok) throw new Error('无法读取参考图，请重新添加')
  const blob = await response.blob()
  const saved = await studio.importReference({ bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), contentType: blob.type || 'image/png', name: reference.name, workId, scene }) as Record<string, unknown>
  return { ...reference, ...saved, id: reference.id, source: reference.source }
}

export async function persistReferences(draft: ComposerState, workId: string) {
  const references = await Promise.all(draft.references.map(reference => {
    if (!reference.url.startsWith('blob:') && !reference.url.startsWith('data:')) return reference
    const existing = imports.get(reference)
    if (existing?.workId === workId) return existing.result
    const result = importReference(reference, workId, reference.sceneId ? draft.scenes?.[reference.sceneId] : undefined).catch(error => {
      if (imports.get(reference)?.result === result) imports.delete(reference)
      throw error
    })
    imports.set(reference, { workId, result })
    return result
  }))
  return { ...draft, references }
}
