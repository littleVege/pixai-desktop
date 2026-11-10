/** Case-insensitive subsequence match with substring preference. Returns items sorted by match quality. */
export function filterItems<T>(items: T[], query: string, text: (item: T) => string, limit = Infinity): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items.slice(0, limit)
  const scored: { item: T; score: number }[] = []
  for (const item of items) {
    const s = text(item).toLowerCase()
    if (s.startsWith(q)) scored.push({ item, score: 0 })
    else if (s.includes(q)) scored.push({ item, score: 1 })
    else if (isSubsequence(q, s)) scored.push({ item, score: 2 })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(x => x.item)
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0
  for (const ch of s) if (ch === q[i]) i++
  return i === q.length
}
