/**
 * Composer submission → PixAI legacy task parameters (the JSON `createGenerationTask` takes).
 * Field names mirror pixai-server `buildCoreTaskParameters` (src/api/orpc/routes/helpers/v2ImageParams.ts).
 */

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '3:5' | '5:3' | '9:16' | '16:9' | '1:3' | '3:1'
export type ImageSize = '1k' | '1.5k'

export interface GenerateRequest {
  prompt: string
  negativePrompt?: string
  modelVersionId: string
  /** Model type from the model catalogue, e.g. MMDIT26B_MODEL; decides profile vs. sampling fields. */
  modelType: string
  recipeIds: string[]
  loras: { modelId: string; weight: number }[]
  /** PixAI media ids, in Reference order (image1, image2, …). */
  contextImages: string[]
  aspectRatio: AspectRatio
  size: ImageSize
  sampling: { method?: string; steps?: number; cfgScale?: number }
  seed?: number
  batchSize: 1 | 4
}

/** pixai-contract `RESOLUTION_MAP` (src/api/orpc/image/resolution.ts). */
const RESOLUTION: Record<ImageSize, Record<AspectRatio, [number, number]>> = {
  '1k': {
    '1:1': [1024, 1024], '2:3': [848, 1280], '3:2': [1280, 848], '3:4': [864, 1152], '4:3': [1152, 864],
    '3:5': [768, 1280], '5:3': [1280, 768], '9:16': [720, 1280], '16:9': [1280, 720], '1:3': [512, 1536], '3:1': [1536, 512],
  },
  '1.5k': {
    '1:1': [1536, 1536], '2:3': [1024, 1536], '3:2': [1536, 1024], '3:4': [1152, 1536], '4:3': [1536, 1152],
    '3:5': [912, 1536], '5:3': [1536, 912], '9:16': [864, 1536], '16:9': [1536, 864], '1:3': [512, 1536], '3:1': [1536, 512],
  },
}

export const resolveResolution = (ratio: AspectRatio, size: ImageSize) => RESOLUTION[size]?.[ratio] ?? RESOLUTION['1k']['1:1']

/** Tsubaki.3 Flash bills as its own tier and takes no profile name. */
const MMDIT26B_FLASH = new Set(['2050048243034896798'])
const SAMPLING_MODEL_TYPES = new Set(['SDXL_MODEL', 'SD_V1_MODEL'])
/** Models that accept context images (in-context generation). */
export const CONTEXT_IMAGE_MODEL_TYPES = new Set(['MMDIT26B_MODEL'])

function inferenceProfile(modelType: string, versionId: string): string | undefined {
  if (modelType === 'MMDIT26B_MODEL') return MMDIT26B_FLASH.has(versionId) ? undefined : 'pro'
  if (modelType === 'MMDIT26A_MODEL') return 'standard'
  return undefined
}

export class RequestError extends Error {}

export function toTaskParameters(req: GenerateRequest): Record<string, unknown> {
  if (!req.prompt.trim() && req.recipeIds.length === 0) throw new RequestError('A prompt or at least one recipe is required.')
  if (req.contextImages.length > 3) throw new RequestError('At most 3 context images.')
  if (req.contextImages.length && !CONTEXT_IMAGE_MODEL_TYPES.has(req.modelType)) throw new RequestError(`Model type ${req.modelType} does not take reference images.`)
  if (req.contextImages.some(id => !/^\d+$/.test(id))) throw new RequestError('Context images must be PixAI media ids.')
  const [width, height] = resolveResolution(req.aspectRatio, req.size)
  const profile = inferenceProfile(req.modelType, req.modelVersionId)
  const params: Record<string, unknown> = {
    extra: {},
    priority: 1000,
    modelId: req.modelVersionId,
    prompts: req.prompt,
    width,
    height,
    batchSize: req.batchSize,
    controlNets: [],
    promptHelper: { userWantToEnable: false, forcePromptHelperDetectionSide: 'server' },
  }
  if (profile) params.inferenceProfile = profile
  if (req.negativePrompt?.trim()) params.negativePrompts = req.negativePrompt.trim()
  if (req.seed !== undefined && req.seed !== null) params.seed = String(req.seed)
  if (SAMPLING_MODEL_TYPES.has(req.modelType)) {
    if (req.sampling.steps) params.samplingSteps = req.sampling.steps
    if (req.sampling.method) params.samplingMethod = req.sampling.method
    if (req.sampling.cfgScale) params.cfgScale = req.sampling.cfgScale
  }
  if (req.loras.length) {
    params.lora = Object.fromEntries(req.loras.map(l => [l.modelId, l.weight]))
    params.loraParameters = req.loras.map(l => ({ versionId: l.modelId, weight: l.weight }))
  }
  if (req.recipeIds.length) params.recipeIds = [...req.recipeIds]
  if (req.contextImages.length) params.contextImages = [...req.contextImages]
  return params
}
