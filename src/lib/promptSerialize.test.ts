import { describe, expect, it } from 'vitest'
import { docToPrompt, docIsEmpty, mentionedRefIds, promptToDoc } from './promptSerialize'
import type { Reference } from '@/types'

const refs: Reference[] = [
  { id: 'a', url: '', source: 'upload' },
  { id: 'b', url: '', source: 'generation' },
]
const doc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'the pose of ' }, { type: 'referenceMention', attrs: { refId: 'b' } }, { type: 'text', text: ' and face of ' }, { type: 'referenceMention', attrs: { refId: 'a' } }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'cinematic' }] },
  ],
}

describe('docToPrompt', () => {
  it('numbers mentions by attachment order and joins paragraphs with newlines', () => {
    expect(docToPrompt(doc, refs)).toBe('the pose of image2 and face of image1\ncinematic')
  })
  it('drops mentions whose reference is gone', () => {
    expect(docToPrompt(doc, [refs[0]])).toBe('the pose of  and face of image1\ncinematic')
  })
  it('treats whitespace-only docs as empty, mentions as non-empty', () => {
    expect(docIsEmpty({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }] })).toBe(true)
    expect(docIsEmpty({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'referenceMention', attrs: { refId: 'a' } }] }] })).toBe(false)
    expect(docIsEmpty(undefined)).toBe(true)
  })
  it('collects mentioned ids', () => {
    expect([...mentionedRefIds(doc)].sort()).toEqual(['a', 'b'])
  })
})

describe('promptToDoc', () => {
  it('restores reference identity so attachment reordering keeps the intended image', () => {
    const enhanced = promptToDoc('pose of image2\nface of image1', refs)
    expect([...mentionedRefIds(enhanced)]).toEqual(['b', 'a'])
    expect(docToPrompt(enhanced, refs)).toBe('pose of image2\nface of image1')
    expect(docToPrompt(enhanced, [...refs].reverse())).toBe('pose of image1\nface of image2')
  })
  it('leaves unknown image labels and ordinary substrings as text', () => {
    const text = 'image9, myimage1, image1 and image2'
    expect(docToPrompt(promptToDoc(text, refs), refs)).toBe(text)
    expect([...mentionedRefIds(promptToDoc(text, refs))]).toEqual(['a', 'b'])
  })
  it('round-trips multi-line text through docToPrompt', () => {
    const text = 'character: jashin-chan\n1girl, smug, fangs'
    expect(docToPrompt(promptToDoc(text), [])).toBe(text)
  })
})
