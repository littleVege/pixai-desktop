import type { JSONContent } from '@tiptap/react'
import type { Reference } from '../types'

export const REFERENCE_MENTION = 'referenceMention'

/** Serialise the editor document to plain text; Reference Mentions become `image1`, `image2`… by attachment order. */
export function docToPrompt(doc: JSONContent | undefined, references: Reference[]): string {
  if (!doc) return ''
  const index = new Map(references.map((r, i) => [r.id, i + 1]))
  const out: string[] = []
  const walk = (node: JSONContent) => {
    if (node.type === 'text') out.push(node.text ?? '')
    else if (node.type === REFERENCE_MENTION) {
      const n = index.get(String(node.attrs?.refId))
      out.push(n ? `image${n}` : '')
    } else if (node.type === 'hardBreak') out.push('\n')
    else if (node.type === 'paragraph') {
      node.content?.forEach(walk)
      out.push('\n')
    } else node.content?.forEach(walk)
  }
  walk(doc)
  return out.join('').replace(/[ \t]+\n/g, '\n').trim()
}

export function docIsEmpty(doc: JSONContent | undefined): boolean {
  return docToPrompt(doc, []).length === 0 && !containsMention(doc)
}

export function containsMention(doc: JSONContent | undefined): boolean {
  if (!doc) return false
  if (doc.type === REFERENCE_MENTION) return true
  return doc.content?.some(containsMention) ?? false
}

/** Ids of references mentioned in the document. */
export function mentionedRefIds(doc: JSONContent | undefined): Set<string> {
  const ids = new Set<string>()
  const walk = (n: JSONContent) => {
    if (n.type === REFERENCE_MENTION && n.attrs?.refId) ids.add(String(n.attrs.refId))
    n.content?.forEach(walk)
  }
  if (doc) walk(doc)
  return ids
}

/** Plain text to an editor document; each line becomes a paragraph. */
export function promptToDoc(text: string, references: Reference[] = []): JSONContent {
  const paragraph = (line: string): JSONContent => {
    const content: JSONContent[] = []
    let cursor = 0
    for (const match of line.matchAll(/\bimage([1-9]\d*)\b/g)) {
      const reference = references[Number(match[1]) - 1]
      if (!reference) continue
      if (match.index > cursor) content.push({ type: 'text', text: line.slice(cursor, match.index) })
      content.push({ type: REFERENCE_MENTION, attrs: { refId: reference.id, label: match[1], url: reference.url } })
      cursor = match.index + match[0].length
    }
    if (cursor < line.length) content.push({ type: 'text', text: line.slice(cursor) })
    return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
  }
  return {
    type: 'doc',
    content: text.split('\n').map(paragraph),
  }
}
