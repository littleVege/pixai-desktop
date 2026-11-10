import { reportError } from '@/studio/Notices'
import { studio } from '@/studio/api'
import { updateCatalog } from '@/mock/data'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useComposerStore } from '@/store/composerStore'
import { findLora, findModel, loras } from '@/mock/data'
import { filterItems } from '@/lib/filter'
import { ResponsiveDialog } from '../shared/ResponsiveDialog'
import { PickerCard, PickerGrid } from './PickerGrid'
import { SelectedStrip } from './SelectedStrip'
import { Input } from '@/components/ui/input'

export function LoraPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const baseModelType = useComposerStore(s => findModel(s.modelVersionId)?.type ?? (s.promptContext?.model?.versionId === s.modelVersionId ? s.promptContext.model.type : undefined))
  const [resultIds, setResultIds] = useState<string[]>()
  const [, setCatalogVersion] = useState(0)
  useEffect(() => {
    if (!open || !studio) return
    let alive = true
    setResultIds(undefined)
    const timer = setTimeout(() => {
      void studio.searchModels({ keyword: q, type: 'LORA', baseModelType }).then((result: any) => {
        if (!alive) return
        setResultIds((result.data ?? []).map((item: { latestAvailableVersionId?: string }) => item.latestAvailableVersionId).filter(Boolean))
        updateCatalog(result.data ?? [], 'LORA'); setCatalogVersion(value => value + 1)
      }).catch(error => { if (alive) reportError(error) })
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [open, q, baseModelType])
  const selected = useComposerStore(s => s.loras)
  const saved = useComposerStore(s => s.promptContext?.loras)
  const maxLoras = useComposerStore(s => s.maxLoras)
  const toggleLora = useComposerStore(s => s.toggleLora)
  const removeLora = useComposerStore(s => s.removeLora)
  const list = resultIds ? resultIds.flatMap(id => findLora(id) ?? []) : filterItems(loras.filter(lora => !baseModelType || lora.baseModelTypes?.includes(baseModelType)), q, l => `${l.title} ${l.triggerWords ?? ''}`)
  const full = selected.length >= maxLoras
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={t('loras')}
      toolbar={<>
        <SelectedStrip max={maxLoras} onRemove={removeLora}
          items={selected.map(s => { const l = findLora(s.versionId); return { id: s.versionId, cover: l?.cover, name: l?.title ?? saved?.find(item => item.versionId === s.versionId)?.title ?? s.versionId, meta: s.weight.toFixed(2) } })} />
        <Input autoFocus placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} />
      </>}>
      {list.length === 0 && <p className="text-sm text-muted-foreground">{t('no-results')}</p>}
      <PickerGrid cols={5}>
        {list.map(l => {
          const isSel = selected.some(s => s.versionId === l.versionId)
          return <PickerCard key={l.versionId} cover={l.cover} seed={l.versionId} title={l.title} subtitle={l.refCount ? t('uses', { count: l.refCount }) : undefined} aspect="square" selected={isSel} disabled={!isSel && full} onClick={() => toggleLora(l.versionId)} />
        })}
      </PickerGrid>
    </ResponsiveDialog>
  )
}
