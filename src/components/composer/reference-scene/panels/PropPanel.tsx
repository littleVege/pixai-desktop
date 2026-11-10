import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findProp, useReferenceSceneStore } from '@/store/referenceSceneStore'
import type { Prop } from '@/lib/reference-scene/types.ts'
import { Section, Vec3Input, editScene } from './fields'

export function PropPanel({ prop }: { prop: Prop }) {
  const { t } = useTranslation('scene')
  const select = useReferenceSceneStore(s => s.select)
  const patch = (recipe: (p: Prop) => void, key: string) => editScene(s => { const p = findProp(s, prop.id); if (p) recipe(p) }, key)
  return (
    <>
      <Section title={t(`prop.${prop.kind}`)}>
        <Vec3Input label={t('position')} value={prop.position} suffix="m" onChange={v => patch(p => { p.position = v }, 'prop-pos')} />
        <Vec3Input label={t('rotation')} value={prop.rotation} step={5} suffix="°" onChange={v => patch(p => { p.rotation = v }, 'prop-rot')} />
        <Vec3Input label={t('size')} value={prop.scale} suffix="m" onChange={v => patch(p => { p.scale = v.map(n => Math.max(0.01, n)) as Prop['scale'] }, 'prop-scale')} />
        <p className="text-[11px] text-muted-foreground">{t('prop-hint')}</p>
      </Section>
      <Section>
        <Button variant="destructive" size="sm" className="w-full" onClick={() => { editScene(s => { s.props = s.props.filter(p => p.id !== prop.id) }); select(null) }}><Trash2 />{t('delete')}</Button>
      </Section>
    </>
  )
}
