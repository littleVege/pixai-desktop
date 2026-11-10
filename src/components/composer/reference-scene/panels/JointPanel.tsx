import { useTranslation } from 'react-i18next'
import { ChevronLeft, Lock, LockOpen, RotateCcw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { findFigure, useReferenceSceneStore } from '@/store/referenceSceneStore'
import { clampRotation, isFreeJoint, isOutOfRange, limitsFor } from '@/lib/reference-scene/limits.ts'
import { colourHex, type Figure, type JointName, type Rot3 } from '@/lib/reference-scene/types.ts'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Section, SliderRow, editScene } from './fields'
import { PresetMenu } from './PresetMenu'

/** Which axis-label set a Joint uses (see `axis.*` in the scene namespace). */
const axisGroup = (j: JointName) => j.replace(/[LR]$/, '').replace(/^(waist|chest)$/, 'spine')

export function JointPanel({ fig, joint }: { fig: Figure; joint: JointName }) {
  const { t } = useTranslation('scene')
  const isMobile = useIsMobile()
  const select = useReferenceSceneStore(s => s.select)
  const unlocked = useReferenceSceneStore(s => s.unlocked)
  const setUnlocked = useReferenceSceneStore(s => s.setUnlocked)
  const rot = fig.pose[joint]
  const lim = limitsFor(joint)
  const out = isOutOfRange(joint, rot)
  const free = isFreeJoint(joint)
  const group = axisGroup(joint)
  const setAxis = (i: number, v: number) => editScene(s => {
    const f = findFigure(s, fig.id)
    if (!f) return
    const next = [...f.pose[joint]] as Rot3
    next[i] = Math.round(v * 10) / 10
    f.pose[joint] = clampRotation(joint, next, { allowOut: unlocked, from: f.pose[joint] })
  }, `joint-${joint}-${i}`)

  return (
    <>
      <Section>
        <button type="button" onClick={() => select({ kind: 'figure', id: fig.id })} className="-ml-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" /><span className="size-2.5 rounded-full" style={{ background: colourHex(fig.colour) }} />{t('figure-name', { colour: fig.colour })}
        </button>
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-medium">{t(`joint.${joint}`)}</h3>
          {out && <Badge variant="outline" className="gap-1 border-red-500/50 text-red-600 dark:text-red-400"><AlertTriangle className="size-3" />{t('out-of-range')}</Badge>}
        </div>
      </Section>
      <Section>
        {[0, 1, 2].map(i => {
          const [lo, hi] = lim[i]
          if (lo === 0 && hi === 0 && rot[i] === 0) return null
          const axisOut = !free && (rot[i] < lo - 0.01 || rot[i] > hi + 0.01)
          const min = unlocked ? -180 : Math.min(lo, rot[i])
          const max = unlocked ? 180 : Math.max(hi, rot[i])
          return (
            <SliderRow key={i} label={t(`axis.${group}.${'xyz'[i]}`)} value={rot[i]} min={min} max={max} step={1} suffix="°"
              hint={free ? undefined : `${lo}…${hi}`} danger={axisOut} onChange={v => setAxis(i, v)} />
          )
        })}
        {!free && (
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
            <span className="flex-1 text-[11px] text-muted-foreground">{isMobile ? t('unlock-hint-touch') : t('unlock-hint')}</span>
            <Button variant={unlocked ? 'destructive' : 'ghost'} size="xs" onClick={() => setUnlocked(!unlocked)}>
              {unlocked ? <LockOpen /> : <Lock />}{unlocked ? t('unlocked') : t('unlock')}
            </Button>
          </div>
        )}
      </Section>
      <Section>
        <div className="flex gap-1.5">
          <PresetMenu figureId={fig.id} />
          <Button variant="outline" size="sm" onClick={() => editScene(s => { const f = findFigure(s, fig.id); if (f) f.pose[joint] = [0, 0, 0] })}><RotateCcw />{t('reset-joint')}</Button>
        </div>
      </Section>
    </>
  )
}
