import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { MediaImg } from '../shared/MediaImg'

export interface SelectedItem {
  id: string
  cover?: string
  name: string
  /** Small trailing text, e.g. a LoRA weight. */
  meta?: string
}

/** The current selection as removable avatar + name pills, pinned at the top of a picker. */
export function SelectedStrip({ items, max, onRemove, avatar = 'circle' }: { items: SelectedItem[]; max: number; onRemove: (id: string) => void; avatar?: 'circle' | 'square' }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 pt-1.5 text-xs text-muted-foreground tabular-nums">{items.length}/{max}</span>
      {items.length === 0 ? (
        <span className="pt-1.5 text-xs text-muted-foreground">{t('nothing-selected', { max })}</span>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {items.map(item => (
            <li key={item.id} className="flex h-8 max-w-56 items-center gap-1.5 rounded-full border bg-secondary py-1 pr-1 pl-1 text-sm text-secondary-foreground">
              <MediaImg src={item.cover} seed={item.id} className={avatar === 'circle' ? 'size-6 rounded-full' : 'size-6 rounded-md'} />
              <span className="min-w-0 truncate">{item.name}</span>
              {item.meta && <span className="font-mono text-[11px] text-muted-foreground">{item.meta}</span>}
              <button type="button" onClick={() => onRemove(item.id)} aria-label={`${t('remove')} ${item.name}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
