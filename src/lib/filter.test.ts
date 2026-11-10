import { describe, expect, it } from 'vitest'
import { filterItems } from './filter'

const items = ['Holographic', 'Clean Flat Illustration', 'Cool Warm Oil Contrast', 'Haruka v2 style']

describe('filterItems', () => {
  it('returns everything for an empty query', () => {
    expect(filterItems(items, '  ', s => s)).toEqual(items)
  })
  it('prefers prefix, then substring, then subsequence', () => {
    expect(filterItems(items, 'ho', s => s)).toEqual(['Holographic'])
    expect(filterItems(items, 'oil', s => s)).toEqual(['Cool Warm Oil Contrast'])
    expect(filterItems(items, 'hlg', s => s)).toEqual(['Holographic'])
  })
  it('respects the limit', () => {
    expect(filterItems(items, '', s => s, 2)).toHaveLength(2)
  })
})
