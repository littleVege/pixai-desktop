import type { PromptContext } from './lib/promptContext'
import type { JSONContent } from '@tiptap/react'
import type { ReferenceScene } from './lib/reference-scene/types'

/** Base generation model (one per generation). `versionId` is what the API wants. */
export interface Model {
  id: string
  versionId: string
  title: string
  type: string
  cover: string
  refCount: number
  likedCount: number
  defaults: Partial<{ samplingSteps: number; samplingMethod: string; cfgScale: number; width: number; height: number }>
}

export type RecipeSlotType =
  | 'promptFragment'
  | 'contextImages'
  | 'baseImage'
  | 'referenceVideos'
  | 'referenceImages'
  | 'styleCode'
  | 'lora'

/** Recipe: a bundle of ingredients applied by reference, up to MAX_RECIPES, ordered. */
export interface Recipe {
  usability?: 'usable' | 'follow_required' | 'unavailable'
  id: string
  title: string
  description: string
  categories: string[]
  slotTypes: RecipeSlotType[]
  source: 'official' | 'user'
  modelId: string
  modelType: string
  author: string
  cover: string
  stats: { likedCount: number; taskCount: number }
}

/** LoRA: additional model with a per-use weight. */
export interface Lora {
  baseModelTypes?: string[]
  id: string
  versionId: string
  title: string
  cover: string
  triggerWords?: string
  refCount: number
  likedCount: number
}

export interface LoraSelection {
  versionId: string
  weight: number
}

/** An image in the user's Upload Library or Generation History. */
export interface LibraryImage {
  id: string
  mediaId: string
  url: string
  w: number
  h: number
  source: 'upload' | 'generation'
  prompt?: string
  createdAt: string
}

/** A Reference attached to the current generation. Index in the list = mention number. */
export interface Reference {
  id: string
  url: string
  source: 'upload' | 'library' | 'generation' | 'scene'
  mediaId?: string
  name?: string
  /** Only for source 'scene': the Reference Scene this image was rendered from. */
  sceneId?: string
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '3:5' | '5:3' | '9:16' | '16:9' | '1:3' | '3:1'
export type ImageSize = '1k' | '1.5k'
export type BatchSize = 1 | 4

export interface Params {
  aspectRatio: AspectRatio
  size: ImageSize
  batchSize: BatchSize
  steps: number
  cfgScale: number
  sampler: string
  seed: number | null
  negativePrompt: string
}

/** Preset: a private snapshot of the whole Composer state. Loading one replaces everything. */
export interface Preset {
  snapshot?: ComposerState
  id: string
  title: string
  prompt: string
  negativePrompt?: string
  modelVersionId: string
  params: Partial<Params>
}

export interface ComposerState {
  recipeMetadata?: Recipe[]
  promptContext?: PromptContext
  scenes?: Record<string, ReferenceScene>
  lockedContents?: string[]
  doc: JSONContent
  recipeIds: string[]
  loras: LoraSelection[]
  references: Reference[]
  modelVersionId: string
  params: Params
  presetId: string | null
}

export interface Conflicts {
  referencesIgnored: boolean
  negativePromptIgnored: boolean
}

/** Mirrors PixAI public oRPC v2 `ImageCreateRequest`, plus the composer-only `promptDoc`. */
export interface ComposerSubmission {
  prompt: string
  negativePrompt?: string
  modelVersionId: string
  recipeIds: string[]
  loras: { modelId: string; weight: number }[]
  contextImages: string[]
  aspectRatio: AspectRatio
  size: ImageSize
  sampling: { method?: string; steps?: number; cfgScale?: number }
  seed?: number
  batchSize: BatchSize
  promptDoc: JSONContent
}

export const MAX_REFERENCES = 3
export const MAX_RECIPES = 10
export const DEFAULT_LORA_WEIGHT = 0.7
export const LORA_WEIGHT_MIN = 0
export const LORA_WEIGHT_MAX = 1.2
export const LORA_WEIGHT_STEP = 0.05
export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '3:5', '5:3', '9:16', '16:9', '1:3', '3:1']
export const SAMPLERS = ['Euler', 'Euler a', 'DPM++ 2M', 'DPM++ SDE', 'DDIM']

export const MODEL_TYPE_LABEL: Record<string, string> = {
  MMDIT26B_MODEL: 'DiT.3',
  MMDIT26A_MODEL: 'DiT.2',
  DIT7B_MODEL: 'DiT.1',
  SDXL_MODEL: 'SDXL',
  SD_V1_MODEL: 'SD1.5',
  CHAT: 'Edit',
}
export const modelTypeLabel = (type: string) => MODEL_TYPE_LABEL[type] ?? type.replace(/_MODEL$/, '')
