import { cn } from 'cn'
import type { AspectRatio } from '@/types'

/** A rectangle drawn in the given aspect ratio. */
export function AspectIcon({ ratio, className }: { ratio: AspectRatio; className?: string }) {
  const [w, h] = ratio.split(':').map(Number)
  const s = 12 / Math.max(w, h)
  const rw = w * s
  const rh = h * s
  return (
    <svg viewBox="0 0 16 16" className={cn('size-4 shrink-0', className)} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <rect x={8 - rw / 2} y={8 - rh / 2} width={rw} height={rh} rx={1.5} />
    </svg>
  )
}
