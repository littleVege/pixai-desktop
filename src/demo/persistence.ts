/**
 * Demo-page persistence in localStorage: submission history, the Composer draft, and the
 * Reference Scenes behind its Scene References. Everything survives a reload; nothing is shared.
 *
 * Pure (de)serialisation lives at the top and is unit-tested; the storage and store wiring below it.
 */
import type { JSONContent } from '@tiptap/react'
import type { ComposerState, ComposerSubmission, Reference } from '@/types'
import type { ReferenceScene } from '@/lib/reference-scene/types'
import { promptToDoc } from '@/lib/promptSerialize'
import type { GenerationState } from './generation'

export const STORAGE_PREFIX = 'pixai-composer:v1:'
export const MAX_SUBMISSIONS = 50

export interface SubmissionEntry { id: number; at: Date; s: ComposerSubmission; gen?: GenerationState }
interface StoredSubmission { id: number; at: string; s: Omit<ComposerSubmission, 'promptDoc'>; gen?: GenerationState }

export type Draft = ComposerState & { maxLoras: number }

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

// ---------- submissions ----------

/** Newest first, capped; the editor document is dropped (the prompt text is kept). */
export function serializeSubmissions(list: SubmissionEntry[], max = MAX_SUBMISSIONS): StoredSubmission[] {
  return list.slice(0, max).map(({ id, at, s, gen }) => {
    const { promptDoc: _doc, ...rest } = s
    return { id, at: at.toISOString(), s: rest, gen }
  })
}

/** A task that was still uploading References when the page went away cannot be resumed; a running one can. */
export function reviveSubmissions(raw: unknown): SubmissionEntry[] {
  if (!Array.isArray(raw)) return []
  const out: SubmissionEntry[] = []
  for (const x of raw) {
    if (!isObj(x) || typeof x.id !== 'number' || typeof x.at !== 'string' || !isObj(x.s) || typeof x.s.prompt !== 'string') continue
    const at = new Date(x.at)
    if (Number.isNaN(at.getTime())) continue
    const s = { ...(x.s as Omit<ComposerSubmission, 'promptDoc'>), promptDoc: promptToDoc(x.s.prompt as string) }
    let gen = isObj(x.gen) && typeof x.gen.phase === 'string' ? (x.gen as unknown as GenerationState) : undefined
    if (gen?.phase === 'uploading') gen = { phase: 'failed', error: 'Interrupted by a page reload before the task was created' }
    out.push({ id: x.id, at, s, gen })
  }
  return out.slice(0, MAX_SUBMISSIONS)
}

// ---------- draft ----------

interface Known { modelVersionIds: Set<string>; recipeIds: Set<string>; loraVersionIds: Set<string> }

/**
 * Restore what still makes sense: unknown recipes, LoRAs and models are dropped, and so are References
 * whose image was a `blob:` URL (those die with the page). Returns only the fields that survived.
 */
export function reviveDraft(raw: unknown, known: Known): Partial<Draft> {
  if (!isObj(raw)) return {}
  const d: Partial<Draft> = {}
  if (isObj(raw.doc) && raw.doc.type === 'doc') d.doc = raw.doc as JSONContent
  if (Array.isArray(raw.recipeIds)) d.recipeIds = raw.recipeIds.filter((id): id is string => typeof id === 'string' && known.recipeIds.has(id))
  if (Array.isArray(raw.loras)) {
    d.loras = raw.loras.filter((l): l is Draft['loras'][number] => isObj(l) && typeof l.versionId === 'string' && known.loraVersionIds.has(l.versionId) && typeof l.weight === 'number')
  }
  if (Array.isArray(raw.references)) {
    d.references = raw.references.filter((r): r is Reference =>
      isObj(r) && typeof r.id === 'string' && typeof r.url === 'string' && !r.url.startsWith('blob:') && typeof r.source === 'string')
  }
  if (typeof raw.modelVersionId === 'string' && known.modelVersionIds.has(raw.modelVersionId)) d.modelVersionId = raw.modelVersionId
  if (isObj(raw.params)) d.params = raw.params as unknown as Draft['params']
  if (raw.presetId === null || typeof raw.presetId === 'string') d.presetId = raw.presetId as string | null
  if (raw.maxLoras === 3 || raw.maxLoras === 15) d.maxLoras = raw.maxLoras
  return d
}

/** Mention nodes carry their Reference's image URL; the Reference already stores it, so don't store it twice. */
export function stripMentionUrls(doc: JSONContent): JSONContent {
  const walk = (n: JSONContent): JSONContent => ({
    ...n,
    ...(n.type === 'referenceMention' && n.attrs ? { attrs: { ...n.attrs, url: '' } } : {}),
    ...(n.content ? { content: n.content.map(walk) } : {}),
  })
  return walk(doc)
}

// ---------- scenes ----------

