import { useTranslation } from 'react-i18next'
import { ArrowDownToLine, Copy, FlipHorizontal2, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findFigure, useReferenceSceneStore } from '@/store/referenceSceneStore'
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM, MAX_FIGURES, PALETTE, type Figure, type Proportion } from '@/lib/reference-scene/types.ts'
import { PROPORTION_IDS } from '@/lib/reference-scene/rig.ts'
import { mirrorPose } from '@/lib/reference-scene/pose.ts'
import { A_POSE } from '@/lib/reference-scene/posePresets.ts'
import { outOfRangeJoints } from '@/lib/reference-scene/limits.ts'
import { snapToGround } from '@/lib/reference-scene/fk.ts'
import { newId, nextColour } from '@/lib/reference-scene/scene.ts'
import { Section, SliderRow, Vec3Input, editScene } from './fields'
import { PresetMenu } from './PresetMenu'

const patchFigure = (id: string, recipe: (f: Figure) => void, key?: string) => editScene(s => { const f = findFigure(s, id); if (f) recipe(f) }, key)

export function FigurePanel({ fig }: { fig: Figure }) {
  const { t } = useTranslation('scene')
  const figures = useReferenceSceneStore(s => s.draft?.figures.length ?? 0)
  const select = useReferenceSceneStore(s => s.select)
  const bad = outOfRangeJoints(fig.pose)
  const id = fig.id
  return (
    <>
      <Section title={t('colour')}>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map(c => (
            <Tooltip key={c.id}>
              <TooltipTrigger asChild>
                <button type="button" aria-label={c.id} onClick={() => patchFigure(id, f => { f.colour = c.id })}
                  className={cn('size-6 rounded-full border border-black/10 transition', fig.colour === c.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110')}
                  style={{ background: c.hex }} />
              </TooltipTrigger>
              <TooltipContent>{c.id}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{t('colour-hint', { colour: fig.colour })}</p>
      </Section>
      <Section title={t('pose')}>
        <div className="flex gap-1.5">
          <PresetMenu figureId={id} />
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon-sm" aria-label={t('mirror')} onClick={() => patchFigure(id, f => { f.pose = mirrorPose(f.pose) })}><FlipHorizontal2 /></Button></TooltipTrigger><TooltipContent>{t('mirror')}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon-sm" aria-label={t('reset-pose')} onClick={() => patchFigure(id, f => { f.pose = structuredClone(A_POSE); f.position = snapToGround(f) })}><RotateCcw /></Button></TooltipTrigger><TooltipContent>{t('reset-pose')}</TooltipContent></Tooltip>
        </div>
        {bad.length > 0 && (
          <div className="flex items-start gap-1.5 rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-px size-3.5 flex-none" />
            <span>{t('out-of-range-list')} {bad.map(j => (
              <button key={j} type="button" className="underline underline-offset-2" onClick={() => select({ kind: 'joint', figureId: id, joint: j })}>{t(`joint.${j}`)}</button>
            )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ', ', el] : [el]), [])}</span>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{t('pose-hint')}</p>
      </Section>
      <Section title={t('body')}>
        <SliderRow label={t('height')} value={fig.heightCm} min={HEIGHT_MIN_CM} max={HEIGHT_MAX_CM} step={1} suffix="cm"
          onChange={v => patchFigure(id, f => { f.heightCm = Math.round(v) }, 'height')} />
        <ToggleGroup type="single" variant="outline" size="sm" value={fig.proportion} className="w-full"
          onValueChange={v => v && patchFigure(id, f => { f.proportion = v as Proportion })}>
          {PROPORTION_IDS.map(p => <ToggleGroupItem key={p} value={p} className="flex-1 text-xs">{t(`proportion.${p}`)}</ToggleGroupItem>)}
        </ToggleGroup>
      </Section>
      <Section title={t('placement')}>
        <Vec3Input label={t('position')} value={fig.position} onChange={v => patchFigure(id, f => { f.position = v }, 'fig-pos')} suffix="m" />
        <SliderRow label={t('facing')} value={fig.yaw} min={-180} max={180} step={1} suffix="°" onChange={v => patchFigure(id, f => { f.yaw = v }, 'yaw')} />
        <Button variant="outline" size="sm" className="w-full" onClick={() => patchFigure(id, f => { f.position = snapToGround(f) })}><ArrowDownToLine />{t('snap-to-ground')}</Button>
      </Section>
      <Section>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1" disabled={figures >= MAX_FIGURES} onClick={() => {
            const copyId = newId('fig')
            editScene(s => { s.figures.push({ ...structuredClone(fig), id: copyId, colour: nextColour(s.figures), position: [fig.position[0] + 0.8, fig.position[1], fig.position[2]] }) })
            select({ kind: 'figure', id: copyId })
          }}><Copy />{t('duplicate')}</Button>
          <Button variant="destructive" size="sm" className="flex-1" onClick={() => { editScene(s => { s.figures = s.figures.filter(f => f.id !== id) }); select(null) }}><Trash2 />{t('delete')}</Button>
        </div>
      </Section>
    </>
  )
}
