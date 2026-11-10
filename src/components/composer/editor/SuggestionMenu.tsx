import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChefHat, Layers, Images, ChevronRight, Check } from 'lucide-react'
import { cn } from 'cn'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSuggestionStore } from './suggestionStore'
import { useComposerStore } from '@/store/composerStore'
import { filterItems } from '@/lib/filter'
import { generations, loras, recentRecipeIds, recipes, uploads } from '@/mock/data'
import type { LibraryImage, Lora, Recipe } from '@/types'
import { MAX_REFERENCES } from '@/types'
import { MediaImg } from '../shared/MediaImg'

type Item =
  | { kind: 'recipe'; key: string; recipe: Recipe }
  | { kind: 'lora'; key: string; lora: Lora }
  | { kind: 'browse'; key: string; target: 'recipes' | 'loras' | 'references' }
  | { kind: 'reference'; key: string; image: LibraryImage; attached: boolean }

interface Props {
  onBrowse: (target: 'recipes' | 'loras' | 'references') => void
}

const PER_SECTION = 4

export function SuggestionMenu({ onBrowse }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { kind, query, rect, selectedIndex, command } = useSuggestionStore()
  const setItemCount = useSuggestionStore(s => s.setItemCount)
  const setOnPick = useSuggestionStore(s => s.setOnPick)
  const exit = useSuggestionStore(s => s.exit)
  const recipeIds = useComposerStore(s => s.recipeIds)
  const selectedLoras = useComposerStore(s => s.loras)
  const references = useComposerStore(s => s.references)
  const toggleRecipe = useComposerStore(s => s.toggleRecipe)
  const toggleLora = useComposerStore(s => s.toggleLora)
  const addReference = useComposerStore(s => s.addReference)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<Item[]>(() => {
    if (kind === 'slash') {
      const recentFirst = [...recipes].sort((a, b) => Number(recentRecipeIds.includes(b.id)) - Number(recentRecipeIds.includes(a.id)))
      const rs = filterItems(recentFirst, query, r => r.title, PER_SECTION)
      const ls = filterItems(loras, query, l => l.title, PER_SECTION)
      return [
        ...rs.map<Item>(r => ({ kind: 'recipe', key: `r-${r.id}`, recipe: r })),
        ...ls.map<Item>(l => ({ kind: 'lora', key: `l-${l.versionId}`, lora: l })),
        { kind: 'browse', key: 'browse-recipes', target: 'recipes' },
        { kind: 'browse', key: 'browse-loras', target: 'loras' },
      ]
    }
    if (kind === 'at') {
      const attachedIds = new Set(references.map(r => r.id))
      const attached = references.map<Item>(r => ({
        kind: 'reference',
        key: `a-${r.id}`,
        attached: true,
        image: { id: r.id, mediaId: r.mediaId ?? r.id, url: r.url, w: 1, h: 1, source: r.source === 'generation' ? 'generation' : 'upload', prompt: r.name, createdAt: '' },
      }))
      const notAttached = (i: LibraryImage) => !attachedIds.has(i.id)
      const ups = filterItems(uploads.filter(notAttached), query, i => i.prompt ?? i.id, 3)
      const gens = filterItems(generations.filter(notAttached), query, i => i.prompt ?? i.id, 3)
      return [
        ...filterItems(attached, query, i => (i.kind === 'reference' ? i.image.prompt ?? '' : ''), 3),
        ...ups.map<Item>(i => ({ kind: 'reference', key: `p-${i.id}`, image: i, attached: false })),
        ...gens.map<Item>(i => ({ kind: 'reference', key: `p-${i.id}`, image: i, attached: false })),
        { kind: 'browse', key: 'browse-refs', target: 'references' },
      ]
    }
    return []
  }, [kind, query, references])

  const pick = (item: Item) => {
    if (!command) return
    if (item.kind === 'browse') {
      command({})
      exit()
      onBrowse(item.target)
      return
    }
    if (item.kind === 'recipe') { command({}); toggleRecipe(item.recipe.id); return }
    if (item.kind === 'lora') { command({}); toggleLora(item.lora.versionId); return }
    if (item.kind === 'reference') {
      let index = references.findIndex(r => r.id === item.image.id)
      if (index < 0) {
        const res = addReference({ id: item.image.id, url: item.image.url, mediaId: item.image.mediaId, source: item.image.source === 'generation' ? 'generation' : 'library', name: item.image.prompt })
        if (res === 'full') return
        index = references.length
      }
      command({ refId: item.image.id, label: String(index + 1), url: item.image.url })
    }
  }

  useEffect(() => { setItemCount(items.length) }, [items.length, setItemCount])
  useEffect(() => {
    setOnPick(() => { const it = items[selectedIndex]; if (it) pick(it) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedIndex, command, references])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!kind) return null

  const referencesFull = references.length >= MAX_REFERENCES
  const style: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 8, right: 8, bottom: 8 }
    : rect
      ? window.innerHeight - rect.bottom < 360
        ? { position: 'fixed', left: Math.min(rect.left, window.innerWidth - 336), bottom: window.innerHeight - rect.top + 6 }
        : { position: 'fixed', left: Math.min(rect.left, window.innerWidth - 336), top: rect.bottom + 6 }
      : { display: 'none' }

  let section: string | null = null
  return (
    <div ref={listRef} style={style} className="z-50 max-h-80 w-80 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
      {items.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">{t('no-results')}</div>}
      {items.map((item, i) => {
        const sec = item.kind === 'recipe' ? t('recipes') : item.kind === 'lora' ? t('loras') : item.kind === 'reference' ? (item.attached ? t('attached') : item.image.source === 'upload' ? t('uploads') : t('generations')) : null
        const header = sec && sec !== section ? sec : null
        if (sec) section = sec
        const selected = i === selectedIndex
        const disabled = item.kind === 'reference' && !item.attached && referencesFull
        return (
          <div key={item.key}>
            {header && <div className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{header}</div>}
            <button
              type="button"
              data-selected={selected}
              disabled={disabled}
              onMouseDown={e => { e.preventDefault(); pick(item) }}
              onMouseEnter={() => useSuggestionStore.setState({ selectedIndex: i })}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm', selected && 'bg-accent text-accent-foreground', disabled && 'opacity-40')}
            >
              {item.kind === 'recipe' && (<>
                <MediaImg src={item.recipe.cover} seed={item.recipe.id} className="size-8 rounded-md" />
                <span className="min-w-0 flex-1 truncate">{item.recipe.title}</span>
                <ChefHat className="size-3.5 text-muted-foreground" />
                {recipeIds.includes(item.recipe.id) && <Check className="size-4 text-primary" />}
              </>)}
              {item.kind === 'lora' && (<>
                <MediaImg src={item.lora.cover} seed={item.lora.versionId} className="size-8 rounded-md" />
                <span className="min-w-0 flex-1 truncate">{item.lora.title}</span>
                <Layers className="size-3.5 text-muted-foreground" />
                {selectedLoras.some(l => l.versionId === item.lora.versionId) && <Check className="size-4 text-primary" />}
              </>)}
              {item.kind === 'reference' && (<>
                <MediaImg src={item.image.url} seed={item.image.id} className="size-8 rounded-md" />
                <span className="min-w-0 flex-1 truncate">{item.attached ? `@${references.findIndex(r => r.id === item.image.id) + 1}` : item.image.prompt || item.image.id}</span>
                <Images className="size-3.5 text-muted-foreground" />
              </>)}
              {item.kind === 'browse' && (<>
                <span className="flex-1 text-muted-foreground">{item.target === 'recipes' ? t('browse-all-recipes') : item.target === 'loras' ? t('browse-all-loras') : t('browse-all')}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </>)}
            </button>
          </div>
        )
      })}
    </div>
  )
}