const isScene = (x: unknown): x is ReferenceScene =>
  isObj(x) && typeof x.id === 'string' && Array.isArray(x.figures) && Array.isArray(x.props) && isObj(x.camera)

/** Keep only well-formed scenes that a restored Scene Reference still points at. */
export function reviveScenes(raw: unknown, aliveSceneIds: Set<string>): Record<string, ReferenceScene> {
  if (!isObj(raw)) return {}
  const out: Record<string, ReferenceScene> = {}
  for (const [id, scene] of Object.entries(raw)) if (isScene(scene) && scene.id === id && aliveSceneIds.has(id)) out[id] = scene
  return out
}

// ---------- storage ----------

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(STORAGE_PREFIX + key)
    return s ? JSON.parse(s) : undefined
  } catch {
    return undefined
  }
}

/** False when storage is unavailable or full. */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadSubmissions = () => reviveSubmissions(read('submissions'))

/** When storage is full, keep halving the history until it fits. */
export function saveSubmissions(list: SubmissionEntry[]) {
  for (let max = MAX_SUBMISSIONS; max >= 1; max = Math.floor(max / 2)) if (write('submissions', serializeSubmissions(list, max))) return
}

export function clearSubmissions() {
  try { localStorage.removeItem(STORAGE_PREFIX + 'submissions') } catch { /* storage unavailable */ }
}

// ---------- images: blob: URLs → data: URLs ----------

const MAX_INLINE_BYTES = 700 * 1024
const dataUrlCache = new Map<string, string>()

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** Large uploads are re-encoded as WebP, 1280 px long edge, so three References fit in localStorage. */
async function shrink(blob: Blob): Promise<Blob> {
  if (blob.size <= MAX_INLINE_BYTES) return blob
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/webp', 0.85))
}

async function storableUrl(url: string): Promise<string | null> {
  if (!url.startsWith('blob:')) return url
  const hit = dataUrlCache.get(url)
  if (hit) return hit
  try {
    const data = await blobToDataUrl(await shrink(await (await fetch(url)).blob()))
    dataUrlCache.set(url, data)
    return data
  } catch {
    return null
  }
}

// ---------- wiring ----------

/** Call once before the first render, so the editor mounts with the restored document. */
export async function restorePersisted() {
  const [{ useComposerStore }, { useReferenceSceneStore }, mock] = await Promise.all([
    import('@/store/composerStore'),
    import('@/store/referenceSceneStore'),
    import('@/mock/data'),
  ])
  const draft = reviveDraft(read('draft'), {
    modelVersionIds: new Set(mock.models.map(m => m.versionId)),
    recipeIds: new Set(mock.recipes.map(r => r.id)),
    loraVersionIds: new Set(mock.loras.map(l => l.versionId)),
  })
  if (Object.keys(draft).length) useComposerStore.setState(draft)
  const alive = new Set(useComposerStore.getState().references.map(r => r.sceneId).filter((id): id is string => !!id))
  const scenes = reviveScenes(read('scenes'), alive)
  if (Object.keys(scenes).length) useReferenceSceneStore.setState({ scenes })
}

/** Keep the draft and scenes in storage as they change. */
export async function startPersistence() {
  const [{ useComposerStore }, { useReferenceSceneStore }] = await Promise.all([import('@/store/composerStore'), import('@/store/referenceSceneStore')])

  let timer: ReturnType<typeof setTimeout> | undefined
  let run = 0
  const saveDraft = async () => {
    const mine = ++run
    const s = useComposerStore.getState()
    const references = (await Promise.all(s.references.map(async r => {
      const url = await storableUrl(r.url)
      return url ? { ...r, url } : null
    }))).filter((r): r is Reference => r !== null)
    if (mine !== run) return // a newer save started while images were converting
    const draft: Draft = { doc: stripMentionUrls(s.doc), recipeIds: s.recipeIds, loras: s.loras, references, modelVersionId: s.modelVersionId, params: s.params, presetId: s.presetId, maxLoras: s.maxLoras }
    // Full storage: keep the text and settings, give up the uploaded images (Scene References last).
    if (!write('draft', draft) && !write('draft', { ...draft, references: references.filter(r => r.source === 'scene' || !r.url.startsWith('data:')) })) {
      write('draft', { ...draft, references: references.filter(r => !r.url.startsWith('data:')) })
    }
  }
  useComposerStore.subscribe((state, prev) => {
    if (state.doc === prev.doc && state.recipeIds === prev.recipeIds && state.loras === prev.loras && state.references === prev.references
      && state.modelVersionId === prev.modelVersionId && state.params === prev.params && state.presetId === prev.presetId && state.maxLoras === prev.maxLoras) return
    clearTimeout(timer)
    timer = setTimeout(() => void saveDraft(), 400)
  })
  useReferenceSceneStore.subscribe((state, prev) => {
    if (state.scenes !== prev.scenes) write('scenes', state.scenes)
  })
}
