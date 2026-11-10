import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'cn'
import { useComposerStore } from '@/store/composerStore'
import { ASPECT_RATIOS, type BatchSize, type ImageSize } from '@/types'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AspectIcon } from '../shared/AspectIcon'
import { ResponsivePopover } from '../shared/ResponsivePopover'
import { ChipButton } from './Chip'

/** Aspect ratio, size and batch: the settings people change often, shown as values on the chip. */
export function OutputChip() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const params = useComposerStore(s => s.params)
  const setParams = useComposerStore(s => s.setParams)
  return (
    <ResponsivePopover open={open} onOpenChange={setOpen} title={t('output')} className="w-80"
      trigger={
        <ChipButton aria-label={t('output')}>
          <AspectIcon ratio={params.aspectRatio} />
          <span className="tabular-nums">{params.aspectRatio}<span className="hidden sm:inline"> · {params.size} · ×{params.batchSize}</span></span>
        </ChipButton>
      }>
      <div className="space-y-4">
        <section className="space-y-1.5">
          <div className="text-xs text-muted-foreground">{t('aspect-ratio')}</div>
          <div className="grid grid-cols-4 gap-1">
            {ASPECT_RATIOS.map(r => (
              <button key={r} type="button" onClick={() => setParams({ aspectRatio: r })}
                className={cn('flex flex-col items-center gap-1 rounded-lg border py-2 text-[11px] tabular-nums hover:bg-muted', params.aspectRatio === r ? 'border-primary bg-primary/10 text-primary' : 'border-transparent')}>
                <AspectIcon ratio={r} className="size-5" />{r}
              </button>
            ))}
          </div>
        </section>
        <div className="grid grid-cols-2 gap-3">
          <section className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t('size')}</div>
            <ToggleGroup type="single" variant="outline" size="sm" value={params.size} onValueChange={v => v && setParams({ size: v as ImageSize })} className="w-full">
              <ToggleGroupItem value="1k" className="flex-1">1k</ToggleGroupItem>
              <ToggleGroupItem value="1.5k" className="flex-1">1.5k</ToggleGroupItem>
            </ToggleGroup>
          </section>
          <section className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t('batch')}</div>
            <ToggleGroup type="single" variant="outline" size="sm" value={String(params.batchSize)} onValueChange={v => v && setParams({ batchSize: Number(v) as BatchSize })} className="w-full">
              <ToggleGroupItem value="1" className="flex-1">1</ToggleGroupItem>
              <ToggleGroupItem value="4" className="flex-1">4</ToggleGroupItem>
            </ToggleGroup>
          </section>
        </div>
      </div>
    </ResponsivePopover>
  )
}
