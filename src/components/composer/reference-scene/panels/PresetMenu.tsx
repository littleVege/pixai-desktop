import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { POSE_PRESETS, PRESET_GROUPS } from '@/lib/reference-scene/posePresets.ts'
import { snapToGround } from '@/lib/reference-scene/fk.ts'
import { findFigure } from '@/store/referenceSceneStore'
import { editScene } from './fields'

/** Applies a Pose Preset to one Figure: replaces its Pose, keeps where it stands and faces, then sets it on the ground. */
export function PresetMenu({ figureId }: { figureId: string }) {
  const { t } = useTranslation('scene')
  const apply = (id: string) => editScene(s => {
    const f = findFigure(s, figureId)
    const preset = POSE_PRESETS.find(p => p.id === id)
    if (!f || !preset) return
    f.pose = structuredClone(preset.pose)
    f.position = snapToGround(f)
  })
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" size="sm" className="flex-1"><Sparkles />{t('pose-presets')}</Button></PopoverTrigger>
      <PopoverContent align="start" className="max-h-[60vh] w-72 overflow-y-auto p-2">
        {PRESET_GROUPS.map(g => (
          <div key={g} className="pb-2">
            <div className="px-1 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">{t(`preset-group.${g}`)}</div>
            <div className="grid grid-cols-2 gap-1">
              {POSE_PRESETS.filter(p => p.group === g).map(p => (
                <button key={p.id} type="button" onClick={() => apply(p.id)} className="truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">{t(`preset.${p.id}`)}</button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
