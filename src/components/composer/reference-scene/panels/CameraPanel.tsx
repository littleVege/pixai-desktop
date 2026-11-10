import { useTranslation } from 'react-i18next'
import { RotateCcw, Eye } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { DISTORTION_MAX, DISTORTION_MIN, FOCAL_MAX, FOCAL_MIN, FOCAL_STOPS, angleAtRadius, derivedDistortion, focalToSlider, lensFor, sliderToFocal } from '@/lib/reference-scene/lens.ts'
import { DEFAULT_CAMERA } from '@/lib/reference-scene/scene.ts'
import type { RenderCamera } from '@/lib/reference-scene/types.ts'
import { NumberInput, Section, SliderRow, Vec3Input, editScene, endGesture } from './fields'

const patch = (recipe: (c: RenderCamera) => void, key?: string) => editScene(s => recipe(s.camera), key)

export function CameraPanel({ camera, aspect }: { camera: RenderCamera; aspect: number }) {
  const { t } = useTranslation('scene')
  const lookThrough = useReferenceSceneStore(s => s.lookThrough)
  const setLookThrough = useReferenceSceneStore(s => s.setLookThrough)
  const lens = lensFor(camera, aspect)
  const auto = camera.distortion === null
  const distortion = camera.distortion ?? derivedDistortion(camera.focalMm)
  const fovH = Math.round((2 * angleAtRadius(lens.sensorW / 2, lens.f, lens.kappa) * 180) / Math.PI)
  return (
    <>
      <Section title={t('lens')}>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex-1 text-muted-foreground">{t('focal-length')}</span>
          <NumberInput value={Math.round(camera.focalMm * 10) / 10} min={FOCAL_MIN} max={FOCAL_MAX} step={1} suffix="mm" className="w-20 flex-none" aria-label={t('focal-length')}
            onChange={v => patch(c => { c.focalMm = v }, 'focal')} />
        </div>
        <Slider value={[focalToSlider(camera.focalMm)]} min={0} max={1} step={0.001} onValueCommit={endGesture}
          onValueChange={([v]) => patch(c => { const f = sliderToFocal(v); c.focalMm = f < 20 ? Math.round(f * 10) / 10 : Math.round(f) }, 'focal')} />
        <div className="flex gap-1">
          {FOCAL_STOPS.map(f => (
            <button key={f} type="button" onClick={() => patch(c => { c.focalMm = f })}
              className={cn('flex-1 rounded-md border py-1 text-[11px] tabular-nums transition hover:bg-muted', Math.abs(camera.focalMm - f) < 0.5 && 'border-primary bg-primary text-primary-foreground hover:bg-primary')}>{f}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{t('fov-hint', { fov: fovH, corner: Math.round(lens.cornerDeg * 2) })}</p>
      </Section>
      <Section title={t('distortion')} actions={
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">{t('auto')}<Switch checked={auto} onCheckedChange={on => patch(c => { c.distortion = on ? null : derivedDistortion(c.focalMm) })} /></label>
      }>
        <SliderRow label={distortion >= 0 ? t('barrel') : t('pincushion')} value={Math.round(distortion * 100) / 100} min={DISTORTION_MIN} max={DISTORTION_MAX} step={0.01}
          onChange={v => patch(c => { c.distortion = v }, 'distortion')} className={cn(auto && 'opacity-70')} />
      </Section>
      <Section title={t('placement')} actions={
        <Button variant="ghost" size="xs" onClick={() => patch(c => { Object.assign(c, structuredClone(DEFAULT_CAMERA)) })}><RotateCcw />{t('reset')}</Button>
      }>
        <Vec3Input label={t('position')} value={camera.position} suffix="m" onChange={v => patch(c => { c.position = v }, 'cam-pos')} />
        <Vec3Input label={t('target')} value={camera.target} suffix="m" onChange={v => patch(c => { c.target = v }, 'cam-target')} />
        <SliderRow label={t('roll')} value={camera.roll} min={-180} max={180} step={1} suffix="°" onChange={v => patch(c => { c.roll = v }, 'roll')} />
        <Button variant={lookThrough ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setLookThrough(!lookThrough)}><Eye />{lookThrough ? t('stop-looking-through') : t('look-through')}</Button>
        <p className="text-[11px] text-muted-foreground">{t('look-through-hint')}</p>
      </Section>
    </>
  )
}
