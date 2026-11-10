/** Minimal PixAI GraphQL client: upload media, create a task, read a task, resolve media URLs. */

const GRAPHQL_URL = 'https://api.pixai.art/graphql'
// api.pixai.art sits behind a WAF that filters non-browser user agents.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

export class PixaiError extends Error {
  readonly status: number
  constructor(message: string, status = 502) { super(message); this.status = status }
}

export interface MediaInfo { id: string; width: number | null; height: number | null; urls: { variant: string; url: string }[] }

export function createPixaiClient(apiKey: string) {
  async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    let res: Response
    try {
      res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT, Accept: 'application/graphql-response+json,application/json;q=0.9' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(60_000),
      })
    } catch (err) {
      const cause = (err as { cause?: { code?: string; message?: string } }).cause
      throw new PixaiError(`Could not reach PixAI: ${err instanceof Error ? err.message : String(err)}${cause ? ` (${cause.code ?? ''} ${cause.message ?? ''})` : ''}`)
    }
    const text = await res.text()
    if (res.status === 401) throw new PixaiError('PixAI rejected the API key (401). PIXAI_API_KEY is wrong or expired.', 401)
    if (!res.ok) throw new PixaiError(`PixAI GraphQL HTTP ${res.status}: ${text.slice(0, 500)}`)
    const payload = JSON.parse(text) as { data?: T; errors?: { message?: string }[] }
    if (payload.errors?.length) throw new PixaiError(`PixAI: ${payload.errors.map(e => e.message ?? JSON.stringify(e)).join('; ')}`)
    if (!payload.data) throw new PixaiError('PixAI response had no data')
    return payload.data
  }

  const UPLOAD = 'mutation uploadMedia($input: UploadMediaInput!) { uploadMedia(input: $input) { mediaId uploadUrl } }'
  // media(id:) takes String!, task(id:) takes ID!.
  const MEDIA = 'query media($id: String!) { media(id: $id) { id width height urls { variant url } } }'

  async function media(id: string): Promise<MediaInfo> {
    const data = await graphql<{ media: MediaInfo | null }>(MEDIA, { id })
    if (!data.media) throw new PixaiError(`Media ${id} not found`)
    return data.media
  }

  async function experimentRequest(id: string, choice?: string) {
    const endpoint = 'https://api.pixai.art/v2/task/' + encodeURIComponent(id) + '/model-experiment-session'
    const response = await fetch(choice ? endpoint + '/preference' : endpoint, {
      method: choice ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, 'User-Agent': USER_AGENT, ...(choice && { 'Content-Type': 'application/json' }) },
      body: choice ? JSON.stringify({ choice }) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    if (!choice && response.status === 404) return null
    if (!response.ok) throw new PixaiError(`PixAI 选图请求失败（HTTP ${response.status}）`, response.status)
    return response.json()
  }

  return {
    media,
    experiment: (id: string) => experimentRequest(id),
    chooseExperiment: (id: string, choice: string) => experimentRequest(id, choice),

    /** Three steps: presigned URL, PUT the bytes, register with the server's storage key. */
    async uploadImage(bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<MediaInfo> {
      const first = await graphql<{ uploadMedia: { uploadUrl: string | null } }>(UPLOAD, { input: { type: 'IMAGE', provider: 'S3' } })
      const uploadUrl = first.uploadMedia.uploadUrl
      if (!uploadUrl) throw new PixaiError('uploadMedia returned no upload URL')
      const externalId = new URL(uploadUrl).pathname.split('/').pop()
      if (!externalId) throw new PixaiError('Could not read the storage key from the upload URL')
      const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType, 'User-Agent': USER_AGENT }, body: bytes, signal: AbortSignal.timeout(180_000) })
      if (!put.ok) throw new PixaiError(`Upload PUT failed: HTTP ${put.status}`)
      const second = await graphql<{ uploadMedia: { mediaId: string | null } }>(UPLOAD, { input: { type: 'IMAGE', provider: 'S3', externalId } })
      const mediaId = second.uploadMedia.mediaId
      if (!mediaId) throw new PixaiError('Registering the upload returned no media id')
      const info = await media(mediaId)
      // A 0×0 media means the key was registered but nothing landed there.
      if (!info.width || !info.height) throw new PixaiError(`Media ${mediaId} came back ${info.width}×${info.height}; the upload did not land`)
      return info
    },

    async createTask(parameters: Record<string, unknown>): Promise<string> {
      const data = await graphql<{ createGenerationTask: { id: string } | null }>(
        'mutation createGenerationTask($parameters: JSONObject!) { createGenerationTask(parameters: $parameters) { id } }', { parameters })
      const id = data.createGenerationTask?.id
      if (!id) throw new PixaiError('createGenerationTask returned no id')
      return id
    },

    async task(id: string) {
      const data = await graphql<{ task: { id: string; updatedAt: string; status: string | null; outputs: Record<string, unknown> | null } | null }>(
        'query task($id: ID!) { task(id: $id) { id updatedAt status outputs } }', { id })
      if (!data.task) throw new PixaiError(`Task ${id} not found`, 404)
      return data.task
    },
  }
}

export type PixaiClient = ReturnType<typeof createPixaiClient>

/** Every media id in a task's outputs; batches report them under plural keys. */
export function mediaIdsFromOutputs(outputs: Record<string, unknown> | null | undefined): string[] {
  if (!outputs) return []
  if (Array.isArray(outputs.batch) && outputs.batch.length) {
    const media = outputs.batch.flatMap(item => item && typeof item === 'object' && typeof item.mediaId === 'string' && item.mediaId && !item.deletedAt ? [item.mediaId as string] : [])
    return [...new Set(media)]
  }
  const ids: string[] = []
  if (outputs.mediaId) ids.push(String(outputs.mediaId))
  for (const key of ['mediaIds', 'medias', 'media']) {
    const v = outputs[key]
    if (Array.isArray(v)) for (const item of v) {
      if (typeof item === 'string') ids.push(item)
      else if (item && typeof item === 'object' && 'id' in item) ids.push(String((item as { id: unknown }).id))
    }
  }
  return [...new Set(ids)]
}

export const RUNNING = new Set(['waiting', 'pending', 'queued', 'running', 'processing', 'in_progress'])
export const SUCCEEDED = new Set(['completed', 'done', 'success', 'succeeded'])
export const FAILED = new Set(['failed', 'error', 'cancelled', 'canceled'])

/** The full-size URL of a media: the PUBLIC variant, else anything but the thumbnail. */
export function bestUrl(m: MediaInfo): string | null {
  return m.urls.find(u => u.variant === 'PUBLIC')?.url ?? m.urls.find(u => u.variant !== 'THUMBNAIL' && u.url)?.url ?? null
}
