import type { ComposerState, Model, Lora } from '../types'
import { promptStyleFor } from './recommend'

export interface PromptContext {
  model?: { versionId: string; title: string; type: string }
  loras: Array<{ versionId: string; title: string; weight: number; triggerWords: string[] }>
  referenceLabels: Array<{ label: string; id: string; name?: string }>
  guidance: { source: string; verification: 'provisional'; style: 'natural' | 'tags' | 'unknown' }
}
export function buildPromptContext(state: ComposerState, models: Model[], loras: Lora[]): PromptContext {
  const found = models.find(model => model.versionId === state.modelVersionId)
  const model = found ? { versionId: found.versionId, title: found.title, type: found.type } : state.promptContext?.model?.versionId === state.modelVersionId ? state.promptContext.model : undefined
  return {
    model,
    loras: state.loras.map(selected => {
      const current = loras.find(lora => lora.versionId === selected.versionId)
      const saved = state.promptContext?.loras.find(lora => lora.versionId === selected.versionId)
      const raw: unknown = current?.triggerWords
      const triggers = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : saved?.triggerWords ?? []
      return { ...selected, title: current?.title ?? saved?.title ?? selected.versionId, triggerWords: triggers.filter(word => word.trim()) }
    }),
    referenceLabels: state.references.map((reference, i) => ({ label: `image${i + 1}`, id: reference.id, name: reference.name })),
    guidance: { source: 'playground promptStyleFor heuristic; not a measured model-quality rule', verification: 'provisional', style: model ? promptStyleFor(model.type) : 'unknown' },
  }
}
