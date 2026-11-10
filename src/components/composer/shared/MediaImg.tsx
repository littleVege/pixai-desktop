import { useState } from 'react'
import { placeholderDataUri } from '@/mock/placeholders'
import { cn } from 'cn'

/** <img> that falls back to a deterministic gradient when the CDN image fails to load. */
export function MediaImg({ src, seed, alt = '', className, ...rest }: React.ComponentProps<'img'> & { seed: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <img
      src={failed || !src ? placeholderDataUri(seed) : src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('bg-muted object-cover', className)}
      {...rest}
    />
  )
}
