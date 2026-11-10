import { reportError } from '@/studio/Notices'
import { studio } from '@/studio/api'
import { updateCatalog } from '@/mock/data'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useComposerStore } from '@/store/composerStore'
import { models } from '@/mock/data'
import { modelTypeLabel } from '@/types'
import { filterItems } from '@/lib/filter'
import { ResponsiveDialog } from '../shared/ResponsiveDialog'
import { PickerCard, PickerGrid } from './PickerGrid'
import { Input } from '@/components/ui/input'

/** Simplified stand-in for the production model marketplace dialog. */
export function ModelBrowse({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [, setCatalogVersion] = useState(0)
  useEffect(() => {
    if (!open || !studio) return
    let alive = true
    const timer = setTimeout(() => {
      void studio.searchModels({ keyword: q, type: 'MODEL' }).then((result: any) => {
        if (!alive) return
        updateCatalog(result.data ?? [], 'MODEL'); setCatalogVersion(value => value + 1)
      }).catch(error => { if (alive) reportError(error) })
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [open, q])
  const modelVersionId = useComposerStore(s => s.modelVersionId)
  const setModel = useComposerStore(s => s.setModel)
  const list = filterItems(models, q, m => `${m.title} ${modelTypeLabel(m.type)}`)
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={t('model')}>
      <Input autoFocus placeholder={t('search-models')} value={q} onChange={e => setQ(e.target.value)} className="mb-3" />
      <PickerGrid cols={5}>
        {list.map(m => (
          <PickerCard key={m.versionId} cover={m.cover} seed={m.id} title={m.title} subtitle={m.refCount > 0 ? t('uses', { count: m.refCount }) : undefined} badges={[modelTypeLabel(m.type)]} aspect="square"
            selected={m.versionId === modelVersionId} onClick={() => { setModel(m.versionId); onOpenChange(false) }} />
        ))}
      </PickerGrid>
    </ResponsiveDialog>
  )
}
