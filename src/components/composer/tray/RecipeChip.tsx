import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChefHat, Plus, X } from 'lucide-react'
import { useComposerStore } from '@/store/composerStore'
import { findRecipe } from '@/mock/data'
import { MAX_RECIPES } from '@/types'
import { Button } from '@/components/ui/button'
import { MediaImg } from '../shared/MediaImg'
import { ResponsivePopover } from '../shared/ResponsivePopover'
import { SortableList } from '../shared/SortableList'
import { ChipButton, ChipShell, CountBadge } from './Chip'
import type { PickerTarget } from '../pickers/types'

export function RecipeChip({ onOpen }: { onOpen: (t: PickerTarget) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ids = useComposerStore(s => s.recipeIds)
  const removeRecipe = useComposerStore(s => s.removeRecipe)
  const moveRecipe = useComposerStore(s => s.moveRecipe)

  if (ids.length === 0) {
    return <ChipButton onClick={() => onOpen('recipes')}><ChefHat />{t('recipe')}</ChipButton>
  }
  const first = findRecipe(ids[0])
  return (
    <ChipShell onRemove={ids.length === 1 ? () => removeRecipe(ids[0]) : undefined} removeLabel={t('remove')}>
      <ResponsivePopover open={open} onOpenChange={setOpen} title={`${t('recipes')} ${ids.length}/${MAX_RECIPES}`} className="w-80 p-2"
        trigger={
          <ChipButton className="pl-1 hover:bg-transparent" aria-label={t('recipes')}>
            <MediaImg src={first?.cover} seed={ids[0]} className="size-5 rounded-full" />
            <ChefHat className="text-muted-foreground" />
            {ids.length === 1 ? <span className="max-w-20 truncate sm:max-w-28">{first?.title}</span> : <CountBadge n={ids.length - 1} />}
          </ChipButton>
        }>
        <div className="hidden px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground sm:block">{t('recipes')} · {ids.length}/{MAX_RECIPES}</div>
        <SortableList ids={ids} onMove={moveRecipe}>
          {(id, i, handle) => {
            const r = findRecipe(id)
            return (
              <div className="flex items-center gap-2 px-1 py-1.5">
                {handle}
                <span className="w-3 text-center text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                <MediaImg src={r?.cover} seed={id} className="size-8 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{r?.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{r?.slotTypes.map(s => t(`slot-${s}`)).join(' · ')}</div>
                </div>
                <Button variant="ghost" size="icon-xs" aria-label={t('remove')} onClick={() => removeRecipe(id)}><X /></Button>
              </div>
            )
          }}
        </SortableList>
        <p className="px-2 pt-2 text-[11px] text-muted-foreground">{t('recipe-order-note')}</p>
        <Button variant="outline" size="sm" className="mt-2 w-full" disabled={ids.length >= MAX_RECIPES} onClick={() => { setOpen(false); onOpen('recipes') }}>
          <Plus />{t('add-more')}
        </Button>
      </ResponsivePopover>
    </ChipShell>
  )
}
