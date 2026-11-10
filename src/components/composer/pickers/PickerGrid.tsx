import { Check } from 'lucide-react'
import { cn } from 'cn'
import { MediaImg } from '../shared/MediaImg'

interface CardProps {
  cover: string
  seed: string
  title: string
  subtitle?: string
  badges?: string[]
  selected?: boolean
  disabled?: boolean
  onClick: () => void
  aspect?: 'portrait' | 'square'
}

export function PickerCard({ cover, seed, title, subtitle, badges, selected, disabled, onClick, aspect = 'portrait' }: CardProps) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cn('group flex flex-col gap-1.5 rounded-xl p-1 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-ring', !selected && 'hover:bg-muted', disabled && 'opacity-40')}>
      <div className={cn('relative w-full overflow-hidden rounded-lg border', aspect === 'portrait' ? 'aspect-3/4' : 'aspect-square', selected && 'border-transparent ring-2 ring-primary ring-offset-2 ring-offset-background')}>
        <MediaImg src={cover} seed={seed} className="size-full transition group-hover:scale-[1.03]" />
        {selected && <span className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5 text-primary-foreground shadow"><Check className="size-3.5" /></span>}
        {badges && badges.length > 0 && (
          <div className="absolute bottom-1 left-1 flex flex-wrap gap-1">
            {badges.map(b => <span key={b} className="rounded bg-black/60 px-1 text-[10px] text-white">{b}</span>)}
          </div>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <div className={cn('truncate text-sm font-medium', selected && 'text-primary')}>{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </button>
  )
}

export function PickerGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 }) {
  return <div className={cn('grid gap-2', cols === 3 ? 'grid-cols-3' : cols === 5 ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4')}>{children}</div>
}
