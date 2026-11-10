import { useComposerStore } from '@/store/composerStore'
import { findModel } from '@/mock/data'
import type { ComposerSubmission, Reference } from '@/types'

/** Talks to the demo server (server/index.ts), which holds the PixAI key. */

export interface GeneratedImage { mediaId: string; url: string | null }
export type GenerationState =
  | { phase: 'uploading' }
  | { phase: 'running'; taskId: string; status: string }
  | { phase: 'done'; taskId: string; images: GeneratedImage[] }
  | { phase: 'failed'; error: string; taskId?: string }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  return body as T
}

export const serverHealth = () => api<{ ok: boolean; hasKey: boolean }>('/api/health')

const isPixaiMediaId = (id: string | undefined): id is string => !!id && /^\d+$/.test(id)

/** Any image URL → PNG/JPEG/WebP bytes PixAI accepts (SVG placeholders get rasterised). */
async function toUploadable(url: string): Promise<Blob> {
  const blob = await (await fetch(url)).blob()
  if (['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) return blob
  const img = new Image()
  img.src = URL.createObjectURL(blob)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || 1024
  canvas.height = img.naturalHeight || 1024
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(img.src)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png'))
}

/** The Reference's PixAI media id, uploading it first if it has none. Caches the id on the Reference. */
async function ensureMediaId(ref: Reference): Promise<string> {
  if (isPixaiMediaId(ref.mediaId)) return ref.mediaId
  const blob = await toUploadable(ref.url)
  const { mediaId } = await api<{ mediaId: string }>('/api/media', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })
  useComposerStore.getState().replaceReference(ref.id, { mediaId })
  return mediaId
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Upload References, create the task, poll until it finishes. Reports progress through `onState`. */
export async function generate(submission: ComposerSubmission, references: Reference[], onState: (s: GenerationState) => void) {
  let taskId: string | undefined
  try {
    onState({ phase: 'uploading' })
    const contextImages = await Promise.all(references.map(ensureMediaId))
    const created = await api<{ taskId: string }>('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...submission, promptDoc: undefined, contextImages, modelType: findModel(submission.modelVersionId)?.type ?? '' }),
    })
    taskId = created.taskId
    await poll(taskId, onState)
  } catch (err) {
    onState({ phase: 'failed', taskId, error: err instanceof Error ? err.message : String(err) })
  }
}

/** Poll an existing task until it finishes (also used to resume after a page reload). */
async function poll(taskId: string, onState: (s: GenerationState) => void) {
  onState({ phase: 'running', taskId, status: 'queued' })
  const deadline = Date.now() + 6 * 60_000
  while (Date.now() < deadline) {
    await sleep(2500)
    const t = await api<{ status: string; done: boolean; failed: boolean; error?: string; images: GeneratedImage[] }>(`/api/tasks/${taskId}`)
    if (t.failed) { onState({ phase: 'failed', taskId, error: t.error ?? t.status }); return }
    if (t.done) { onState({ phase: 'done', taskId, images: t.images }); return }
    onState({ phase: 'running', taskId, status: t.status || 'running' })
  }
  onState({ phase: 'failed', taskId, error: 'Timed out after 6 minutes' })
}

export async function resumeGeneration(taskId: string, onState: (s: GenerationState) => void) {
  try {
    await poll(taskId, onState)
  } catch (err) {
    onState({ phase: 'failed', taskId, error: err instanceof Error ? err.message : String(err) })
  }
}
