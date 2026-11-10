import { describe, expect, it } from 'vitest'
import { looksLikeTags, promptStyleFor, recommendPrompts, type CuratedPrompt } from './recommend'

const curated: CuratedPrompt[] = [
  { text: 'A girl reading under a cherry tree', style: 'natural', locale: 'en' },
  { text: '櫻花樹下讀書的少女', style: 'natural', locale: 'zh' },
  { text: '1girl, cherry blossoms, reading, book', style: 'tags' },
]

describe('promptStyleFor', () => {
  it('maps model families to prompt styles', () => {
    expect(promptStyleFor('MMDIT26B_MODEL')).toBe('natural')
    expect(promptStyleFor('CHAT')).toBe('natural')
    expect(promptStyleFor('SDXL_MODEL')).toBe('tags')
    expect(promptStyleFor('DIT7B_MODEL')).toBe('tags')
  })
})

describe('looksLikeTags', () => {
  it('tells tag strings from sentences', () => {
    expect(looksLikeTags('1girl, solo, long hair, blue eyes, smile')).toBe(true)
    expect(looksLikeTags('character: jashin-chan\n1girl, upper body, from below, smug')).toBe(true)
    expect(looksLikeTags('A wide shot of a girl on a fire escape, looking down into the courtyard at night')).toBe(false)
  })
})

describe('recommendPrompts', () => {
  const history = [
    '1girl, solo, long hair, smile',
    'The character from image1 on a balcony at night',
    'A wide shot of a girl on a fire escape at night',
    'A wide shot of a girl on a fire escape at night',
    'A cat sleeping on a windowsill in the rain',
  ]

  it('puts matching history first, newest first, deduped, then the curated pool for the locale', () => {
    const r = recommendPrompts({ history, curated, modelType: 'MMDIT26B_MODEL', locale: 'zh' })
    expect(r).toEqual([
      { text: 'A wide shot of a girl on a fire escape at night', source: 'history' },
      { text: 'A cat sleeping on a windowsill in the rain', source: 'history' },
      { text: '櫻花樹下讀書的少女', source: 'curated' },
    ])
  })

  it('skips prompts that reference attached images', () => {
    const r = recommendPrompts({ history, curated, modelType: 'MMDIT26B_MODEL', locale: 'en' })
    expect(r.some(p => p.text.includes('image1'))).toBe(false)
  })

  it('uses tag history and tag pool for tag models', () => {
    const r = recommendPrompts({ history, curated, modelType: 'SDXL_MODEL', locale: 'zh' })
    expect(r.map(p => p.text)).toEqual(['1girl, solo, long hair, smile', '1girl, cherry blossoms, reading, book'])
  })

  it('falls back to the curated pool for new users', () => {
    const r = recommendPrompts({ history: [], curated, modelType: 'MMDIT26B_MODEL', locale: 'en' })
    expect(r).toEqual([{ text: 'A girl reading under a cherry tree', source: 'curated' }])
  })

  it('caps history suggestions', () => {
    const many = ['A b c d e', 'F g h i j', 'K l m n o', 'P q r s t']
    expect(recommendPrompts({ history: many, curated: [], modelType: 'CHAT', locale: 'en', maxHistory: 2 })).toHaveLength(2)
  })
})
