import { useTranslation } from 'react-i18next'
import { X, AlertTriangle, PersonStanding } from 'lucide-react'
import { cn } from 'cn'
import { useComposerStore } from '@/store/composerStore'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { conflicts } from '@/lib/conflicts'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MediaImg } from './shared/MediaImg'

/** Attached References, numbered to match their @mentions. Hidden when empty. */
export function ReferenceRow() {
  const { t } = useTranslation()
  const references = useComposerStore(s => s.references)
  const loras = useComposerStore(s => s.loras)
  const params = useComposerStore(s => s.params)
  const removeReference = useComposerStore(s => s.removeReference)
  const { referencesIgnored } = conflicts({ loras, references, params })
  if (references.length === 0) return null
  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      {references.map((ref, i) => (
        <div key={ref.id} className={cn('group relative size-14 shrink-0 overflow-hidden rounded-lg border', referencesIgnored && 'opacity-50 grayscale')}>
          <MediaImg src={ref.url} seed={ref.id} className="size-full" />
          {ref.source === 'scene' && (
            <button type="button" onClick={() => useReferenceSceneStore.getState().openForReference(ref.id)} aria-label={t('edit-scene')} title={t('edit-scene')}
              className="absolute inset-0 flex items-end justify-end p-0.5 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="rounded bg-black/60 p-0.5 text-white"><PersonStanding className="size-3" /></span>
            </button>
          )}
          <span className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">@{i + 1}</span>
          <button type="button" onClick={() => removeReference(ref.id)} aria-label={t('remove')}
            className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100">
            <X className="size-3" />
          </button>
        </div>
      ))}
      {referencesIgnored && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="shrink-0 gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3" />{t('ignored')}</Badge>
          </TooltipTrigger>
          <TooltipContent>{t('ignored-references')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
