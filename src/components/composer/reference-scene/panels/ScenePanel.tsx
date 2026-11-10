import { useTranslation } from 'react-i18next'
import { Box, Video, User } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useReferenceSceneStore } from '@/store/referenceSceneStore'
import { colourHex, type ReferenceScene } from '@/lib/reference-scene/types.ts'
import { Section, editScene } from './fields'

/** Shown when nothing is selected: everything in the scene, plus scene-wide options. */
export function ScenePanel({ scene }: { scene: ReferenceScene }) {
  const { t } = useTranslation('scene')
  const select = useReferenceSceneStore(s => s.select)
  const row = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted'
  return (
    <>
      <Section title={t('in-scene')}>
        <div className="-mx-2">
          {scene.figures.map(f => (
            <button key={f.id} type="button" className={row} onClick={() => select({ kind: 'figure', id: f.id })}>
              <User className="size-4 text-muted-foreground" /><span className="size-3 rounded-full" style={{ background: colourHex(f.colour) }} />
              <span className="flex-1">{t('figure-name', { colour: f.colour })}</span><span className="text-xs text-muted-foreground">{f.heightCm} cm</span>
            </button>
          ))}
          {scene.props.map(p => (
            <button key={p.id} type="button" className={row} onClick={() => select({ kind: 'prop', id: p.id })}><Box className="size-4 text-muted-foreground" />{t(`prop.${p.kind}`)}</button>
          ))}
          <button type="button" className={row} onClick={() => select({ kind: 'camera' })}><Video className="size-4 text-muted-foreground" /><span className="flex-1">{t('render-camera')}</span><span className="text-xs text-muted-foreground">{Math.round(scene.camera.focalMm)} mm</span></button>
        </div>
        {scene.figures.length === 0 && <p className="text-xs text-muted-foreground">{t('no-figures')}</p>}
      </Section>
      <Section title={t('output')}>
        <label className="flex items-center gap-2 text-sm">
          <span className="flex-1">{t('burn-labels')}</span>
          <Switch checked={scene.burnLabels} onCheckedChange={on => editScene(s => { s.burnLabels = on })} />
        </label>
        <p className="text-[11px] text-muted-foreground">{t('burn-labels-hint')}</p>
      </Section>
      <Section><p className="text-[11px] leading-relaxed text-muted-foreground">{t('shortcuts')}</p></Section>
    </>
  )
}
