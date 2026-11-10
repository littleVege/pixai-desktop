/** Deterministic SVG gradient placeholders, used for uploads and as fallback when a CDN image fails. */
const PALETTES = [
  ['#f0abfc', '#818cf8'],
  ['#fda4af', '#f59e0b'],
  ['#67e8f9', '#a78bfa'],
  ['#86efac', '#22d3ee'],
  ['#fcd34d', '#fb7185'],
  ['#c4b5fd', '#f9a8d4'],
]

export function placeholderDataUri(seed: string, label = ''): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [a, b] = PALETTES[h % PALETTES.length]
  const angle = h % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="g" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="256" height="256" fill="url(#g)"/>
<circle cx="${60 + (h % 100)}" cy="${80 + ((h >> 3) % 90)}" r="${40 + (h % 30)}" fill="white" fill-opacity=".25"/>
${label ? `<text x="128" y="140" font-family="sans-serif" font-size="36" font-weight="700" fill="white" fill-opacity=".85" text-anchor="middle">${label}</text>` : ''}
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
