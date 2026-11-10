import { z } from 'zod'
import type { Recipe } from '../src/types'

const slot = z.enum(['promptFragment', 'contextImages', 'baseImage', 'referenceVideos', 'referenceImages', 'styleCode', 'lora'])
const card = z.object({
  id: z.string(), title: z.string(), description: z.string().nullish(), categories: z.array(z.string()), slotTypes: z.array(z.string()),
  source: z.enum(['official', 'user']), modelId: z.string().nullish(), modelType: z.string().nullish(),
  author: z.object({ username: z.string().nullish(), displayName: z.string().nullish() }).nullish(),
  coverMedia: z.object({ urls: z.array(z.object({ variant: z.string(), url: z.string() })).optional(), thumbnailUrl: z.string().nullish(), fileUrl: z.string().nullish() }).nullish(),
  stats: z.object({ likedCount: z.number(), taskCount: z.number() }), usability: z.enum(['usable', 'follow_required', 'unavailable']),
})
export async function searchRecipes(input: unknown, key: string) {
  if (!key) throw new Error('请先配置 PixAI Key')
  const { keyword, page, modelId } = z.object({ keyword: z.string().trim().max(200).default(''), page: z.number().int().min(1).default(1), modelId: z.string().optional() }).parse(input)
  const query = new URLSearchParams({ page: String(page), pageSize: '24' })
  if (keyword) query.set('q', keyword)
  if (modelId) query.set('modelId', modelId)
  const response = await fetch(`https://api.pixai.art/v2/recipes/${keyword ? 'search' : 'latest'}?${query}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`配方目录请求失败 (${response.status})`)
  const result = z.object({ data: z.array(card), totalPage: z.number() }).parse(await response.json())
  const items: Recipe[] = result.data.map(r => ({
    id: r.id, title: r.title, description: r.description ?? '', categories: r.categories, source: r.source, stats: r.stats,
    slotTypes: r.slotTypes.flatMap(type => { const parsed = slot.safeParse(type); return parsed.success ? [parsed.data] : [] }),
    author: r.author?.displayName || r.author?.username || '', cover: r.coverMedia?.thumbnailUrl || r.coverMedia?.urls?.find(u => u.variant === 'THUMBNAIL')?.url || r.coverMedia?.fileUrl || '',
    modelId: r.modelId ?? '', modelType: r.modelType ?? '', usability: r.usability,
  }))
  return { items, totalPage: result.totalPage }
}
