import { reportError } from '@/studio/Notices'
import { studio } from '@/studio/api'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useComposerStore } from '@/store/composerStore'
import { findRecipe, findModel, recipes, rememberRecipes } from '@/mock/data'
import { MAX_RECIPES, type Recipe } from '@/types'
import { filterItems } from '@/lib/filter'
import { ResponsiveDialog } from '../shared/ResponsiveDialog'
import { PickerCard, PickerGrid } from './PickerGrid'
import { SelectedStrip } from './SelectedStrip'
import { Input } from '@/components/ui/input'

export function RecipePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [remote, setRemote] = useState<{ items: Recipe[]; totalPage: number }>()
  const [offline, setOffline] = useState(false)
  const modelId = useComposerStore(s => findModel(s.modelVersionId)?.id)
  useEffect(() => {
    if (!open) return
    let active = true
    setRemote(undefined)
    setOffline(false)
    const timer = setTimeout(() => {
      void studio.searchRecipes({ keyword: q, page, modelId }).then(result => {
        if (!active) return
        rememberRecipes(result.items)
        setRemote(result)
      }).catch(e => { if (active) { setOffline(true); reportError(e) } })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [open, q, page, modelId])
  const recipeIds = useComposerStore(s => s.recipeIds)
  const toggleRecipe = useComposerStore(s => s.toggleRecipe)
  const removeRecipe = useComposerStore(s => s.removeRecipe)
  const list = remote?.items ?? filterItems(recipes, q, r => `${r.title} ${r.author} ${r.categories.join(' ')}`)
  const full = recipeIds.length >= MAX_RECIPES
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={t('recipes')}
      toolbar={<>
        <SelectedStrip max={MAX_RECIPES} onRemove={removeRecipe}
          items={recipeIds.map(id => { const r = findRecipe(id); return { id, cover: r?.cover, name: r?.title ?? id } })} />
        <Input autoFocus placeholder={t('search')} value={q} onChange={e => { setQ(e.target.value); setPage(1) }} />
      </>}>
      {offline && <p role="status" className="text-sm text-muted-foreground">当前显示本地目录。</p>}
      {list.length === 0 && <p className="text-sm text-muted-foreground">{t('no-results')}</p>}
      <PickerGrid>
        {list.map(r => {
          const selected = recipeIds.includes(r.id)
          return <PickerCard key={r.id} cover={r.cover} seed={r.id} title={r.title} subtitle={`${r.source === 'official' ? t('official') : r.author} · ${t('uses', { count: r.stats.taskCount })}`}
            badges={[...r.slotTypes.map(s => t(`slot-${s}`)), ...(r.usability === 'follow_required' ? ['需关注作者'] : r.usability === 'unavailable' ? ['暂不可用'] : [])]} selected={selected} disabled={!selected && (full || r.usability === 'follow_required' || r.usability === 'unavailable')} onClick={() => toggleRecipe(r.id)} />
        })}
      </PickerGrid>
      {remote && remote.totalPage > 1 && <div className="mt-4 flex items-center justify-center gap-3">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
        <span>{page} / {remote.totalPage}</span>
        <Button variant="outline" disabled={page >= remote.totalPage} onClick={() => setPage(page + 1)}>下一页</Button>
      </div>}
    </ResponsiveDialog>
  )
}
