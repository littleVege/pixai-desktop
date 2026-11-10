/** Recommended Prompts: what the empty Composer offers to fill with Tab. */

export type PromptStyle = 'natural' | 'tags'

export interface CuratedPrompt {
  text: string
  style: PromptStyle
  /** Natural-language prompts are written per locale; tag prompts are locale-free. */
  locale?: string
}

export interface RecommendedPrompt {
  text: string
  source: 'history' | 'curated'
}

/** DiT.2 / DiT.3 and the edit models read sentences; the older families read comma-separated tags. */
export const promptStyleFor = (modelType: string): PromptStyle => (/^(MMDIT26|USER_DIT26|CHAT)/.test(modelType) ? 'natural' : 'tags')

/** A prompt reads as tags when its comma-separated segments are short. */
export function looksLikeTags(text: string): boolean {
  const segments = text.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  if (segments.length < 3) return false
  const words = segments.reduce((n, s) => n + s.split(/\s+/).length, 0)
  return words / segments.length <= 3
}

/** References like "image1" point at attachments that are gone once the prompt is reused. */
const IMAGE_REF = /\[?\bimage\d+\b\]?/i

interface Input {
  /** The user's past prompts, most recent first. */
  history: string[]
  curated: CuratedPrompt[]
  modelType: string
  locale: string
  maxHistory?: number
}

export function recommendPrompts({ history, curated, modelType, locale, maxHistory = 3 }: Input): RecommendedPrompt[] {
  const style = promptStyleFor(modelType)
  const seen = new Set<string>()
  const fromHistory: RecommendedPrompt[] = []
  for (const raw of history) {
    const text = raw.trim()
    if (!text || seen.has(text) || IMAGE_REF.test(text)) continue
    if ((looksLikeTags(text) ? 'tags' : 'natural') !== style) continue
    seen.add(text)
    fromHistory.push({ text, source: 'history' })
    if (fromHistory.length >= maxHistory) break
  }
  const pool = curated.filter(c => c.style === style && (style === 'tags' || c.locale === locale))
  const fallback = pool.length ? pool : curated.filter(c => c.style === style)
  return [...fromHistory, ...fallback.map(c => ({ text: c.text, source: 'curated' as const }))]
}
