import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'
import type { AspectRatio, ComposerState, LoraSelection, Params, Preset, Reference } from '@/types'
import { DEFAULT_LORA_WEIGHT, MAX_RECIPES, MAX_REFERENCES } from '@/types'
import { DEFAULT_MODEL_VERSION_ID, findModel } from '@/mock/data'
import { paramsDefaults, rebaseParams } from '@/lib/params'

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export const defaultParams = (modelVersionId: string): Params => paramsDefaults(findModel(modelVersionId))

export type AddResult = 'added' | 'exists' | 'full'

export interface ComposerActions {
  setDoc: (doc: JSONContent) => void
  /** Text the Editor should insert at the caret, consumed by the Editor. */
  pendingInsert: string | null
  requestInsert: (text: string) => void
  consumeInsert: () => void

  addRecipe: (id: string) => AddResult
  removeRecipe: (id: string) => void
  toggleRecipe: (id: string) => void
  moveRecipe: (from: number, to: number) => void

  addLora: (versionId: string, weight?: number) => AddResult
  removeLora: (versionId: string) => void
  toggleLora: (versionId: string) => void
  moveLora: (from: number, to: number) => void
  setLoraWeight: (versionId: string, weight: number) => void
  maxLoras: number
  setMaxLoras: (n: number) => void

  addReference: (ref: Reference) => AddResult
  removeReference: (id: string) => void
  /** Replace a Reference in place (keeps its index, so its Mentions stay valid). */
  replaceReference: (id: string, patch: Partial<Omit<Reference, 'id'>>) => void

  setModel: (versionId: string) => void
  setParams: (patch: Partial<Params>) => void
  setAspectRatio: (r: AspectRatio) => void

  loadPreset: (preset: Preset) => void
  /** Bumps when the whole doc is replaced from outside the editor (preset load), so the Editor re-syncs. */
  docRevision: number
  reset: () => void
}

export const newComposerDraft = (): ComposerState => ({
  recipeMetadata: [],
  lockedContents: [],
  promptContext: undefined,
  doc: EMPTY_DOC,
  recipeIds: [],
  loras: [],
  references: [],
  modelVersionId: DEFAULT_MODEL_VERSION_ID,
  params: defaultParams(DEFAULT_MODEL_VERSION_ID),
  presetId: null,
})

export const useComposerStore = create<ComposerState & ComposerActions>()((set, get) => ({
  ...newComposerDraft(),
  pendingInsert: null,
  docRevision: 0,
  maxLoras: 3,

  setDoc: doc => set({ doc }),
  requestInsert: text => set({ pendingInsert: text }),
  consumeInsert: () => set({ pendingInsert: null }),

  addRecipe: id => {
    const { recipeIds } = get()
    if (recipeIds.includes(id)) return 'exists'
    if (recipeIds.length >= MAX_RECIPES) return 'full'
    set({ recipeIds: [...recipeIds, id], presetId: null })
    return 'added'
  },
  removeRecipe: id => set(s => ({ recipeIds: s.recipeIds.filter(r => r !== id) })),
  toggleRecipe: id => (get().recipeIds.includes(id) ? get().removeRecipe(id) : void get().addRecipe(id)),
  moveRecipe: (from, to) =>
    set(s => {
      const next = [...s.recipeIds]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { recipeIds: next }
    }),

  addLora: (versionId, weight = DEFAULT_LORA_WEIGHT) => {
    const { loras, maxLoras } = get()
    if (loras.some(l => l.versionId === versionId)) return 'exists'
    if (loras.length >= maxLoras) return 'full'
    const sel: LoraSelection = { versionId, weight }
    set({ loras: [...loras, sel], presetId: null })
    return 'added'
  },
  removeLora: versionId => set(s => ({ loras: s.loras.filter(l => l.versionId !== versionId) })),
  toggleLora: versionId => (get().loras.some(l => l.versionId === versionId) ? get().removeLora(versionId) : void get().addLora(versionId)),
  setLoraWeight: (versionId, weight) => set(s => ({ loras: s.loras.map(l => (l.versionId === versionId ? { ...l, weight } : l)) })),
  moveLora: (from, to) =>
    set(s => {
      const next = [...s.loras]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { loras: next }
    }),
  setMaxLoras: n => set({ maxLoras: n }),

  addReference: ref => {
    const { references } = get()
    if (references.some(r => r.id === ref.id)) return 'exists'
    if (references.length >= MAX_REFERENCES) return 'full'
    set({ references: [...references, ref], presetId: null })
    return 'added'
  },
  removeReference: id => set(s => ({ references: s.references.filter(r => r.id !== id) })),
  replaceReference: (id, patch) => set(s => ({ references: s.references.map(r => (r.id === id ? { ...r, ...patch } : r)) })),

  setModel: versionId =>
    set(s => ({
      modelVersionId: versionId,
      presetId: null,
      params: rebaseParams(s.params, defaultParams(s.modelVersionId), defaultParams(versionId)),
    })),
  setParams: patch => set(s => ({ params: { ...s.params, ...patch } })),
  setAspectRatio: aspectRatio => set(s => ({ params: { ...s.params, aspectRatio } })),

  loadPreset: preset =>
    set(s => preset.snapshot ? ({ ...preset.snapshot, presetId: preset.id, docRevision: s.docRevision + 1 }) : ({
      doc: { type: 'doc', content: [{ type: 'paragraph', content: preset.prompt ? [{ type: 'text', text: preset.prompt }] : undefined }] },
      docRevision: s.docRevision + 1,
      recipeIds: [],
      loras: [],
      references: [],
      modelVersionId: preset.modelVersionId,
      params: { ...defaultParams(preset.modelVersionId), ...preset.params, negativePrompt: preset.negativePrompt ?? '' },
      presetId: preset.id,
    })),
  reset: () => set(s => ({ ...newComposerDraft(), docRevision: s.docRevision + 1 })),
}))

/** Selector helpers */
export const selectState = (s: ComposerState & ComposerActions): ComposerState => ({
  promptContext: s.promptContext,
  recipeMetadata: s.recipeMetadata,
  lockedContents: s.lockedContents ?? [],
  doc: s.doc,
  recipeIds: s.recipeIds,
  loras: s.loras,
  references: s.references,
  modelVersionId: s.modelVersionId,
  params: s.params,
  presetId: s.presetId,
})
