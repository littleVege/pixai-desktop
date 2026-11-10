import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, Plus, X, TextCursorInput } from 'lucide-react'
import { useComposerStore } from '@/store/composerStore'
import { findLora } from '@/mock/data'
import { LORA_WEIGHT_MAX, LORA_WEIGHT_MIN, LORA_WEIGHT_STEP } from '@/types'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MediaImg } from '../shared/MediaImg'
import { ResponsivePopover } from '../shared/ResponsivePopover'
import { SortableList } from '../shared/SortableList'
import { ChipButton, ChipShell, CountBadge } from './Chip'
import type { PickerTarget } from '../pickers/types'

const clamp = (v: number) => Math.min(LORA_WEIGHT_MAX, Math.max(LORA_WEIGHT_MIN, v))

export function LoraChip({ onOpen }: { onOpen: (t: PickerTarget) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const loras = useComposerStore(s => s.loras)
  const saved = useComposerStore(s => s.promptContext?.loras)
  const maxLoras = useComposerStore(s => s.maxLoras)
  const removeLora = useComposerStore(s => s.removeLora)
  const moveLora = useComposerStore(s => s.moveLora)
  const setLoraWeight = useComposerStore(s => s.setLoraWeight)
  const requestInsert = useComposerStore(s => s.requestInsert)

  if (loras.length === 0) {
    return <ChipButton onClick={() => onOpen('loras')}><Layers />{t('lora')}</ChipButton>
  }
  const first = loras[0]
  const firstLora = findLora(first.versionId)
  const ids = loras.map(l => l.versionId)
  return (
    <ChipShell onRemove={loras.length === 1 ? () => removeLora(first.versionId) : undefined} removeLabel={t('remove')}>
      <ResponsivePopover open={open} onOpenChange={setOpen} title={`${t('loras')} ${loras.length}/${maxLoras}`} className="w-80 p-2"
        trigger={
          <ChipButton className="pl-1 hover:bg-transparent" aria-label={t('loras')}>
            <MediaImg src={firstLora?.cover} seed={first.versionId} className="size-5 rounded-full" />
            <Layers className="text-muted-foreground" />
            {loras.length === 1
              ? <><span className="max-w-16 truncate sm:max-w-24">{firstLora?.title ?? saved?.find(l => l.versionId === first.versionId)?.title ?? first.versionId}</span><span className="font-mono text-[11px] text-primary">{first.weight.toFixed(2)}</span></>
              : <CountBadge n={loras.length - 1} />}
          </ChipButton>
        }>
        <div className="hidden px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground sm:block">{t('loras')} · {loras.length}/{maxLoras}</div>
        <SortableList ids={ids} onMove={moveLora}>
          {(id, _i, handle) => {
            const l = findLora(id)
            const historical = saved?.find(item => item.versionId === id)
            const triggerWords = l?.triggerWords || historical?.triggerWords.join(', ')
            const weight = loras.find(x => x.versionId === id)?.weight ?? 0
            return (
              <div className="space-y-1 px-1 py-1.5">
                <div className="flex items-center gap-2">
                  {handle}
                  <MediaImg src={l?.cover} seed={id} className="size-8 rounded-md" />
                  <span className="min-w-0 flex-1 truncate text-sm">{l?.title ?? historical?.title ?? id}</span>
                  {triggerWords && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={t('insert-trigger')} onClick={() => { requestInsert(triggerWords); setOpen(false) }}><TextCursorInput /></Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-60">{t('insert-trigger')}: {triggerWords}</TooltipContent>
                    </Tooltip>
                  )}
                  <Button variant="ghost" size="icon-xs" aria-label={t('remove')} onClick={() => removeLora(id)}><X /></Button>
                </div>
                <div className="flex items-center gap-3 pl-8">
                  <Slider className="flex-1" min={LORA_WEIGHT_MIN} max={LORA_WEIGHT_MAX} step={LORA_WEIGHT_STEP} value={[weight]} onValueChange={([v]) => setLoraWeight(id, v)} aria-label={t('weight')} />
                  <Input type="number" min={LORA_WEIGHT_MIN} max={LORA_WEIGHT_MAX} step={LORA_WEIGHT_STEP} value={weight} aria-label={t('weight')}
                    onChange={e => setLoraWeight(id, clamp(Number(e.target.value) || 0))} className="h-7 w-16 text-right font-mono text-xs" />
                </div>
              </div>
            )
          }}
        </SortableList>
        <Button variant="outline" size="sm" className="mt-2 w-full" disabled={loras.length >= maxLoras} onClick={() => { setOpen(false); onOpen('loras') }}>
          <Plus />{loras.length >= maxLoras ? t('max-reached', { max: maxLoras }) : t('add-more')}
        </Button>
      </ResponsivePopover>
    </ChipShell>
  )
}
