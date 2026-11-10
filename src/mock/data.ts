import snapshot from './snapshot.json'
import type { LibraryImage, Lora, Model, Preset, Recipe, RecipeSlotType } from '@/types'

// Offline catalog metadata from the original project, refreshed from the account API.
// These are catalog entries, never user history or fabricated generation results.
export const models: Model[] = snapshot.models as Model[]
export const recipes: Recipe[] = snapshot.recipes.map(r => ({ ...r, slotTypes: r.slotTypes as RecipeSlotType[] })) as Recipe[]
export const loras: Lora[] = []
export const generations: LibraryImage[] = []
export const uploads: LibraryImage[] = []
export const presets: Preset[] = []
export const recentRecipeIds: string[] = []
export const recommendedModelVersionIds: string[] = []
export const recentModelVersionIds: string[] = []
export const DEFAULT_MODEL_VERSION_ID = '2050048243034896798'
export const findModel = (id: string) => models.find(m => m.versionId === id)
export const findRecipe = (id: string) => recipes.find(r => r.id === id)
export const findLora = (id: string) => loras.find(l => l.versionId === id)
export const findPreset = (id: string) => presets.find(p => p.id === id)
export function rememberRecipes(items: Recipe[]) {
  for (const item of items) {
    const index = recipes.findIndex(known => known.id === item.id)
    if (index < 0) recipes.push(item)
    else recipes[index] = item
  }
}
export function updateCatalog(items: any[], type: 'MODEL' | 'LORA') {
  for (const item of items) {
    const versionId = item.latestAvailableVersionId
    if (!versionId) continue
    const collection = type === 'MODEL' ? models : loras
    const index = collection.findIndex(entry => entry.versionId === versionId)
    const previous = collection[index]
    const extra = item.latestAvailableVersion?.extra
    const defaults = previous && 'defaults' in previous ? { ...previous.defaults } : {}
    if (Number.isFinite(extra?.samplingSteps)) defaults.samplingSteps = extra.samplingSteps
    if (Number.isFinite(extra?.cfgScale)) defaults.cfgScale = extra.cfgScale
    if (typeof extra?.samplingMethod === 'string') defaults.samplingMethod = extra.samplingMethod
    const value = {
      ...previous, id: item.id, versionId, title: item.title, type: item.type, baseModelTypes: item.loraBaseModelTypes,
      cover: item.media?.thumbnailUrl || item.media?.publicUrl || item.cover || previous?.cover || '',
      refCount: item.refCount ?? previous?.refCount ?? 0, likedCount: item.likedCount ?? previous?.likedCount ?? 0,
      defaults, triggerWords: Array.isArray(extra?.triggerWords) ? extra.triggerWords.join(', ') : extra?.triggerWords,
    }
    if (index < 0) collection.push(value)
    else collection[index] = value
  }
}
