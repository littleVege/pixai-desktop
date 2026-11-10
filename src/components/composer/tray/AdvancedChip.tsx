import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, Dices, AlertTriangle, RotateCcw } from 'lucide-react'
import { cn } from 'cn'
import { useComposerStore, defaultParams } from '@/store/composerStore'
import { advancedOverrides, resetAdvanced } from '@/lib/params'
import { conflicts } from '@/lib/conflicts'
import { SAMPLERS } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ResponsivePopover } from '../shared/ResponsivePopover'
import { ChipButton } from './Chip'

/** Gear for steps / CFG / sampler / seed / negative prompt. The badge counts settings changed from the model defaults. */
export function AdvancedChip() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const params = useComposerStore(s => s.params)
  const modelVersionId = useComposerStore(s => s.modelVersionId)
  const loras = useComposerStore(s => s.loras)
  const references = useComposerStore(s => s.references)
  const setParams = useComposerStore(s => s.setParams)
  const defaults = defaultParams(modelVersionId)
  const changed = advancedOverrides(params, defaults)
  const c = conflicts({ loras, references, params })
  const mark = (k: (typeof changed)[number]) => changed.includes(k) && <span className="size-1.5 rounded-full bg-primary" />

  return (
    <ResponsivePopover open={open} onOpenChange={setOpen} title={t('advanced')} align="end" className="w-80"
      trigger={
        <ChipButton active={changed.length > 0} aria-label={changed.length ? `${t('advanced')} · ${t('overrides-count', { count: changed.length })}` : t('advanced')} className="relative px-2">
          <Settings2 />
          {changed.length > 0 && <span className="text-[11px] tabular-nums">{changed.length}</span>}
          {c.negativePromptIgnored && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-muted" />}
        </ChipButton>
      }>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{changed.length ? t('overrides-count', { count: changed.length }) : t('at-defaults')}</span>
          <Button variant="ghost" size="xs" disabled={!changed.length} onClick={() => setParams(resetAdvanced(params, defaults))}><RotateCcw />{t('reset-defaults')}</Button>
        </div>
        <Field label={<>{t('steps')} {mark('steps')}</>} value={params.steps}>
          <Slider min={1} max={60} step={1} value={[params.steps]} onValueChange={([v]) => setParams({ steps: v })} aria-label={t('steps')} />
        </Field>
        <Field label={<>{t('cfg')} {mark('cfgScale')}</>} value={params.cfgScale}>
          <Slider min={1} max={15} step={0.5} value={[params.cfgScale]} onValueChange={([v]) => setParams({ cfgScale: v })} aria-label={t('cfg')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<>{t('sampler')} {mark('sampler')}</>}>
            <Select value={params.sampler} onValueChange={v => setParams({ sampler: v })}>
              <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{SAMPLERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={<>{t('seed')} {mark('seed')}</>}>
            <div className="flex gap-1">
              <Input type="number" placeholder={t('seed-random')} value={params.seed ?? ''} onChange={e => setParams({ seed: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 font-mono text-xs" />
              <Button variant="outline" size="icon-sm" aria-label={t('seed-random')} onClick={() => setParams({ seed: null })}><Dices /></Button>
            </div>
          </Field>
        </div>
        <Field label={<>{t('negative-prompt')} {mark('negativePrompt')}</>}>
          <Textarea rows={2} placeholder={t('negative-placeholder')} value={params.negativePrompt} onChange={e => setParams({ negativePrompt: e.target.value })} className={cn('text-sm', c.negativePromptIgnored && 'opacity-60')} />
          {c.negativePromptIgnored && <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3" />{t('ignored-negative')}</p>}
        </Field>
      </div>
    </ResponsivePopover>
  )
}

function Field({ label, value, children }: { label: React.ReactNode; value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">{label}</span>
        {value !== undefined && <span className="font-mono text-foreground tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  )
}
