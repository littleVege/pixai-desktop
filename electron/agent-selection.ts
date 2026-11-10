import type { ComposerState, LoraSelection } from '../src/types'

export interface CatalogSelection {
  versionId: string
  title: string
  type: string
  usageType: 'MODEL' | 'LORA'
  baseModelTypes?: string[]
  triggerWords?: unknown
}

// Mirrors PixAI's isLoraCompatWithModel: distinct DiT generations stay distinct.
const families = ['SD_V1_MODEL', 'SDXL_MODEL', 'MMDIT26A_MODEL', 'MMDIT26B_MODEL', 'USER_DIT26A_MODEL', 'USER_DIT26B_MODEL']
export function compatibleLora(model: string, lora: string) {
  return (families.includes(model) && model === lora) ||
    (['DIT7_MODEL', 'DIT7B_MODEL'].includes(model) && ['DIT7_MODEL', 'DIT7B_MODEL'].includes(lora))
}

export function resolveAgentSelection(state: ComposerState, catalog: CatalogSelection[], selection: {
  modelVersionId: string; modelType: string; loras?: LoraSelection[]
}): ComposerState {
  if (state.modelVersionId && state.modelVersionId !== selection.modelVersionId) throw new Error('不能替换用户指定模型')
  const model = catalog.find(item => item.usageType === 'MODEL' && item.versionId === selection.modelVersionId)
    ?? (state.promptContext?.model?.versionId === selection.modelVersionId ? state.promptContext.model : undefined)
  if (!model) throw new Error('请先搜索并确认所选模型版本')
  if (model.type !== selection.modelType) throw new Error('模型类型与目录不一致')
  const selected = selection.loras ?? state.loras
  const ids = new Set<string>()
  for (const lora of selected) {
    if (ids.has(lora.versionId)) throw new Error('不能重复选择同一 LoRA')
    ids.add(lora.versionId)
    if (!Number.isFinite(lora.weight) || lora.weight < 0 || lora.weight > 1.2) throw new Error('LoRA 权重超出范围')
  }
  for (const original of state.loras) {
    if (!selected.some(item => item.versionId === original.versionId && item.weight === original.weight)) throw new Error('不能移除或修改用户指定 LoRA')
  }
  const loras = selected.map(item => {
    const original = state.loras.find(lora => lora.versionId === item.versionId)
    const saved = state.promptContext?.loras.find(lora => lora.versionId === item.versionId)
    if (original && saved) return { ...saved, ...item }
    const found = catalog.find(entry => entry.usageType === 'LORA' && entry.versionId === item.versionId)
    if (!found && original) return { ...item, title: item.versionId, triggerWords: [] }
    if (!found) throw new Error('请先搜索并确认所选 LoRA 版本')
    if (!(found.baseModelTypes?.length ? found.baseModelTypes : [found.type]).some(type => compatibleLora(model.type, type))) throw new Error('LoRA 与基础模型类型不兼容')
    const words = found.triggerWords
    return { ...item, title: found.title, triggerWords: (typeof words === 'string' ? [words] : Array.isArray(words) ? words.filter((word): word is string => typeof word === 'string') : []).filter(word => word.trim()) }
  })
  return { ...state, modelVersionId: selection.modelVersionId, loras: selected,
    promptContext: { model: { versionId: model.versionId, title: model.title, type: model.type }, loras,
      referenceLabels: state.promptContext?.referenceLabels ?? state.references.map((ref, i) => ({ id: ref.id, label: `image${i + 1}`, name: ref.name })),
      guidance: state.promptContext?.guidance ?? { source: 'No verified style guidance', verification: 'provisional', style: 'unknown' },
    },
  }
}
